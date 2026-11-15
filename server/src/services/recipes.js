import { recipes as LOCAL } from '../data/recipes.js';
import { dietOk, allergenOk, inr } from '../utils/text.js';

export const localRecipes = LOCAL;
const FILLER = new Set('i want to cook make plan recipe recipes for the and with of a an some me my please can you give how people person persons under within budget rs inr rupees dish eat have like prepare today tonight dinner lunch breakfast veg vegetarian vegan in on is it something what shall let lets us we need get show suggest tell about family servings serving ingredients ingredient items list shopping at home using use from do does'.split(' '));
const stem = (w) => (w.length > 3 ? w.replace(/(es|s)$/, '') : w);
const tokens = (s) => (s.toLowerCase().match(/[a-z]+/g) || []).map(stem);
const contentWords = (q) => tokens(q).filter((w) => !FILLER.has(w) && !FILLER.has(w + 's') && w.length > 1);

// Exact-ish match: an alias appears in the query, or EVERY content word of the query is in the recipe's name/aliases.
export function findRecipe(query, list = LOCAL) {
  const q = query.toLowerCase(), cw = contentWords(q); let best = null, bestScore = 0; const allWords = [];
  for (const r of list) {
    let s = 0;
    for (const a of [r.name.toLowerCase(), ...r.aliases]) if (q.includes(a)) s = Math.max(s, 10 + a.length / 100);
    if (s > bestScore) { best = r; bestScore = s; }
    if (!s && cw.length) { const rt = new Set(tokens(`${r.name} ${r.aliases.join(' ')}`)); if (cw.every((w) => rt.has(w))) allWords.push(r); }
  }
  if (best) return best;
  return allWords.length === 1 ? allWords[0] : null; // several candidates = ambiguous ("potatoes"), so show suggestions instead
}

// Looser search for suggestions: matches names/aliases and ingredient names ("what can I cook with potatoes").
export function searchRecipes(query, n = 6, list = LOCAL) {
  const cw = contentWords(query);
  const scored = list.map((r) => {
    const nameT = new Set(tokens(`${r.name} ${r.aliases.join(' ')}`)), ingT = new Set(r.ingredients.flatMap((i) => tokens(i.label)));
    return { r, s: cw.reduce((t, w) => t + (nameT.has(w) ? 3 : 0) + (ingT.has(w) ? 1 : 0), 0) };
  }).filter((x) => x.s > 0 || !cw.length).sort((a, b) => b.s - a.s || a.r.slug.localeCompare(b.r.slug));
  return scored.slice(0, n).map((x) => x.r);
}

const PANTRY = new Set(['sunflower-oil-1-l', 'iodised-salt-1-kg', 'turmeric-powder-200-g', 'garam-masala-100-g', 'soy-sauce-200-ml', 'sugar-1-kg']);
export const recipeThumbs = (r) => [...new Set(r.ingredients.filter((i) => i.slugs && !PANTRY.has(i.slugs[0])).map((i) => i.slugs[0].replace(/-(1|5)-kg$/, '-1-kg')))].slice(0, 3).map((s) => `/images/products/${s}.svg`);

// Match one ingredient to the cheapest eligible in-stock product (by cost to buy enough).
function matchIngredient(ing, products, { diet, avoid }) {
  const pool = products.filter((p) => {
    if (ing.slugs ? !ing.slugs.includes(p.slug) : !looseMatch(ing.label, p)) return false;
    return p.unit === ing.unit && dietOk(p, diet) && allergenOk(p, avoid);
  });
  if (!pool.length) return { status: 'unavailable', reason: 'No matching product in the catalogue' };
  const options = pool.map((p) => { const units = Math.ceil(ing.qty / p.packSize); return { p, units, cost: units * p.price }; });
  const inStock = options.filter((o) => o.p.stock >= o.units).sort((a, b) => a.cost - b.cost || a.p.slug.localeCompare(b.p.slug));
  if (!inStock.length) return { status: 'unavailable', reason: 'Matching products are out of stock (or not enough stock)' };
  const { p, units, cost } = inStock[0];
  return { status: 'matched', product: p, units, buyCost: cost, usedCost: Number(((ing.qty / p.packSize) * p.price).toFixed(2)), extra: units * p.packSize - ing.qty };
}
const looseMatch = (label, p) => { const w = tokens(label); return w.length > 0 && w.every((t) => `${p.name} ${p.tags.join(' ')}`.toLowerCase().includes(t.replace(/s$/, ''))); };

