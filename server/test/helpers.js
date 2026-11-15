import { createStore } from '../src/services/storeFactory.js';
import { seedStore } from '../src/services/seedData.js';
import { createApp } from '../src/app.js';
import { Product, Category, User, UserPreference, Cart, Wishlist, Order } from '../src/models/index.js';

export const targets = [{ name: 'local', make: () => createStore({ mode: 'local', file: null }) }];
if (process.env.MONGO_TEST_URI) targets.push({ name: 'mongo', make: async () => {
  const s = await createStore({ mode: 'mongo', mongoUri: process.env.MONGO_TEST_URI });
  await Promise.all([Product, Category, User, UserPreference, Cart, Wishlist, Order].map((m) => m.deleteMany({}))); await seedStore(s); return s;
} });

export async function boot(store, llm = null) {
  const config = { clientOrigin: '', jwtSecret: 'test-secret', llm: {} };
  const server = createApp({ store, config, llm }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { body, token, guest, raw } = {}) => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }), ...(guest && { 'x-guest-id': guest }) }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { base, call, close: async () => { server.close(); await store.close(); } };
}
