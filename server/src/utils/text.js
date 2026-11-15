export const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  if (!A.size && !B.size) return 0;
  let i = 0; for (const x of A) if (B.has(x)) i++;
  return i / (A.size + B.size - i);
};
// Tags that describe broad type rather than purpose; ignored when judging "same purpose".
export const GENERIC_TAGS = new Set(['dairy', 'fresh', 'fruit', 'vegetable', 'staple', 'cooking', 'healthy', 'party', 'kitchen', 'cleaning', 'light', 'natural', 'seasonal', 'premium']);
export const purposeTags = (p) => p.tags.filter((t) => !GENERIC_TAGS.has(t));
export const inr = (n) => `₹${Math.round(n * 100) / 100}`;
export const amountLabel = (p) => (p.unit === 'pc' ? `${p.packSize} pc` : p.packSize >= 1000 ? `${p.packSize / 1000} ${p.unit === 'g' ? 'kg' : 'L'}` : `${p.packSize} ${p.unit}`);
export const dietOk = (p, diets = []) => diets.every((d) => p.dietaryLabels.includes(d));
export const allergenOk = (p, avoid = []) => !p.allergens.some((a) => avoid.includes(a));
