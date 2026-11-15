import test from 'node:test';
import assert from 'node:assert/strict';
import { targets, boot } from './helpers.js';
import { products } from '../src/data/seedProducts.js';

for (const { name, make } of targets) {
  test(`API end-to-end [${name}]`, async (t) => {
    const store = await make(); const app = await boot(store); const { call } = app; t.after(app.close);
    const G = 'guest-test-0001';
    const login = async (email, password) => (await call('POST', '/api/auth/login', { body: { email, password } })).body;
    const bySlug = async (slug) => (await call('GET', `/api/products/${slug}`)).body.product;
    const addr = { label: 'Home', line1: '1 Test Street', city: 'Delhi', pincode: '110001' };

    await t.test('health + catalogue + filters + bad input', async () => {
      const h = await call('GET', '/api/health'); assert.equal(h.body.store, name); assert.equal(h.body.ai, 'fallback-only');
      const all = await call('GET', '/api/products'); assert.equal(all.body.total, 56);
      const f = await call('GET', '/api/products?maxPrice=200&categories=snacks&diet=vegan');
      assert.equal(f.body.total, products.filter((p) => p.price <= 200 && p.category === 'snacks' && p.dietaryLabels.includes('vegan')).length);
      assert.equal((await call('GET', '/api/products?maxPrice=abc')).status, 400);
      assert.equal((await call('GET', '/api/products?$where=1')).status, 400);
      assert.equal((await call('POST', '/api/auth/login', { raw: '{bad json' })).status, 400);
      assert.equal((await call('GET', '/api/products/nope')).status, 404);
    });

    await t.test('registration, login, hashing, validation', async () => {
      assert.equal((await call('POST', '/api/auth/register', { body: { name: 'A', email: 'bad', password: '1' } })).status, 400);
      const ok = await call('POST', '/api/auth/register', { body: { name: 'Test User', email: 'Test@Example.com', password: 'Passw0rd!x' } });
      assert.equal(ok.status, 201); assert.ok(ok.body.token); assert.equal(ok.body.user.role, 'user'); assert.equal(ok.body.user.passwordHash, undefined);
      assert.equal((await call('POST', '/api/auth/register', { body: { name: 'Test User', email: 'test@example.com', password: 'Passw0rd!x' } })).status, 409);
      assert.equal((await call('POST', '/api/auth/login', { body: { email: 'test@example.com', password: 'wrongwrong' } })).status, 401);
      const stored = await store.findUserByEmail('test@example.com'); assert.notEqual(stored.passwordHash, 'Passw0rd!x'); assert.match(stored.passwordHash, /^\$2[aby]\$/);
      assert.equal((await call('GET', '/api/auth/me', { token: ok.body.token })).body.user.email, 'test@example.com');
      assert.equal((await call('GET', '/api/auth/me', { token: 'garbage' })).status, 401);
    });

    await t.test('guest cart, stock clamp, merge on login', async () => {
      assert.equal((await call('GET', '/api/cart')).status, 400); // no guest id
      const onion = await bySlug('onions'), paneer = await bySlug('fresh-paneer'), oos = await bySlug('nagpur-oranges');
      let r = await call('POST', '/api/cart/changes', { guest: G, body: { changes: [{ productId: onion.id, qty: 2 }, { productId: paneer.id, qty: 1, mode: 'add' }] } });
      assert.equal(r.body.total, 45 * 2 + 98); assert.equal(r.body.count, 3);
      r = await call('POST', '/api/cart/changes', { guest: G, body: { changes: [{ productId: oos.id, qty: 1 }] } });
      assert.equal(r.body.items.length, 2); assert.match(r.body.warnings[0], /Only 0/); // out of stock cannot be added
      assert.equal((await call('POST', '/api/cart/changes', { guest: G, body: { changes: [{ productId: onion.id, qty: -1 }] } })).status, 400);
      const tok = (await login('test@example.com', 'Passw0rd!x')).token;
      const merged = await call('POST', '/api/cart/merge', { token: tok, body: { guestId: G } });
      assert.equal(merged.body.count, 3); assert.equal((await call('GET', '/api/cart', { guest: G })).body.count, 0);
    });

    await t.test('checkout validates stock, reserves it, creates the order, clears the cart', async () => {
      const tok = (await login('test@example.com', 'Passw0rd!x')).token;
      assert.equal((await call('POST', '/api/orders', { token: tok, body: { address: addr } })).status, 201);
      const before = (await bySlug('onions')).stock; // order above consumed the merged cart
      assert.equal((await call('GET', '/api/cart', { token: tok })).body.count, 0);
      const orders = (await call('GET', '/api/orders', { token: tok })).body.orders;
      assert.equal(orders.length, 1); assert.equal(orders[0].total, 188); assert.equal(orders[0].payment.status, 'paid-mock');
      assert.equal(before, products.find((p) => p.slug === 'onions').stock - 2);
      assert.equal((await call('POST', '/api/orders', { token: tok, body: { address: addr } })).status, 400); // empty cart
      assert.equal((await call('POST', '/api/orders', { token: tok, body: { address: { ...addr, pincode: '12' } } })).status, 400);
    });

    await t.test('insufficient stock at checkout is rejected without side effects', async () => {
      const adminTok = (await login('admin@grocerai.dev', 'Admin@123')).token, tok = (await login('test@example.com', 'Passw0rd!x')).token;
      const butter = await bySlug('salted-butter');
      await call('POST', '/api/cart/changes', { token: tok, body: { changes: [{ productId: butter.id, qty: 5 }] } });
      await call('PATCH', `/api/admin/products/${butter.id}/stock`, { token: adminTok, body: { stock: 3 } });
      const r = await call('POST', '/api/orders', { token: tok, body: { address: addr } });
      assert.equal(r.status, 409); assert.equal(r.body.problems[0].available, 3);
      assert.equal((await bySlug('salted-butter')).stock, 3); assert.equal((await call('GET', '/api/cart', { token: tok })).body.count, 5);
      await call('DELETE', '/api/cart', { token: tok });
    });

    await t.test('authorization: users cannot reach admin or other users orders', async () => {
      const tok = (await login('test@example.com', 'Passw0rd!x')).token, demo = (await login('demo@grocerai.dev', 'Demo@1234')).token;
      assert.equal((await call('GET', '/api/admin/stats')).status, 401);
      assert.equal((await call('GET', '/api/admin/stats', { token: tok })).status, 403);
      assert.equal((await call('POST', '/api/admin/products', { token: tok, body: {} })).status, 403);
      const demoOrder = (await call('GET', '/api/orders', { token: demo })).body.orders[0];
      assert.equal((await call('GET', `/api/orders/${demoOrder.id}`, { token: tok })).status, 404);
      assert.equal((await call('GET', `/api/orders/${demoOrder.id}`, { token: demo })).status, 200);
    });

    await t.test('admin: stats from real orders, product CRUD, order lifecycle restores stock on cancel', async () => {
      const a = (await login('admin@grocerai.dev', 'Admin@123')).token, tok = (await login('test@example.com', 'Passw0rd!x')).token;
      const stats = (await call('GET', '/api/admin/stats', { token: a })).body;
      assert.equal(stats.orders, 4); assert.equal(stats.revenue, (await store.allOrders()).reduce((t2, o) => t2 + o.total, 0)); assert.ok(stats.topProducts.length > 0);
      const created = await call('POST', '/api/admin/products', { token: a, body: { name: 'Test Honey', category: 'staples', brand: 'Hive', mrp: 200, discountPercent: 25, stock: 10, unit: 'g', packSize: 250 } });
      assert.equal(created.status, 201); assert.equal(created.body.product.price, 150);
      assert.equal((await call('POST', '/api/admin/products', { token: a, body: { name: 'Test Honey', category: 'staples', brand: 'Hive', mrp: 200, stock: 10, unit: 'g', packSize: 250 } })).status, 409);
      assert.equal((await call('POST', '/api/admin/products', { token: a, body: { name: 'Bad', mrp: -1 } })).status, 400);
      const id = created.body.product.id;
      await call('POST', '/api/cart/changes', { token: tok, body: { changes: [{ productId: id, qty: 4 }] } });
      const o = (await call('POST', '/api/orders', { token: tok, body: { address: addr } })).body.order;
      assert.equal((await call('GET', `/api/products/${id}`)).body.product.stock, 6);
      assert.equal((await call('PATCH', `/api/admin/orders/${o.id}`, { token: a, body: { status: 'packed' } })).body.order.status, 'packed');
      assert.equal((await call('POST', `/api/orders/${o.id}/cancel`, { token: tok })).status, 409); // too late for the customer
      assert.equal((await call('PATCH', `/api/admin/orders/${o.id}`, { token: a, body: { status: 'cancelled' } })).body.order.status, 'cancelled');
      assert.equal((await call('GET', `/api/products/${id}`)).body.product.stock, 10); // stock restored
      assert.equal((await call('DELETE', `/api/admin/products/${id}`, { token: a })).status, 200);
    });

    await t.test('wishlist + profile + preferences', async () => {
      const tok = (await login('test@example.com', 'Passw0rd!x')).token; const p = await bySlug('set-curd');
      await call('PUT', `/api/wishlist/${p.id}`, { token: tok }); assert.equal((await call('GET', '/api/wishlist', { token: tok })).body.products[0].slug, 'set-curd');
      await call('DELETE', `/api/wishlist/${p.id}`, { token: tok }); assert.equal((await call('GET', '/api/wishlist', { token: tok })).body.products.length, 0);
      const up = await call('PUT', '/api/me', { token: tok, body: { name: 'Renamed', addresses: [addr], preferences: { dietary: ['vegan'], personalisationConsent: false } } });
      assert.equal(up.body.user.name, 'Renamed'); assert.equal(up.body.user.addresses.length, 1); assert.deepEqual(up.body.preferences.dietary, ['vegan']);
    });

    await t.test('AI features work with no LLM: recommend (consent-gated), optimize, recipe, chat', async () => {
      const demo = (await login('demo@grocerai.dev', 'Demo@1234')).token, noConsent = (await login('test@example.com', 'Passw0rd!x')).token;
      assert.equal((await call('GET', '/api/ai/status')).body.mode, 'fallback-only');
      const rec = (await call('POST', '/api/ai/recommend', { token: demo, body: {} })).body;
      assert.equal(rec.strategy, 'personalised'); assert.ok(rec.recommendations.every((x) => x.reasons.length)); assert.ok(rec.recommendations.every((x) => x.product.dietaryLabels.includes('vegetarian')));
      assert.ok(rec.recommendations.some((x) => /bought this/.test(x.reasons.join(' '))));
      const rec2 = (await call('POST', '/api/ai/recommend', { token: noConsent, body: {} })).body; assert.notEqual(rec2.strategy, 'personalised');
      const cold = (await call('POST', '/api/ai/recommend', { guest: 'guest-cold-0001', body: {} })).body; assert.equal(cold.strategy, 'cold-start');

      const rice = await bySlug('basmati-rice-1-kg');
      assert.equal((await call('POST', '/api/ai/optimize', { guest: 'guest-opt-00001', body: {} })).status, 400); // empty cart
      await call('POST', '/api/cart/changes', { guest: 'guest-opt-00001', body: { changes: [{ productId: rice.id, qty: 5 }] } });
      const opt = (await call('POST', '/api/ai/optimize', { guest: 'guest-opt-00001', body: { budget: 500 } })).body;
      assert.equal(opt.total, 750); assert.equal(opt.suggestions[0].saving, 100); assert.equal(opt.suggestions[0].requiresApproval, true);
      assert.equal((await call('GET', '/api/cart', { guest: 'guest-opt-00001' })).body.total, 750); // optimiser never changes the cart itself

      const rp = (await call('POST', '/api/ai/recipe', { guest: 'guest-opt-00001', body: { query: 'Plan vegetarian paneer fried rice for four people under ₹300', pantry: ['oil', 'salt', 'soy sauce'] } })).body;
      assert.equal(rp.plan.cost.buyCost, 374); assert.equal(rp.plan.budget.fitsBuyCost, false);
      assert.ok(rp.missingFromCart.length > 0);
      assert.equal((await call('POST', '/api/ai/recipe', { body: { query: 'quantum soufflé' } })).status, 404);

      const chat = async (m, guest = 'guest-opt-00001') => (await call('POST', '/api/ai/chat', { guest, body: { message: m } })).body;
      let c = await chat('Find vegetarian snacks under ₹200'); assert.equal(c.source, 'rule-based'); assert.ok(c.cards.products.length > 0 && c.cards.products.every((p) => p.price <= 200 && p.stock > 0));
      c = await chat('I have ₹700 for breakfast and dinner groceries for three days. Suggest a vegetarian shopping list.'); assert.ok(c.cards.mealplan); assert.match(c.assumptions.join(' '), /2 people/);
      c = await chat('Find cheaper alternatives to my current basket'); assert.ok(c.cards.optimizer);
      c = await chat('compare rolled oats and corn flakes'); assert.equal(c.cards.compare.length, 2);
      c = await chat('Find unicorn flavoured snacks'); assert.match(c.reply, /No products matched/);
      assert.match(c.limits, /cannot check live inventory/);
      assert.equal((await call('POST', '/api/ai/chat', { body: { message: '' } })).status, 400);
    });
  });
}
