// Same assertions run against every available store implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/services/storeFactory.js';
import { seedStore } from '../src/services/seedData.js';
import { Product, Category, User, UserPreference, Cart, Wishlist, Order } from '../src/models/index.js';

const targets = [{ name: 'local', make: () => createStore({ mode: 'local', file: null }) }];
if (process.env.MONGO_TEST_URI) targets.push({ name: 'mongo', make: async () => {
  const s = await createStore({ mode: 'mongo', mongoUri: process.env.MONGO_TEST_URI });
  await Promise.all([Product, Category, User, UserPreference, Cart, Wishlist, Order].map((m) => m.deleteMany({})));
  await seedStore(s); return s;
} });

for (const { name, make } of targets) {
  test(`store contract [${name}]`, async (t) => {
    const s = await make();
    t.after(() => s.close());
    const prods = await s.allProducts();
    assert.equal(prods.length, 56);
    assert.ok(prods.every((p) => typeof p.id === 'string' && p.id.length > 5));

    await t.test('slug and id lookup', async () => {
      const bySlug = await s.getProduct('fresh-paneer');
      assert.equal(bySlug.name, 'Fresh Paneer');
      assert.equal((await s.getProduct(bySlug.id)).slug, 'fresh-paneer');
      assert.equal(await s.getProduct('nope'), null);
    });
    await t.test('users', async () => {
      const u = await s.findUserByEmail('DEMO@grocerai.dev');
      assert.equal(u.role, 'user');
      assert.equal((await s.findUserById(u.id)).email, 'demo@grocerai.dev');
      await assert.rejects(() => s.createUser({ name: 'x', email: 'demo@grocerai.dev', passwordHash: 'h' })); // unique
      assert.equal((await s.getPrefs(u.id)).personalisationConsent, true);
    });
    await t.test('cart, wishlist, orders round-trip', async () => {
      const p = await s.getProduct('onions');
      await s.setCart('g:abc', [{ productId: p.id, qty: 2 }]);
      assert.deepEqual(await s.getCart('g:abc'), [{ productId: p.id, qty: 2 }]);
      await s.deleteCart('g:abc'); assert.deepEqual(await s.getCart('g:abc'), []);
      const u = await s.findUserByEmail('demo@grocerai.dev');
      await s.setWishlist(u.id, [p.id]); assert.deepEqual(await s.getWishlist(u.id), [p.id]);
      assert.equal((await s.ordersByUser(u.id)).length, 3);
    });
    await t.test('stock reservation is all-or-nothing', async () => {
      const a = await s.getProduct('onions'), b = await s.getProduct('fresh-paneer');
      const before = [a.stock, b.stock];
      const bad = await s.reserveStock([{ productId: a.id, qty: 1 }, { productId: b.id, qty: b.stock + 1 }]);
      assert.equal(bad.ok, false); assert.equal(bad.problems[0].productId, b.id);
      assert.equal((await s.getProduct('onions')).stock, before[0]); // rolled back / untouched
      assert.equal((await s.reserveStock([{ productId: a.id, qty: 3 }])).ok, true);
      assert.equal((await s.getProduct('onions')).stock, before[0] - 3);
    });
    await t.test('product CRUD', async () => {
      const c = await s.createProduct({ slug: 'test-item', name: 'Test Item', category: 'snacks', brand: 'T', mrp: 10, price: 10, unit: 'pc', packSize: 1, stock: 5 });
      assert.equal((await s.updateProduct(c.id, { price: 12 })).price, 12);
      assert.equal(await s.deleteProduct(c.id), true);
      assert.equal(await s.getProduct('test-item'), null);
    });
  });
}
