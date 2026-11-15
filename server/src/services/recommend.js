// Deterministic hybrid recommender. No randomness, no model calls: every score is a weighted sum of
// documented components, and every reason string is generated from the numbers that produced it.
import { unitPrice, valueScores } from '../utils/units.js';
import { jaccard, purposeTags, dietOk, allergenOk, inr } from '../utils/text.js';

export const WEIGHTS = { content: 0.30, value: 0.20, discount: 0.10, popularity: 0.15, history: 0.15, budget: 0.10 };
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * @param products  full catalogue
 * @param ctx { cart:[productId], viewed:[productId], history:[{productId,qty}]|null (null = no consent/no data),
 *              prefs:{dietary,avoidAllergens,favouriteBrands}|null, budget:number|null, limit:number }
 */
export function recommend(products, ctx = {}) {
  const { cart = [], viewed = [], history = null, prefs = null, budget = null, limit = 8 } = ctx;
  const byId = new Map(products.map((p) => [p.id, p]));
  const values = valueScores(products);
  const maxPop = Math.max(...products.map((p) => p.rating * Math.log10(1 + p.ratingCount)), 1);

  const cartProducts = cart.map((id) => byId.get(id)).filter(Boolean);
  const viewedProducts = viewed.map((id) => byId.get(id)).filter(Boolean);
  const histCounts = new Map();
  for (const h of history || []) histCounts.set(h.productId, (histCounts.get(h.productId) || 0) + h.qty);
  const histCats = new Map();
  for (const [id, n] of histCounts) { const p = byId.get(id); if (p) histCats.set(p.category, (histCats.get(p.category) || 0) + n); }
  const maxHist = Math.max(...histCounts.values(), 1), totalHistCat = [...histCats.values()].reduce((a, b) => a + b, 0) || 1;

  const anchors = [...cartProducts, ...viewedProducts];
  const coldStart = anchors.length === 0 && histCounts.size === 0;
  const inCart = new Set(cart);

  const scored = [];
  for (const p of products) {
    if (p.stock <= 0 || inCart.has(p.id)) continue;
    if (prefs && (!dietOk(p, prefs.dietary) || !allergenOk(p, prefs.avoidAllergens))) continue;

    const comp = {}; const why = [];
    // content-based + session: similarity to cart / recently viewed
    if (anchors.length) {
      let best = 0, bestAnchor = null;
      for (const a of anchors) {
        const sim = (a.category === p.category ? 0.5 : 0) + (a.brand === p.brand ? 0.2 : 0) + 0.3 * jaccard(purposeTags(a), purposeTags(p));
        if (sim > best) { best = sim; bestAnchor = a; }
      }
      comp.content = clamp01(best);
      if (best >= 0.5 && bestAnchor) why.push({ w: comp.content * WEIGHTS.content, t: `Similar to ${bestAnchor.name} ${cartProducts.includes(bestAnchor) ? 'in your cart' : 'you viewed'} (${p.category === bestAnchor.category ? 'same category' : 'shared tags'})` });
    } else if (prefs?.favouriteBrands?.includes(p.brand)) {
      comp.content = 0.8; why.push({ w: 0.8 * WEIGHTS.content, t: `From ${p.brand}, one of your favourite brands` });
    } else comp.content = null;

    const v = values.get(p.slug);
    if (v != null) { comp.value = clamp01(v / 2); if (v >= 1.2) why.push({ w: comp.value * WEIGHTS.value, t: `Better value: ${Math.round((1 - 1 / v) * 100)}% cheaper per ${p.unit === 'pc' ? 'piece' : '100 ' + p.unit} than the typical ${p.category} item` }); } else comp.value = null;

    comp.discount = clamp01(p.discountPercent / 30);
    if (p.discountPercent >= 10) why.push({ w: comp.discount * WEIGHTS.discount, t: `${p.discountPercent}% off (MRP ${inr(p.mrp)})` });

    const pop = (p.rating * Math.log10(1 + p.ratingCount)) / maxPop;
    comp.popularity = clamp01(pop);
    if (p.rating >= 4.3 && p.ratingCount >= 100) why.push({ w: pop * WEIGHTS.popularity, t: `Rated ${p.rating} by ${p.ratingCount} shoppers` });

    if (history) {
      const own = (histCounts.get(p.id) || 0) / maxHist, cat = (histCats.get(p.category) || 0) / totalHistCat;
      comp.history = clamp01(0.7 * own + 0.3 * cat);
      if (histCounts.get(p.id)) why.push({ w: comp.history * WEIGHTS.history, t: `You've bought this ${histCounts.get(p.id)} time${histCounts.get(p.id) > 1 ? 's' : ''} before` });
      else if (cat >= 0.25) why.push({ w: comp.history * WEIGHTS.history, t: `Matches your usual ${p.category} purchases` });
    } else comp.history = null;

    if (budget) {
      comp.budget = p.price <= budget * 0.25 ? 1 : clamp01(1 - (p.price - budget * 0.25) / (budget * 0.75));
      if (p.price <= budget * 0.1) why.push({ w: comp.budget * WEIGHTS.budget, t: `Fits your ${inr(budget)} budget (${inr(p.price)})` });
    } else comp.budget = null;

    if (prefs?.dietary?.length) why.push({ w: 0.0001, t: `Matches your ${prefs.dietary.join(', ')} preference` });

    // renormalise over components that actually apply, so missing data never counts as a zero
    let num = 0, den = 0;
    for (const [k, w] of Object.entries(WEIGHTS)) if (comp[k] != null) { num += comp[k] * w; den += w; }
    const score = den ? num / den : 0;
    if (coldStart && p.ratingCount >= 100) why.push({ w: 0.0002, t: 'Popular with shoppers' });

    why.sort((a, b) => b.w - a.w);
    const reasons = why.slice(0, 3).map((x) => x.t);
    scored.push({ product: p, score: Number(score.toFixed(4)), reasons: reasons.length ? reasons : ['Good overall rating and availability'], breakdown: comp });
  }
  scored.sort((a, b) => b.score - a.score || a.product.slug.localeCompare(b.product.slug));
  return {
    method: 'rule-based hybrid (content + session + history + value + budget). Not an AI model.',
    strategy: coldStart ? 'cold-start' : history ? 'personalised' : 'session',
    weights: WEIGHTS,
    recommendations: scored.slice(0, limit).map((s) => ({ ...s, product: { ...s.product, unitPrice: Number(unitPrice(s.product)?.toFixed(2)) } })),
  };
}
