// Price per 100 g / 100 ml, or per piece for countable items.
export function unitPrice(p) {
  if (!p.packSize) return null;
  return p.unit === 'pc' ? p.price / p.packSize : (p.price / p.packSize) * 100;
}
export const unitPriceLabel = (p) => (p.unit === 'pc' ? 'per piece' : `per 100 ${p.unit}`);

export function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Value score: how much cheaper than the median of comparable products (same category + unit).
// >1 means better value than typical. Deterministic; null if no comparable data.
export function valueScores(products) {
  const groups = new Map();
  for (const p of products) {
    const up = unitPrice(p);
    if (up == null) continue;
    const k = `${p.category}|${p.unit}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(up);
  }
  const med = new Map([...groups].map(([k, v]) => [k, median(v)]));
  const out = new Map();
  for (const p of products) {
    const up = unitPrice(p);
    const m = med.get(`${p.category}|${p.unit}`);
    out.set(p.slug, up && m ? Number((m / up).toFixed(3)) : null);
  }
  return out;
}
