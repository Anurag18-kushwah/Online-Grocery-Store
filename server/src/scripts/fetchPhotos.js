// Downloads real product photos into public/images/products.  Run on a computer with internet:  npm run photos
// Source priority: Unsplash > Pexels > Pixabay (first one with a key in server/.env) > Wikipedia (no key; inconsistent).
// Your own <slug>.jpg files are never overwritten.  Options: --force (re-download all), --only=<slug>
// Want to hand-pick the best photo for each product?  Run:  npm run photos:pick
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products } from '../data/seedProducts.js';
import { photoTitles } from '../data/photoTitles.js';
import { photoQueries } from '../data/photoQueries.js';
import { PhotoFatal, SOURCES, baseFor, searchPhotos, bestCandidate, FOOD_CATEGORIES } from '../lib/photoSources.js';

const WIKI = process.env.WIKI_BASE || 'https://en.wikipedia.org';
const dir = process.env.PHOTO_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public/images/products');
const force = process.argv.includes('--force'), only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const headers = { 'user-agent': 'GrocerAI-college-project/0.1 (educational)', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EXTS = ['jpg', 'jpeg', 'png', 'webp'];
const files = (slug) => EXTS.map((e) => path.join(dir, `${slug}.${e}`)).filter((f) => fs.existsSync(f));
const ENV_NAME = { unsplash: 'UNSPLASH_ACCESS_KEY', pexels: 'PEXELS_API_KEY', pixabay: 'PIXABAY_API_KEY' };
const clean = (name) => { const k = (process.env[name] || '').trim(); if (k && (k.length < 20 || /\s/.test(k))) { console.log(`Ignoring invalid ${name} ("${k.slice(0, 6)}" is too short to be a key).`); return ''; } return k; };

const keys = Object.fromEntries(SOURCES.map((s) => [s, clean(ENV_NAME[s])]));
const mode = SOURCES.find((s) => keys[s]) || 'wikipedia';

fs.mkdirSync(dir, { recursive: true });
const creditsFile = path.join(dir, 'CREDITS.json');
const credits = fs.existsSync(creditsFile) ? JSON.parse(fs.readFileSync(creditsFile, 'utf8')) : {};
const sourceOf = (c) => c?.source || (c?.page?.includes('wikipedia') ? 'wikipedia' : null);
console.log(mode === 'wikipedia' ? 'No Unsplash/Pexels/Pixabay key set: using Wikipedia (inconsistent quality). Run `npm run setup` to add a free key.' : `Using ${mode} (real photos).`);

async function viaWikipedia(p) {
  const title = photoTitles[p.slug] || p.name;
  const res = await fetch(`${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, { headers });
  if (!res.ok) throw new Error(`page "${title}" -> HTTP ${res.status}`);
  const j = await res.json(); const src = j.thumbnail?.source || j.originalimage?.source; if (!src) throw new Error(`page "${title}" has no image`);
  return { url: src.replace(/\/(\d+)px-/, '/800px-'), fallbackUrl: src, credit: { source: 'wikipedia', page: j.content_urls?.desktop?.page || `${WIKI}/wiki/${title}`, note: 'Wikimedia Commons / Wikipedia; see the page for author and licence.' } };
}
async function viaApi(p) {
  const q = photoQueries[p.slug] || p.name;
  const cands = await searchPhotos(mode, { key: keys[mode], q, category: FOOD_CATEGORIES.has(p.category) ? 'food' : undefined, base: baseFor(mode), count: 12 });
  if (!cands.length) throw new Error(`no photos for \"${q}\"`);
  const best = bestCandidate(cands, q);
  // Try the best match first, then other search results if its CDN is throttling or unavailable.
  return [best, ...cands.filter((c) => c !== best)].filter((c) => c.url);
}

async function downloadWithRetry(candidates) {
  let lastError = 'no downloadable photo candidates';
  for (const candidate of candidates.slice(0, 8)) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(candidate.url, { headers });
        if (response.status === 429) {
          lastError = 'image download -> HTTP 429';
          const waitMs = 2000 * (attempt + 1);
          console.log(`  Image host rate-limited; retrying in ${waitMs / 1000}s...`);
          await sleep(waitMs);
          continue;
        }
        if (!response.ok) { lastError = `image download -> HTTP ${response.status}`; break; }
        const contentType = response.headers.get('content-type') || '';
        const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
        return { bytes: Buffer.from(await response.arrayBuffer()), ext, credit: candidate.credit, url: candidate.url };
      } catch (error) {
        lastError = error.message;
        break;
      }
    }
    // A different CDN result may work even when this image URL is throttled.
    await sleep(500);
  }
  throw new Error(lastError);
}

let ok = 0, skipped = 0; const failed = [];
try {
  for (const p of products) {
    if (only && p.slug !== only) continue;
    const have = files(p.slug), src = sourceOf(credits[p.slug]);
    const good = src && src !== 'wikipedia'; // a real-photo-API photo is kept; old Wikipedia photos get replaced
    if (have.length && !force && (!credits[p.slug] /* user's own photo */ || good || mode === 'wikipedia')) { skipped++; continue; }
    try {
      let downloaded;
      if (mode === 'wikipedia') {
        const wiki = await viaWikipedia(p);
        let img = await fetch(wiki.url, { headers });
        if (!img.ok && wiki.fallbackUrl) img = await fetch(wiki.fallbackUrl, { headers });
        if (!img.ok) throw new Error(`image download -> HTTP ${img.status}`);
        const type = img.headers.get('content-type') || '';
        downloaded = { bytes: Buffer.from(await img.arrayBuffer()), ext: type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg', credit: wiki.credit, url: wiki.url };
      } else {
        const candidates = await viaApi(p);
        downloaded = await downloadWithRetry(candidates);
      }
      // Replace an older image only after a new image has downloaded successfully.
      have.forEach((f) => fs.rmSync(f));
      fs.writeFileSync(path.join(dir, `${p.slug}.${downloaded.ext}`), downloaded.bytes);
      credits[p.slug] = { ...downloaded.credit, image: downloaded.url }; ok++; console.log(`✓ ${p.slug}`);
    } catch (e) { if (e instanceof PhotoFatal) throw e; failed.push(p.slug); console.log(`✗ ${p.slug}: ${e.message}`); }
    await sleep(Number(process.env.PHOTO_DELAY_MS ?? 1500));
  }
} catch (e) { if (!(e instanceof PhotoFatal)) throw e; console.log(`\n⛔ ${e.message}`); }
fs.writeFileSync(creditsFile, JSON.stringify(credits, null, 2));
console.log(`\nDone: ${ok} downloaded, ${skipped} kept, ${failed.length} failed.${failed.length ? '\nFailed items keep their placeholder (or save your own <slug>.jpg): ' + failed.join(', ') : ''}\nTip: not happy with some photos? Run  npm run photos:pick  to choose the best photo for each product yourself.`);
