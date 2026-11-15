import mongoose from 'mongoose';
const { Schema } = mongoose;
const opts = { timestamps: true };

export const Category = mongoose.model('Category', new Schema({
  slug: { type: String, required: true, unique: true }, name: { type: String, required: true }, emoji: String, color: String,
}));

const productSchema = new Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '' },
  category: { type: String, required: true, index: true },
  brand: { type: String, required: true, index: true },
  mrp: { type: Number, required: true, min: 0 },
  discountPercent: { type: Number, default: 0, min: 0, max: 90 },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  unit: { type: String, enum: ['g', 'ml', 'pc'], required: true },
  packSize: { type: Number, required: true, min: 0 },
  dietaryLabels: { type: [String], default: [] },
  allergens: { type: [String], default: [] },
  tags: { type: [String], default: [] },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  ratingCount: { type: Number, min: 0, default: 0 },
  imageUrl: String, emoji: String,
  nutrition: { type: Schema.Types.Mixed, default: null },
  ingredients: { type: String, default: null },
  expiryDate: { type: Date, default: null },
  deliveryMinutes: { type: Number, default: null },
}, opts);
productSchema.index({ name: 'text', tags: 'text', brand: 'text' });
export const Product = mongoose.model('Product', productSchema);

const address = { id: String, label: String, line1: String, city: String, pincode: String };
export const User = mongoose.model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  addresses: [address],
}, opts));

export const UserPreference = mongoose.model('UserPreference', new Schema({
  userId: { type: String, unique: true, required: true },
  dietary: [String], avoidAllergens: [String], favouriteBrands: [String], monthlyBudget: Number,
  personalisationConsent: { type: Boolean, default: false }, // purchase-history recommendations only when true
}));

export const Cart = mongoose.model('Cart', new Schema({
  ownerKey: { type: String, unique: true, required: true }, // "u:<userId>" or "g:<guestId>"
  items: [{ _id: false, productId: String, qty: { type: Number, min: 1 } }],
}, opts));

export const Wishlist = mongoose.model('Wishlist', new Schema({ userId: { type: String, unique: true, required: true }, productIds: [String] }));

export const Order = mongoose.model('Order', new Schema({
  userId: { type: String, required: true, index: true },
  items: [{ _id: false, productId: String, name: String, unitPrice: Number, qty: Number }],
  total: { type: Number, required: true },
  status: { type: String, enum: ['placed', 'packed', 'delivered', 'cancelled'], default: 'placed' },
  payment: { method: { type: String, default: 'mock' }, status: { type: String, default: 'paid-mock' }, gatewayOrderId: String, gatewayPaymentId: String, gatewaySignature: String },
  address: address,
}, opts));

export const RecommendationEvent = mongoose.model('RecommendationEvent', new Schema({
  userId: { type: String, index: true }, kind: { type: String, enum: ['view', 'search', 'recommendation-click'] }, productId: String, query: String,
}, opts));

export const Recipe = mongoose.model('Recipe', new Schema({
  slug: { type: String, unique: true }, name: String, servings: Number, dietary: [String], source: { type: String, default: 'local-catalogue' },
  ingredients: [{ label: String, qty: Number, unit: String, optional: Boolean }],
}));
