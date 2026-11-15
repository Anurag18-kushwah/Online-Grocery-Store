// Builds seed users/orders in a store-independent way (used by `npm run seed` and local mode).
import bcrypt from 'bcryptjs';
import { products, categories } from '../data/seedProducts.js';

export const DEMO_USER = { email: 'demo@grocerai.dev', password: 'Demo@1234' };
export const DEMO_ADMIN = { email: 'admin@grocerai.dev', password: 'Admin@123' };

// Populates any store implementing the shared contract.
export async function seedStore(store, { reset = false } = {}) {
  if (reset) throw new Error('reset must be handled by the caller');
  for (const c of categories) await store.upsertCategory(c);
  const bySlug = {};
  for (const p of products) { const doc = await store.createProduct(p); bySlug[p.slug] = doc; }

  const demo = await store.createUser({ name: 'Demo Shopper', email: DEMO_USER.email, passwordHash: bcrypt.hashSync(DEMO_USER.password, 10), role: 'user',
    addresses: [{ id: 'home', label: 'Home', line1: '12 Green Park Road', city: 'New Delhi', pincode: '110016' }] });
  await store.createUser({ name: 'Store Admin', email: DEMO_ADMIN.email, passwordHash: bcrypt.hashSync(DEMO_ADMIN.password, 10), role: 'admin' });
  await store.setPrefs(demo.id, { dietary: ['vegetarian'], avoidAllergens: [], favouriteBrands: ['DailyDairy', 'GoldenGrain'], monthlyBudget: 6000, personalisationConsent: true });

  // Genuine purchase history for the demo account (real order records, so personalisation has data).
  const history = [
    [['toned-milk-1-l', 4], ['fresh-paneer', 2], ['basmati-rice-1-kg', 1], ['toor-dal-1-kg', 1], ['onions', 1]],
    [['toned-milk-1-l', 3], ['set-curd', 2], ['rolled-oats-1-kg', 1], ['robusta-bananas', 1], ['fresh-paneer', 1]],
    [['toned-milk-1-l', 4], ['fresh-paneer', 2], ['whole-wheat-atta-5-kg', 1], ['fresh-tomatoes', 2], ['roasted-chana', 2]],
  ];
  for (const lines of history) {
    const items = lines.map(([s, qty]) => ({ productId: bySlug[s].id, name: bySlug[s].name, unitPrice: bySlug[s].price, qty }));
    await store.createOrder({ userId: demo.id, items, total: items.reduce((t, i) => t + i.unitPrice * i.qty, 0), payment: { method: 'mock', status: 'paid-mock' }, address: demo.addresses[0] });
  }
}
