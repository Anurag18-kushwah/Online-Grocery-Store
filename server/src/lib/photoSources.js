// Photo search across free photo APIs. Every source returns the same shape so the bulk downloader and the picker can share code.
export class PhotoFatal extends Error {}
export const SOURCES = ['unsplash', 'pexels', 'pixabay'];
const UA = { 'user-agent': 'GrocerAI-college-project/0.1 (educational)', accept: 'application/json' };
const enc = encodeURIComponent;

const BASES = { unsplash: 'https://api.unsplash.com', pexels: 'https://api.pexels.com', pixabay: 'https://pixabay.com' };
export const baseFor = (source, env = process.env) => env[`${source.toUpperCase()}_BASE`] || BASES[source];

const dedupe = (list) => { const seen = new Set(); return list.filter((c) => c.url && !seen.has(c.url) && seen.add(c.url)); };

async function unsplash({ key, q, base, count }) {
  const res = await fetch(`${base}/search/photos?query=${enc(q)}&per_page=${count}&orientation=landscape&content_filter=high`, { headers: { ...UA, authorization: `Client-ID ${key}`, 'accept-version': 'v1' } });
  if (res.status === 401) throw new PhotoFatal('Unsplash rejected your Access Key (check UNSPLASH_ACCESS_KEY).');
  if (res.status === 403 || res.status === 429) throw new PhotoFatal('Unsplash rate limit reached (demo apps get 50 requests per hour). Run again in an hour; finished photos are kept. Or use the photo picker, which only searches one product at a time.');
  if (!res.ok) throw new Error(`search "${q}" -> HTTP ${res.status}`);
  return ((await res.json()).results || []).map((r) => ({ id: r.id, thumb: r.urls?.small || r.urls?.regular, url: r.urls?.regular, tags: `${r.alt_description || ''} ${r.description || ''} ${(r.tags || []).map((t) => t.title).join(' ')}`, score: r.likes || 0,
    credit: { source: 'unsplash', photographer: r.user?.name, photographer_url: r.user?.links?.html, page: r.links?.html, download_location: r.links?.download_location, note: 'Photo from Unsplash (free to use; please credit the photographer).' } }));
}
async function pexels({ key, q, base, count }) {
  const res = await fetch(`${base}/v1/search?query=${enc(q)}&per_page=${count}&orientation=landscape`, { headers: { ...UA, authorization: key } });
  if (res.status === 401 || res.status === 403) throw new PhotoFatal('Pexels rejected your API key (check PEXELS_API_KEY).');
  if (res.status === 429) throw new PhotoFatal('Pexels rate limit reached. Wait an hour and run again; finished photos are kept.');
  if (!res.ok) throw new Error(`search "${q}" -> HTTP ${res.status}`);
  return ((await res.json()).photos || []).map((x) => ({ id: x.id, thumb: x.src?.medium || x.src?.large, url: x.src?.large || x.src?.medium || x.src?.original, tags: x.alt || '', score: 0,
    credit: { source: 'pexels', photographer: x.photographer, photographer_url: x.photographer_url, page: x.url, note: 'Photo from Pexels (free to use; credit appreciated).' } }));
}
async function pixabay({ key, q, category, base, count }) {
  const call = async (extra) => {
    const res = await fetch(`${base}/api/?key=${enc(key)}&q=${enc(q)}&image_type=photo&orientation=horizontal&safesearch=true&per_page=${Math.max(3, count)}${extra}`, { headers: UA });
    if (res.status === 400 || res.status === 401 || res.status === 403) throw new PhotoFatal('Pixabay rejected your API key (check PIXABAY_API_KEY).');
    if (res.status === 429) throw new PhotoFatal('Pixabay rate limit reached. Wait a few minutes and run again; finished photos are kept.');
    if (!res.ok) throw new Error(`search "${q}" -> HTTP ${res.status}`);
    return (await res.json()).hits || [];
  };
  const cat = category ? `&category=${category}` : '';
  let hits = await call(`&editors_choice=true${cat}`);          // Pixabay's curated "Editor's Choice" photos first
  if (hits.length < 3) hits = [...hits, ...(await call(cat))];
  if (!hits.length) hits = await call('');
  return hits.map((h) => ({ id: h.id ?? h.largeImageURL, thumb: h.webformatURL || h.previewURL || h.largeImageURL, url: h.largeImageURL || h.webformatURL, tags: h.tags || '', score: (h.likes || 0) + (h.downloads || 0) / 20,
    credit: { source: 'pixabay', photographer: h.user, page: h.pageURL, note: 'Photo from Pixabay (free to use under the Pixabay licence).' } }));
}
const IMPL = { unsplash, pexels, pixabay };

export async function searchPhotos(source, { key, q, category, base, count = 12 }) {
  return dedupe(await IMPL[source]({ key, q, category, base: base || BASES[source], count })).slice(0, Math.max(count, 3));
}
// Relevance first (query's main word appears in tags/alt), then popularity (likes/downloads).
export function bestCandidate(cands, q) {
  const key = q.split(' ')[0].toLowerCase(); const rel = cands.filter((c) => (c.tags || '').toLowerCase().includes(key));
  return [...(rel.length ? rel : cands)].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
}
export const FOOD_CATEGORIES = new Set(['fruits', 'vegetables', 'dairy', 'snacks', 'beverages', 'staples']);
