import { unitPrice, unitPriceLabel } from '../utils/units.js';
import { jaccard, purposeTags, dietOk, allergenOk, inr, amountLabel } from '../utils/text.js';

// Candidates must be in stock, same category & unit, diet/allergen-compatible, and share >=1 purpose tag.
export function substitutesFor(product, products, { prefs = null, history = null, limit = 5, maxPrice = null } = {}) {
  const histIds = new Set((history || []).map((h) => h.productId));
  const upOrig = unitPrice(product);
  const need = [...new Set([...(product.dietaryLabels || []), ...(prefs?.dietary || [])])];
  const out = [];
  for (const c of products) {
    if (c.id === product.id || c.stock <= 0 || c.category !== product.category || c.unit !== product.unit) continue;
    if (!need.every((d) => c.dietaryLabels.includes(d)) || !allergenOk(c, prefs?.avoidAllergens)) continue;
    if (maxPrice != null && c.price > maxPrice) continue;
    const purpose = jaccard(purposeTags(product), purposeTags(c));
    if (purpose <= 0) continue;
    const up = unitPrice(c), unitDelta = up - upOrig, unitPct = upOrig ? (unitDelta / upOrig) * 100 : 0;
    const brandPref = c.brand === product.brand || prefs?.favouriteBrands?.includes(c.brand) ? 1 : 0;
    const score = 0.40 * purpose + 0.25 * Math.max(0, Math.min(1, 0.5 - unitPct / 100)) + 0.10 * brandPref + 0.10 * (histIds.has(c.id) ? 1 : 0) + 0.15 * (c.rating / 5);

    const reasons = [`Shares purpose with ${product.name} (${purposeTags(product).filter((t) => purposeTags(c).includes(t)).join(', ')})`];
    if (unitPct <= -5) reasons.push(`${Math.abs(Math.round(unitPct))}% cheaper ${unitPriceLabel(c)}`); else if (unitPct >= 5) reasons.push(`${Math.round(unitPct)}% pricier ${unitPriceLabel(c)}`);
    if (brandPref) reasons.push(c.brand === product.brand ? 'Same brand' : 'One of your favourite brands');
    if (histIds.has(c.id)) reasons.push('You have bought this before');

    let nutrition;
    if (product.nutrition && c.nutrition) nutrition = { available: true, proteinDiffPer100: +(c.nutrition.protein - product.nutrition.protein).toFixed(1), sugarDiffPer100: +(c.nutrition.sugar - product.nutrition.sugar).toFixed(1), note: 'Per-100 values from seed data; compare, but do not treat as medical advice.' };
    else nutrition = { available: false, note: 'Nutrition data is missing for one or both products, so no nutritional equivalence is claimed.' };

    out.push({
      product: { ...c, unitPrice: Number(up.toFixed(2)) }, score: Number(score.toFixed(4)), reasons, nutrition,
      differences: { priceDiff: c.price - product.price, unitPriceDiffPct: Number(unitPct.toFixed(1)), packSize: `${amountLabel(c)} vs ${amountLabel(product)}`, packSizeDiff: c.packSize - product.packSize },
    });
  }
  out.sort((a, b) => b.score - a.score || a.product.slug.localeCompare(b.product.slug));
  return out.slice(0, limit);
}
export const priceNote = (s) => `${s.differences.priceDiff >= 0 ? '+' : '-'}${inr(Math.abs(s.differences.priceDiff))}`;
