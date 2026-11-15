// Deterministic basket analysis. HEURISTIC: per-line greedy suggestions, not a global optimiser.
import { unitPrice } from '../utils/units.js';
import { jaccard, purposeTags, allergenOk, inr, amountLabel } from '../utils/text.js';
import { substitutesFor } from './substitutes.js';

export const LIMITATIONS = [
  'Suggestions are chosen one cart line at a time (greedy); the combined result is not guaranteed to be the cheapest possible basket.',
  'Alternatives must be in the same category and unit with at least one shared purpose tag.',
  'Health goals use only products that have nutrition data; others are never assumed healthier or less healthy.',
  'Avoid-lists match declared allergens and declared ingredient text only.',
];

const violates = (p, avoid) => avoid.some((a) => p.allergens.includes(a) || (p.ingredients || '').toLowerCase().includes(a));

export function analyzeBasket({ lines, products, budget = null, goals = {}, prefs = null, history = null }) {
  const g = { minimizeSpend: false, maximizeValue: false, healthier: false, frequent: false, minimizeSubstitutions: false, avoid: [], ...goals };
  if (!g.maximizeValue) g.minimizeSpend = true; // sensible default
  const avoid = g.avoid.map((a) => a.toLowerCase().trim()).filter(Boolean);
  const histIds = new Set((history || []).map((h) => h.productId));
  const total = lines.reduce((t, l) => t + l.product.price * l.qty, 0);
  const info = lines.map((l) => ({ productId: l.product.id, name: l.product.name, qty: l.qty, unitPrice: l.product.price, lineTotal: l.product.price * l.qty, share: total ? Number(((l.product.price * l.qty) / total).toFixed(3)) : 0 }));
  const expensive = [...info].sort((a, b) => b.lineTotal - a.lineTotal).slice(0, 3).filter((l) => l.lineTotal > 0);

  const duplicates = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const a = lines[i].product, b = lines[j].product;
    if (a.category === b.category && a.unit === b.unit && jaccard(purposeTags(a), purposeTags(b)) >= 0.6) duplicates.push({ productIds: [a.id, b.id], names: [a.name, b.name], message: `${a.name} and ${b.name} serve a very similar purpose; you may only need one.` });
  }
  const conflicts = lines.filter((l) => violates(l.product, avoid)).map((l) => ({ productId: l.product.id, name: l.product.name, message: `${l.product.name} contains something on your avoid list (declared data).` }));

  const suggestions = [];
  for (const l of lines) {
    const p = l.product, need = p.packSize * l.qty, lineTotal = p.price * l.qty, isConflict = violates(p, avoid);
    const cands = [];
    for (const s of substitutesFor(p, products, { prefs: { ...(prefs || {}), avoidAllergens: [...(prefs?.avoidAllergens || [])] }, history, limit: 20 })) {
      const c = s.product;
      if (violates(c, avoid)) continue;
      const units = Math.ceil(need / c.packSize), cost = units * c.price, extra = units * c.packSize - need, saving = lineTotal - cost;
      const sameKind = c.brand === p.brand && jaccard(purposeTags(p), purposeTags(c)) >= 0.99;
      if (g.minimizeSubstitutions && !sameKind && !isConflict) continue;
      let healthDelta = null;
      if (c.nutrition && p.nutrition) { healthDelta = c.nutrition.sugar - p.nutrition.sugar; if (g.healthier && c.nutrition.sugar > p.nutrition.sugar && !isConflict) continue; }
      const healthSwap = g.healthier && healthDelta != null && healthDelta <= -p.nutrition.sugar * 0.2;
      if (saving <= 0 && !isConflict && !healthSwap) continue;
      if (g.minimizeSubstitutions && !isConflict && saving < lineTotal * 0.05) continue;

      const tradeoffs = [];
      if (c.packSize !== p.packSize) tradeoffs.push(`Pack size ${amountLabel(c)} vs ${amountLabel(p)}`);
      if (extra > 0) tradeoffs.push(`You get ${extra} ${c.unit} more than you need${['fruits', 'vegetables', 'dairy'].includes(p.category) ? ' (perishable, may spoil)' : ''}`);
      if (c.brand !== p.brand) tradeoffs.push(`Different brand (${p.brand} → ${c.brand})`);
      if (healthDelta != null) tradeoffs.push(`Sugar ${healthDelta <= 0 ? 'lower' : 'higher'} by ${Math.abs(healthDelta).toFixed(1)} g per 100 (seed nutrition data)`);
      else tradeoffs.push('No verified nutrition data to compare');
      if (saving < 0) tradeoffs.push(`Costs ${inr(-saving)} more`);

      const rank = (g.maximizeValue ? ((unitPrice(p) - unitPrice(c)) / unitPrice(p)) * 100 : saving) + (g.frequent && histIds.has(c.id) ? 15 : 0) + (isConflict ? 1000 : 0) + (healthSwap ? 20 : 0);
      cands.push({ rank, s: { id: `${p.id}->${c.id}`, type: isConflict ? 'avoid-conflict' : sameKind ? 'pack-size' : healthSwap && saving <= 0 ? 'healthier' : 'alternative', fromProductId: p.id, fromName: p.name, toProduct: c, toQty: units, newLineTotal: cost, saving, savingPct: lineTotal ? Number(((saving / lineTotal) * 100).toFixed(1)) : 0, tradeoffs, reasons: s.reasons, requiresApproval: true } });
    }
    cands.sort((a, b) => b.rank - a.rank || a.s.toProduct.slug.localeCompare(b.s.toProduct.slug));
    if (cands.length) suggestions.push({ ...cands[0].s, alternatives: cands.slice(1, 3).map((x) => x.s) });
  }
  const finalSuggestions = (g.minimizeSubstitutions ? suggestions.sort((a, b) => b.saving - a.saving).slice(0, 3) : suggestions.sort((a, b) => b.saving - a.saving));
  const potentialSavings = finalSuggestions.reduce((t, s) => t + Math.max(0, s.saving), 0);
  const projectedTotal = total - finalSuggestions.reduce((t, s) => t + s.saving, 0);

  // greedy path to budget: apply largest savings first until under budget
  let path = null;
  if (budget != null && total > budget) {
    let run = total; const ids = [];
    for (const s of [...finalSuggestions].filter((x) => x.saving > 0).sort((a, b) => b.saving - a.saving)) { if (run <= budget) break; run -= s.saving; ids.push(s.id); }
    path = { suggestionIds: ids, projectedTotal: run, reachesBudget: run <= budget, shortfall: Math.max(0, run - budget) };
  }
  return {
    method: 'deterministic greedy heuristic (not AI, not guaranteed optimal)',
    total, budget, remaining: budget == null ? null : budget - total, overBudget: budget != null && total > budget,
    lines: info, expensive, duplicates, conflicts, suggestions: finalSuggestions, potentialSavings, projectedTotal, pathToBudget: path,
    goalsApplied: g, limitations: LIMITATIONS,
  };
}

// Items from a recipe plan that are missing from the current basket.
export function missingForPlan(plan, cartProductIds) {
  const have = new Set(cartProductIds);
  return plan.lines.filter((l) => l.status === 'matched' && !have.has(l.product.id)).map((l) => ({ label: l.label, product: l.product, qty: l.units, cost: l.buyCost }));
}