export function buildRecipePlan({ recipe, servings, products, pantry = [], diet = [], avoid = [], budget = null }) {
  const factor = servings / recipe.servings;
  const pantryTerms = pantry.map((x) => x.toLowerCase().trim()).filter(Boolean);
  const dietConflict = diet.filter((d) => !recipe.dietary.includes(d) && !(d === 'vegetarian' && recipe.dietary.includes('vegan')));
  const lines = recipe.ingredients.map((ing) => {
    const qty = Math.round(ing.qty * factor * 10) / 10, scaled = { ...ing, qty: ing.unit === 'pc' ? Math.max(1, Math.round(ing.qty * factor)) : qty };
    const have = pantryTerms.some((t) => ing.label.toLowerCase().includes(t) || t.includes(ing.label.toLowerCase()));
    const base = { label: ing.label, needed: { qty: scaled.qty, unit: ing.unit }, optional: !!ing.optional };
    if (have) return { ...base, status: 'have-it' };
    return { ...base, ...matchIngredient(scaled, products, { diet, avoid }) };
  });
  const matched = lines.filter((l) => l.status === 'matched');
  const buyCost = matched.reduce((t, l) => t + l.buyCost, 0), usedCost = matched.reduce((t, l) => t + l.usedCost, 0);
  return {
    recipe: { slug: recipe.slug, name: recipe.name, meal: recipe.meal, minutes: recipe.minutes, steps: recipe.steps, dietary: recipe.dietary, source: recipe.source || 'local-catalogue' },
    servings, lines,
    unavailable: lines.filter((l) => l.status === 'unavailable').map((l) => l.label),
    haveIt: lines.filter((l) => l.status === 'have-it').map((l) => l.label),
    cost: { buyCost, usedCostEstimate: Number(usedCost.toFixed(2)), currency: 'INR' },
    budget: budget == null ? null : { limit: budget, fitsBuyCost: buyCost <= budget, fitsUsedCost: usedCost <= budget, buyOverBy: Math.max(0, buyCost - budget) },
    dietWarning: dietConflict.length ? `This recipe is not labelled ${dietConflict.join(', ')}.` : null,
    disclaimer: 'Costs are estimates from current catalogue prices and are confirmed only at checkout. "Buy cost" is what goes in your cart (whole packs); "used cost" prorates only the amount the recipe needs.',
  };
}

// Merge several (recipe, times) into one aggregate need list, then match once (shared pantry items bought once).
export function buildMealPlan({ picks, servings, products, diet, avoid, budget }) {
  const merged = new Map();
  for (const { recipe, times } of picks) for (const ing of recipe.ingredients) {
    const k = ing.label, qty = ing.qty * (servings / recipe.servings) * times;
    merged.set(k, merged.has(k) ? { ...merged.get(k), qty: merged.get(k).qty + qty } : { ...ing, qty });
  }
  const lines = [...merged.values()].map((ing) => ({ label: ing.label, needed: { qty: Math.round(ing.qty * 10) / 10, unit: ing.unit }, ...matchIngredient({ ...ing, qty: ing.unit === 'pc' ? Math.ceil(ing.qty) : ing.qty }, products, { diet, avoid }) }));
  const buyCost = lines.filter((l) => l.status === 'matched').reduce((t, l) => t + l.buyCost, 0);
  return { lines, buyCost, unavailable: lines.filter((l) => l.status === 'unavailable').map((l) => l.label), fitsBudget: budget == null || buyCost <= budget };
}

// Chooses recipes for N days of the requested meals. Deterministic enumeration; prefers variety, then lower cost.
export function planMeals({ days, servings, budget, meals = ['breakfast', 'dinner'], products, diet = [], avoid = [] }) {
  const ok = (r) => diet.every((d) => r.dietary.includes(d) || (d === 'vegetarian' && r.dietary.includes('vegan')));
  const pool = (meal) => LOCAL.filter((r) => r.meal === meal && ok(r));
  const options = meals.map((m) => { const p = pool(m); const out = p.map((r) => [{ recipe: r, times: days }]); for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) { const a = Math.ceil(days / 2); out.push([{ recipe: p[i], times: a }, { recipe: p[j], times: days - a }]); } return out; });
  if (options.some((o) => !o.length)) return { error: `No ${diet.join('/')} recipes available for ${meals.filter((_, i) => !options[i].length).join(', ')} in the local catalogue.` };
  let best = null; const combos = options.reduce((acc, o) => acc.flatMap((a) => o.map((x) => [...a, ...x])), [[]]);
  for (const picks of combos) {
    const plan = buildMealPlan({ picks, servings, products, diet, avoid, budget });
    if (plan.unavailable.length) continue;
    const variety = picks.length, cand = { picks, plan, variety, fits: plan.fitsBudget };
    const better = !best || (cand.fits && !best.fits) || (cand.fits === best.fits && (cand.fits ? (variety > best.variety || (variety === best.variety && plan.buyCost < best.plan.buyCost)) : plan.buyCost < best.plan.buyCost));
    if (better) best = cand;
  }
  if (!best) return { error: 'Could not build a plan: required ingredients are unavailable.' };
  return {
    days, servings, budget, fitsBudget: best.fits, buyCost: best.plan.buyCost, lines: best.plan.lines,
    meals: best.picks.map(({ recipe, times }) => ({ slug: recipe.slug, name: recipe.name, meal: recipe.meal, times })),
    note: best.fits ? `Estimated ${inr(best.plan.buyCost)} of whole packs, within your ${inr(budget)}.` : `Cheapest plan found costs ${inr(best.plan.buyCost)}, which is over your ${inr(budget)}.`,
    disclaimer: 'Estimate from current catalogue prices; whole packs are priced, so leftovers will remain. Final prices are confirmed at checkout.',
  };
}
