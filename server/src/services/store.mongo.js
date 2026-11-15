import mongoose from 'mongoose';
import { Product, Category, User, UserPreference, Cart, Wishlist, Order } from '../models/index.js';

const clean = (d) => {
  if (!d) return null;
  const { _id, __v, ...rest } = d;
  return { ...rest, id: String(_id) };
};
const many = (arr) => arr.map(clean);
const oid = (id) => (mongoose.isValidObjectId(id) ? id : null);

export class MongoStore {
  mode = 'mongo';
  constructor({ uri }) { this.uri = uri; }
  async connect() { await mongoose.connect(this.uri, { serverSelectionTimeoutMS: 5000 }); }
  async close() { await mongoose.disconnect(); }

  async allProducts() { return many(await Product.find().lean()); }
  async getProduct(idOrSlug) { return clean(await Product.findOne(oid(idOrSlug) ? { $or: [{ _id: idOrSlug }, { slug: idOrSlug }] } : { slug: idOrSlug }).lean()); }
  async createProduct(p) { return clean((await Product.create(p)).toObject()); }
  async updateProduct(id, patch) { if (!oid(id)) return null; return clean(await Product.findByIdAndUpdate(id, patch, { new: true, runValidators: true }).lean()); }
  async deleteProduct(id) { if (!oid(id)) return false; return !!(await Product.findByIdAndDelete(id)); }
  async categories() { return many(await Category.find().lean()); }
  async upsertCategory(c) { return clean(await Category.findOneAndUpdate({ slug: c.slug }, c, { upsert: true, new: true }).lean()); }
  async deleteCategory(slug) { return (await Category.deleteOne({ slug })).deletedCount > 0; }

  async findUserByEmail(email) { return clean(await User.findOne({ email: email.toLowerCase() }).lean()); }
  async findUserById(id) { return oid(id) ? clean(await User.findById(id).lean()) : null; }
  async createUser(u) { return clean((await User.create(u)).toObject()); }
  async updateUser(id, patch) { return oid(id) ? clean(await User.findByIdAndUpdate(id, patch, { new: true }).lean()) : null; }
  async getPrefs(userId) { const p = await UserPreference.findOne({ userId }).lean(); if (!p) return null; const { userId: _u, _id, __v, ...rest } = p; return rest; }
  async setPrefs(userId, prefs) { await UserPreference.findOneAndUpdate({ userId }, { ...prefs, userId }, { upsert: true }); return prefs; }

  async getCart(key) { return (await Cart.findOne({ ownerKey: key }).lean())?.items ?? []; }
  async setCart(key, items) { await Cart.findOneAndUpdate({ ownerKey: key }, { ownerKey: key, items }, { upsert: true }); return items; }
  async deleteCart(key) { await Cart.deleteOne({ ownerKey: key }); }
  async getWishlist(userId) { return (await Wishlist.findOne({ userId }).lean())?.productIds ?? []; }
  async setWishlist(userId, ids) { await Wishlist.findOneAndUpdate({ userId }, { userId, productIds: ids }, { upsert: true }); return ids; }

  async createOrder(o) { return clean((await Order.create(o)).toObject()); }
  async ordersByUser(userId) { return many(await Order.find({ userId }).sort({ createdAt: -1 }).lean()); }
  async allOrders() { return many(await Order.find().sort({ createdAt: -1 }).lean()); }
  async getOrder(id) { return oid(id) ? clean(await Order.findById(id).lean()) : null; }
  async getOrderByPaymentOrderId(paymentOrderId) { return clean(await Order.findOne({ 'payment.gatewayOrderId': paymentOrderId }).lean()); }
  async updateOrder(id, patch) { return oid(id) ? clean(await Order.findByIdAndUpdate(id, patch, { new: true }).lean()) : null; }

  // Conditional atomic decrement per line (stock >= qty); roll back earlier lines if one fails.
  // (Standalone MongoDB has no multi-document transactions, so compensation is used instead.)
  async reserveStock(items) {
    const done = [];
    for (const { productId, qty } of items) {
      const hit = oid(productId) && await Product.findOneAndUpdate({ _id: productId, stock: { $gte: qty } }, { $inc: { stock: -qty } });
      if (!hit) {
        await this.releaseStock(done);
        const p = oid(productId) ? await Product.findById(productId).lean() : null;
        return { ok: false, problems: [{ productId, name: p?.name || 'Unknown product', available: p?.stock ?? 0, requested: qty }] };
      }
      done.push({ productId, qty });
    }
    return { ok: true };
  }
  async releaseStock(items) { for (const { productId, qty } of items) await Product.updateOne({ _id: productId }, { $inc: { stock: qty } }); }
}
