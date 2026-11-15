const TOKEN = 'grocerai.token', GUEST = 'grocerai.guest';
export const getToken = () => localStorage.getItem(TOKEN);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN, t) : localStorage.removeItem(TOKEN));
export const guestId = () => {
  let g = localStorage.getItem(GUEST);
  if (!g) { g = `g-${crypto.randomUUID()}`; localStorage.setItem(GUEST, g); }
  return g;
};

export class ApiError extends Error { constructor(message, status, data) { super(message); this.status = status; this.data = data; } }

export async function api(path, { method = 'GET', body, query } = {}) {
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)).toString() : '';
  let res;
  try {
    res = await fetch(`/api${path}${qs}`, { method, headers: { 'content-type': 'application/json', 'x-guest-id': guestId(), ...(getToken() && { authorization: `Bearer ${getToken()}` }) }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new ApiError('Cannot reach the GrocerAI server. Is it running?', 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
  return data;
}
export const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const amount = (p) => (p.unit === 'pc' ? `${p.packSize} pc` : p.packSize >= 1000 ? `${p.packSize / 1000} ${p.unit === 'g' ? 'kg' : 'L'}` : `${p.packSize} ${p.unit}`);
export const recent = { get: () => JSON.parse(localStorage.getItem('grocerai.recent') || '[]'), add: (id) => localStorage.setItem('grocerai.recent', JSON.stringify([id, ...recent.get().filter((x) => x !== id)].slice(0, 12))) };
