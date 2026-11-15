// Local file-backed store (STORE_MODE=local). For development/demos without MongoDB.
// Single-process JSON file: NOT suitable for production or concurrent writers.
import crypto from 'node:crypto';
import fs from 'node:fs';

const newId = () => crypto.randomBytes(12).toString('hex');
const clone = (o) => (o == null ? o : structuredClone(o));

export class LocalStore {
  mode = 'local';
  constructor({ file = null, seed }) {
    this.file = file;
    if (file && fs.existsSync(file)) this.d = JSON.parse(fs.readFileSync(file, 'utf8'));
    else { this.d = seed ? clone(seed) : empty(); this.#save(); }
  }
  #save() { if (this.file) fs.writeFileSync(this.file, JSON.stringify(this.d)); }

  // products & categories
  async allProducts() { return this.d.products; }
  async getProduct(idOrSlug) { return this.d.products.find((p) => p.id === idOrSlug || p.slug === idOrSlug) || null; }
  async createProduct(p) { const doc = { ...p, id: newId() }; this.d.products.push(doc); this.#save(); return doc; }
  async updateProduct(id, patch) {
    const i = this.d.products.findIndex((p) => p.id === id); if (i < 0) return null;
    this.d.products[i] = { ...this.d.products[i], ...patch, id }; this.#save(); return this.d.products[i];
  }
  async deleteProduct(id) { const n = this.d.products.length; this.d.products = this.d.products.filter((p) => p.id !== id); this.#save(); return this.d.products.length < n; }
  async categories() { return this.d.categories; }
  async upsertCategory(c) { const i = this.d.categories.findIndex((x) => x.slug === c.slug); if (i >= 0) this.d.categories[i] = { ...this.d.categories[i], ...c }; else this.d.categories.push(c); this.#save(); return c; }
  async deleteCategory(slug) { const n = this.d.categories.length; this.d.categories = this.d.categories.filter((c) => c.slug !== slug); this.#save(); return this.d.categories.length < n; }

  // users
  async findUserByEmail(email) { return clone(this.d.users.find((u) => u.email === email.toLowerCase())) || null; }
  async findUserById(id) { return clone(this.d.users.find((u) => u.id === id)) || null; }
  async createUser(u) { if (this.d.users.some((x) => x.email === u.email.toLowerCase())) throw new Error('E11000 duplicate key: email'); const doc = { addresses: [], role: 'user', ...u, email: u.email.toLowerCase(), id: newId() }; this.d.users.push(doc); this.#save(); return clone(doc); }
  async updateUser(id, patch) { const u = this.d.users.find((x) => x.id === id); if (!u) return null; Object.assign(u, patch); this.#save(); return clone(u); }
  async getPrefs(userId) { return clone(this.d.prefs[userId]) || null; }
  async setPrefs(userId, prefs) { this.d.prefs[userId] = prefs; this.#save(); return clone(prefs); }

  // cart / wishlist
  async getCart(key) { return clone(this.d.carts[key]) || []; }
  async setCart(key, items) { this.d.carts[key] = items; this.#save(); return clone(items); }
  async deleteCart(key) { delete this.d.carts[key]; this.#save(); }
  async getWishlist(userId) { return clone(this.d.wishlists[userId]) || []; }
  async setWishlist(userId, ids) { this.d.wishlists[userId] = ids; this.#save(); return clone(ids); }

  // orders
  async createOrder(o) { const doc = { ...o, id: newId(), status: 'placed', createdAt: new Date().toISOString() }; this.d.orders.push(doc); this.#save(); return clone(doc); }
  async ordersByUser(userId) { return clone(this.d.orders.filter((o) => o.userId === userId)).reverse(); }
  async allOrders() { return clone(this.d.orders).reverse(); }
  async getOrder(id) { return clone(this.d.orders.find((o) => o.id === id)) || null; }
  async getOrderByPaymentOrderId(paymentOrderId) { return clone(this.d.orders.find((o) => o.payment?.gatewayOrderId === paymentOrderId)) || null; }
  async updateOrder(id, patch) { const o = this.d.orders.find((x) => x.id === id); if (!o) return null; Object.assign(o, patch); this.#save(); return clone(o); }

  // all-or-nothing stock reservation (single process, so check-then-write is safe here)
  async reserveStock(items) {
    const problems = [];
    for (const { productId, qty } of items) {
      const p = this.d.products.find((x) => x.id === productId);
      if (!p || p.stock < qty) problems.push({ productId, name: p?.name || 'Unknown product', available: p?.stock ?? 0, requested: qty });
    }
    if (problems.length) return { ok: false, problems };
    for (const { productId, qty } of items) this.d.products.find((x) => x.id === productId).stock -= qty;
    this.#save(); return { ok: true };
  }
  async releaseStock(items) { for (const { productId, qty } of items) { const p = this.d.products.find((x) => x.id === productId); if (p) p.stock += qty; } this.#save(); }
  async close() {}
}
const empty = () => ({ products: [], categories: [], users: [], carts: {}, orders: [], wishlists: {}, prefs: {} });
export { empty as emptyData };
