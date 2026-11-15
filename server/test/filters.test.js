import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters } from '../src/services/filters.js';
import { unitPrice, valueScores } from '../src/utils/units.js';

const mk = (o) => ({ category: 'snacks', brand: 'A', discountPercent: 0, stock: 10, unit: 'g', packSize: 100, dietaryLabels: ['vegetarian'], allergens: [], tags: [], rating: 4, ratingCount: 10, nutrition: null, expiryDate: null, deliveryMinutes: 15, ...o });
const NOW = new Date('2026-10-16T00:00:00Z');
const data = [
  mk({ slug: 'a', name: 'Chips', price: 20, packSize: 50, tags: ['chips'] }),                       // 40 / 100g
  mk({ slug: 'b', name: 'Peanuts', price: 40, packSize: 200, dietaryLabels: ['vegetarian', 'vegan'], allergens: ['peanut'], nutrition: { protein: 24, sugar: 3 }, discountPercent: 10 }), // 20 / 100g
  mk({ slug: 'c', name: 'Choc Bar', price: 150, packSize: 100, stock: 0, nutrition: { protein: 8, sugar: 24 }, rating: 4.8, ratingCount: 100 }),
  mk({ slug: 'd', name: 'Meat Jerky', price: 180, dietaryLabels: [], category: 'meat' }),
  mk({ slug: 'e', name: 'Eggs', price: 54, unit: 'pc', packSize: 6, category: 'dairy', expiryDate: '2026-10-30T00:00:00Z' }),
];
const slugs = (r) => r.products.map((p) => p.slug);

test('unit price: per 100g and per piece', () => {
  assert.equal(unitPrice(data[0]), 40);
  assert.equal(unitPrice(data[4]), 9);
});
test('price range + diet combine (AND)', () => {
  assert.deepEqual(slugs(applyFilters(data, { maxPrice: 200, diet: 'vegetarian', sort: 'price-asc' }, NOW)), ['a', 'b', 'e', 'c']);
  assert.deepEqual(slugs(applyFilters(data, { diet: 'vegan' }, NOW)), ['b']);
});
test('allergen exclusion and in-stock', () => {
  assert.ok(!slugs(applyFilters(data, { excludeAllergens: 'peanut' }, NOW)).includes('b'));
  assert.ok(!slugs(applyFilters(data, { inStock: 'true' }, NOW)).includes('c'));
});
test('nutrition filters only match products WITH data and report exclusions', () => {
  const r = applyFilters(data, { minProtein: 10 }, NOW);
  assert.deepEqual(slugs(r), ['b']);
  assert.equal(r.excludedForMissingData, 3); // a, d, e have no nutrition data
});
test('shelf-life filter needs real expiry data', () => {
  const r = applyFilters(data, { minShelfLifeDays: 7 }, NOW);
  assert.deepEqual(slugs(r), ['e']);
});
test('sorting is deterministic', () => {
  assert.deepEqual(slugs(applyFilters(data, { sort: 'discount' }, NOW))[0], 'b');
  assert.deepEqual(slugs(applyFilters(data, { sort: 'rating' }, NOW))[0], 'c');
  assert.deepEqual(slugs(applyFilters(data, { sort: 'price-desc' }, NOW))[0], 'd');
});
test('value score: cheaper per unit than category median scores > 1', () => {
  const v = valueScores(data.filter((p) => p.category === 'snacks')); // unit prices 40, 20, 150 -> median 40
  assert.equal(v.get('b'), 2);
  assert.equal(v.get('a'), 1);
  assert.ok(v.get('c') < 1);
});
test('invalid or unknown filters are rejected, not passed through', () => {
  assert.throws(() => applyFilters(data, { maxPrice: 'abc' }));
  assert.throws(() => applyFilters(data, { $where: 'evil()' }));
  assert.throws(() => applyFilters(data, { sort: 'drop-table' }));
});
