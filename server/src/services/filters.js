import { z } from 'zod';
import { unitPrice, valueScores } from '../utils/units.js';

const csv = z.preprocess((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v), z.array(z.string().max(40)).max(20).optional());
const num = (min, max) => z.coerce.number().min(min).max(max).optional();
const bool = z.preprocess((v) => (v === 'true' || v === true ? true : v === 'false' || v === false ? false : undefined), z.boolean().optional());

export const SORTS = ['popular', 'price-asc', 'price-desc', 'discount', 'rating', 'value'];

// Validated structured filters. Everything the NL parser or an LLM produces must pass through this.
export const filterSchema = z.object({
  q: z.string().trim().max(100).optional(),
  minPrice: num(0, 1e6), maxPrice: num(0, 1e6),
  categories: csv, brands: csv, diet: csv, excludeAllergens: csv,
  inStock: bool,
  maxDeliveryMins: num(1, 240),
  minDiscount: num(0, 90),
  minPackSize: num(0, 1e6), maxPackSize: num(0, 1e6),
  maxUnitPrice: num(0, 1e6),
  minRating: num(0, 5),
  minShelfLifeDays: num(0, 3650),
  minProtein: num(0, 100),   // g per 100 g, only products with nutrition data
  maxSugar: num(0, 100),     // g per 100 g, only products with nutrition data
  sort: z.enum(SORTS).optional(),
}).strict();

const popularity = (p) => p.rating * Math.log10(1 + p.ratingCount);

export function applyFilters(all, rawFilters = {}, now = new Date()) {
  const f = filterSchema.parse(rawFilters);
  const needsNutrition = f.minProtein != null || f.maxSugar != null;
  let excludedForMissingData = 0;
  // every query word must appear (simple plural stripping), so "breakfast oats" works
  const qTokens = (f.q?.toLowerCase().match(/[a-z0-9]+/g) || []).map((w) => (w.length > 3 ? w.replace(/s$/, '') : w));
  const values = valueScores(all);

  let list = all.filter((p) => {
    if (qTokens.length) { const hay = `${p.name} ${p.brand} ${p.category} ${p.tags.join(' ')}`.toLowerCase(); if (!qTokens.every((w) => hay.includes(w))) return false; }
    if (f.minPrice != null && p.price < f.minPrice) return false;
    if (f.maxPrice != null && p.price > f.maxPrice) return false;
    if (f.categories?.length && !f.categories.includes(p.category)) return false;
    if (f.brands?.length && !f.brands.map((b) => b.toLowerCase()).includes(p.brand.toLowerCase())) return false;
    if (f.diet?.length && !f.diet.every((d) => p.dietaryLabels.includes(d))) return false;
    if (f.excludeAllergens?.length && p.allergens.some((a) => f.excludeAllergens.includes(a))) return false;
    if (f.inStock && p.stock <= 0) return false;
    if (f.maxDeliveryMins != null && (p.deliveryMinutes == null || p.deliveryMinutes > f.maxDeliveryMins)) return false;
    if (f.minDiscount != null && p.discountPercent < f.minDiscount) return false;
    if (f.minPackSize != null && p.packSize < f.minPackSize) return false;
    if (f.maxPackSize != null && p.packSize > f.maxPackSize) return false;
    if (f.maxUnitPrice != null) { const u = unitPrice(p); if (u == null || u > f.maxUnitPrice) return false; }
    if (f.minRating != null && p.rating < f.minRating) return false;
    if (f.minShelfLifeDays != null) {
      if (!p.expiryDate) { excludedForMissingData++; return false; }
      if ((new Date(p.expiryDate) - now) / 86400000 < f.minShelfLifeDays) return false;
    }
    if (needsNutrition) {
      if (!p.nutrition) { excludedForMissingData++; return false; }
      if (f.minProtein != null && p.nutrition.protein < f.minProtein) return false;
      if (f.maxSugar != null && p.nutrition.sugar > f.maxSugar) return false;
    }
    return true;
  });

  const by = {
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    discount: (a, b) => b.discountPercent - a.discountPercent,
    rating: (a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount,
    value: (a, b) => (values.get(b.slug) ?? -1) - (values.get(a.slug) ?? -1),
    popular: (a, b) => popularity(b) - popularity(a),
  }[f.sort || 'popular'];
  // slug tie-break keeps ordering fully deterministic
  list = [...list].sort((a, b) => by(a, b) || a.slug.localeCompare(b.slug));

  return {
    products: list.map((p) => ({ ...p, unitPrice: Number(unitPrice(p)?.toFixed(2)), valueScore: values.get(p.slug) })),
    total: list.length,
    excludedForMissingData,
    appliedFilters: f,
  };
}
