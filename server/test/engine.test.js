import test from 'node:test';
import assert from 'node:assert/strict';
import { products as seed } from '../src/data/seedProducts.js';
import { recommend } from '../src/services/recommend.js';
import { analyzeBasket, missingForPlan } from '../src/services/optimizer.js';
import { substitutesFor } from '../src/services/substitutes.js';
import { buildRecipePlan, findRecipe, planMeals, localRecipes } from '../src/services/recipes.js';
import { parseQuery } from '../src/services/nlQuery.js';

const P = seed.map((p, i) => ({ ...p, id: `id${i}` }));
const by = (slug) => P.find((p) => p.slug === slug);

// ---- recommender on a tiny known dataset ----
const mk = (o) => ({ category: 'x', brand: 'B0', discountPercent: 0, stock: 5, unit: 'g', packSize: 100, price: 100, dietaryLabels: ['vegetarian'], allergens: [], tags: [], rating: 4, ratingCount: 50, mrp: 100, ...o });
const T = [
  mk({ id: 'a', slug: 'a', name: 'Alpha', tags: ['t1', 't2'], brand: 'B1' }),
  mk({ id: 'b', slug: 'b', name: 'Beta', tags: ['t1', 't2'], brand: 'B1' }),
  mk({ id: 'c', slug: 'c', name: 'Gamma', category: 'y', tags: ['z'] }),
  mk({ id: 'd', slug: 'd', name: 'Delta', tags: ['t1'], stock: 0 }),
  mk({ id: 'e', slug: 'e', name: 'Eps', tags: ['t1'], dietaryLabels: [] }),
];
test('session rec: item similar to cart outranks unrelated item, with real reason', () => {
  const r = recommend(T, { cart: ['a'] });
  assert.equal(r.recommendations[0].product.id, 'b');
  assert.match(r.recommendations[0].reasons[0], /Similar to Alpha in your cart/);
  assert.ok(!r.recommendations.some((x) => x.product.id === 'a' || x.product.id === 'd')); // in cart / out of stock excluded
  assert.equal(r.strategy, 'session');
});
test('dietary preference is a hard filter', () => {
  const r = recommend(T, { prefs: { dietary: ['vegetarian'], avoidAllergens: [] } });
  assert.ok(!r.recommendations.some((x) => x.product.id === 'e'));
});
test('history only influences results when supplied (consent) and is explained', () => {
  const without = recommend(T, { history: null });
  assert.ok(without.recommendations.every((x) => x.breakdown.history == null));
  const withH = recommend(T, { history: [{ productId: 'c', qty: 4 }, { productId: 'a', qty: 1 }] });
  assert.equal(withH.strategy, 'personalised');
  assert.equal(withH.recommendations[0].product.id, 'c');
  assert.match(withH.recommendations[0].reasons.join(' '), /bought this 4 times/);
});
test('cold start works and the engine is deterministic', () => {
  const a = recommend(P, {}), b = recommend(P, {});
  assert.equal(a.strategy, 'cold-start'); assert.deepEqual(a, b);
  assert.ok(a.recommendations.every((x) => x.reasons.length > 0 && x.product.stock > 0));
  assert.match(a.method, /Not an AI model/);
});

// ---- basket optimizer ----
test('budget maths and pack-size saving (5 x 1 kg rice -> one 5 kg bag)', () => {
  const rice1 = by('basmati-rice-1-kg'), rice5 = by('basmati-rice-5-kg');
  assert.equal(rice1.price, 150); assert.equal(rice5.price, 650);
  const r = analyzeBasket({ lines: [{ product: rice1, qty: 5 }], products: P, budget: 500 });
  assert.equal(r.total, 750); assert.equal(r.remaining, -250); assert.equal(r.overBudget, true);
  const s = r.suggestions[0];
  assert.equal(s.toProduct.slug, 'basmati-rice-5-kg'); assert.equal(s.toQty, 1); assert.equal(s.saving, 100); assert.equal(s.type, 'pack-size');
  assert.ok(s.requiresApproval);
  assert.equal(r.projectedTotal, 650);
  assert.equal(r.pathToBudget.reachesBudget, false); assert.equal(r.pathToBudget.shortfall, 150); // honest: cannot reach 500
});
test('no saving => no suggestion (3 x 1 kg = 450 < one 5 kg bag at 650)', () => {
  const r = analyzeBasket({ lines: [{ product: by('basmati-rice-1-kg'), qty: 3 }], products: P });
  assert.equal(r.suggestions.length, 0);
});
test('duplicates and avoid-list conflicts are detected from declared data', () => {
  const r = analyzeBasket({ lines: [{ product: by('basmati-rice-1-kg'), qty: 1 }, { product: by('basmati-rice-5-kg'), qty: 1 }, { product: by('peanut-butter-crunchy'), qty: 1 }], products: P, goals: { avoid: ['peanut'] } });
  assert.equal(r.duplicates.length, 1);
  assert.deepEqual(r.conflicts.map((c) => c.name), ['Peanut Butter Crunchy']);
});
test('within-budget basket reports remaining', () => {
  const r = analyzeBasket({ lines: [{ product: by('onions'), qty: 2 }], products: P, budget: 500 });
  assert.equal(r.total, 90); assert.equal(r.remaining, 410); assert.equal(r.pathToBudget, null);
});

