// Generates neutral, elegant placeholder tiles (used only until real photos are downloaded with `npm run photos`).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products, categories } from '../data/seedProducts.js';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public/images/products');
fs.mkdirSync(out, { recursive: true });
const color = Object.fromEntries(categories.map((c) => [c.slug, c.color]));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const wrap = (text, max = 15) => { const lines = []; let cur = ''; for (const w of text.split(' ')) { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) lines.push(cur); return lines.slice(0, 3); };

for (const p of products) {
  const c = color[p.category] || '#64748b', lines = wrap(p.name.replace(/\s*\(.*?\)/g, ''));
  const y0 = 150 - ((lines.length - 1) * 17);
  const text = lines.map((l, i) => `<text x="200" y="${y0 + i * 34}" font-size="28" font-weight="700" fill="#fff" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif">${esc(l)}</text>`).join('');
  fs.writeFileSync(path.join(out, `${p.slug}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" aria-label="${esc(p.name)}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#0b1f17"/></linearGradient></defs>
<rect width="400" height="300" fill="url(#g)"/><circle cx="330" cy="40" r="110" fill="#fff" opacity=".08"/><circle cx="50" cy="290" r="90" fill="#fff" opacity=".07"/>
${text}<text x="200" y="262" font-size="13" fill="#fff" opacity=".7" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" letter-spacing="2">${esc(p.category.toUpperCase().replace('-', ' '))}</text></svg>`);
}
fs.writeFileSync(path.join(out, '_fallback.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#1c2f26"/><text x="200" y="165" font-size="26" font-weight="700" fill="#fff" opacity=".8" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif">GrocerAI</text></svg>`);
console.log(`Generated ${products.length} placeholders + fallback in ${out}`);