// ---- substitution ----
test('substitutes: ranked, diet-safe, show differences; none fabricated when none qualify', () => {
  const subs = substitutesFor(by('basmati-rice-5-kg'), P);
  assert.equal(subs[0].product.slug, 'basmati-rice-1-kg');
  assert.equal(subs[0].differences.unitPriceDiffPct > 0, true); // 1 kg bag is pricier per 100 g
  assert.equal(subs[0].nutrition.available, true);
  assert.deepEqual(substitutesFor(by('fresh-paneer'), P), []); // eggs not vegetarian => excluded
  const noNutri = substitutesFor(by('instant-noodles-4-pack'), P);
  assert.ok(noNutri.every((s) => s.nutrition.available === false));
});

// ---- recipes ----
test('paneer fried rice for 4 under Rs300: exact costs, pantry, honest budget status', () => {
  const recipe = findRecipe('Plan vegetarian paneer fried rice for four people under ₹300');
  assert.equal(recipe.slug, 'paneer-fried-rice');
  const plan = buildRecipePlan({ recipe, servings: 4, products: P, pantry: ['oil', 'salt', 'soy sauce'], diet: ['vegetarian'], budget: 300 });
  assert.deepEqual(plan.haveIt.sort(), ['Salt', 'Soy sauce', 'Sunflower oil']);
  assert.equal(plan.cost.buyCost, 150 + 98 + 52 + 44 + 30);
  assert.equal(plan.cost.usedCostEstimate, 193.5);
  assert.equal(plan.budget.fitsBuyCost, false); assert.equal(plan.budget.fitsUsedCost, true); assert.equal(plan.budget.buyOverBy, 74);
});
test('servings scale and unavailable ingredients are never fabricated', () => {
  const recipe = localRecipes[0];
  const x2 = buildRecipePlan({ recipe, servings: 8, products: P });
  assert.equal(x2.lines.find((l) => l.label === 'Paneer').units, 2);
  const noPaneer = P.map((p) => (p.slug === 'fresh-paneer' ? { ...p, stock: 0 } : p));
  const plan = buildRecipePlan({ recipe, servings: 4, products: noPaneer });
  assert.deepEqual(plan.unavailable, ['Paneer']);
  assert.equal(plan.lines.find((l) => l.label === 'Paneer').product, undefined);
  const vegan = buildRecipePlan({ recipe, servings: 4, products: P, diet: ['vegan'] });
  assert.ok(vegan.unavailable.includes('Paneer')); assert.match(vegan.dietWarning, /vegan/);
});
test('missing-ingredient detection against a basket', () => {
  const plan = buildRecipePlan({ recipe: localRecipes[0], servings: 4, products: P });
  const miss = missingForPlan(plan, [by('fresh-paneer').id]);
  assert.ok(!miss.some((m) => m.label === 'Paneer')); assert.ok(miss.length >= 6);
});
test('meal planner: invariants hold for feasible and infeasible budgets', () => {
  const ok = planMeals({ days: 3, servings: 2, budget: 700, products: P, diet: ['vegetarian'] });
  assert.equal(ok.buyCost, ok.lines.filter((l) => l.status === 'matched').reduce((t, l) => t + l.buyCost, 0));
  assert.equal(ok.fitsBudget, ok.buyCost <= 700);
  assert.ok(ok.lines.filter((l) => l.status === 'matched').every((l) => l.product.stock >= l.units && l.product.dietaryLabels.includes('vegetarian')));
  const tight = planMeals({ days: 3, servings: 2, budget: 50, products: P, diet: ['vegetarian'] });
  assert.equal(tight.fitsBudget, false); assert.match(tight.note, /over your/);
});

// ---- natural language ----
test('NL parser handles the spec example queries', () => {
  let r = parseQuery('Find vegetarian snacks under ₹200.');
  assert.deepEqual(r.filters, { maxPrice: 200, categories: ['snacks'], diet: ['vegetarian'] });
  r = parseQuery('Show high-protein breakfast products.');
  assert.deepEqual(r.filters, { q: 'breakfast', minProtein: 10 });
  assert.equal(parseQuery('Find cheaper alternatives to my current basket.').intent, 'basket');
  r = parseQuery('Give me ingredients for a family dinner within ₹500.');
  assert.equal(r.intent, 'mealplan'); assert.equal(r.entities.servings, 4); assert.equal(r.entities.budget, 500);
  r = parseQuery('I have ₹700 for breakfast and dinner groceries for three days. Suggest a vegetarian shopping list.');
  assert.deepEqual([r.intent, r.entities.days, r.entities.budget, r.filters.diet], ['mealplan', 3, 700, ['vegetarian']]);
  r = parseQuery('peanut-free low sugar snacks between 50 and 150');
  assert.deepEqual(r.filters, { minPrice: 50, maxPrice: 150, categories: ['snacks'], excludeAllergens: ['peanut'], maxSugar: 5 });
});
