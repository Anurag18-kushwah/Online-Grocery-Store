// Local "photo picker": a tiny web page where YOU choose the best photo for each product from real search results.
// Security: only listens on localhost, only downloads from allow-listed photo hosts, only writes <valid-slug>.<ext> inside the photos folder.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { products } from '../data/seedProducts.js';
import { photoQueries } from '../data/photoQueries.js';
import { SOURCES, baseFor, searchPhotos, FOOD_CATEGORIES } from './photoSources.js';

const ENV_NAME = { unsplash: 'UNSPLASH_ACCESS_KEY', pexels: 'PEXELS_API_KEY', pixabay: 'PIXABAY_API_KEY' };
const HOSTS = ['pixabay.com', 'cdn.pixabay.com', 'images.pexels.com', 'images.unsplash.com', 'plus.unsplash.com'];
const EXTS = ['jpg', 'jpeg', 'png', 'webp'];

export function createPicker({ dir, env = process.env }) {
  fs.mkdirSync(dir, { recursive: true });
  const allowed = new Set([...HOSTS, ...(env.PICKER_ALLOW_HOSTS || '').split(',').filter(Boolean)]);
  const keys = Object.fromEntries(SOURCES.map((s) => [s, (env[ENV_NAME[s]] || '').trim()]).filter(([, k]) => k.length >= 20));
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const creditsFile = path.join(dir, 'CREDITS.json');
  const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const body = (req) => new Promise((ok, bad) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 20000) { bad(new Error('too large')); req.destroy(); } }); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch (e) { bad(e); } }); });
  const currentFile = (slug) => EXTS.map((e) => path.join(dir, `${slug}.${e}`)).find((f) => fs.existsSync(f));

  return http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://localhost');
      if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
      if (u.pathname === '/api/products') return json(res, 200, { sources: Object.keys(keys), products: products.map((p) => ({ slug: p.slug, name: p.name, category: p.category, hasPhoto: !!currentFile(p.slug), query: photoQueries[p.slug] || p.name })) });
      if (u.pathname.startsWith('/current/')) { const f = currentFile(u.pathname.slice(9)); if (!f) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'image/jpeg', 'cache-control': 'no-store' }); return fs.createReadStream(f).pipe(res); }
      if (u.pathname === '/api/candidates') {
        const p = bySlug.get(u.searchParams.get('slug')); if (!p) return json(res, 400, { error: 'unknown product' });
        const q = (u.searchParams.get('q') || photoQueries[p.slug] || p.name).slice(0, 80);
        if (!Object.keys(keys).length) return json(res, 400, { error: 'No photo API key found in server/.env. Run "npm run setup" and add an Unsplash, Pexels or Pixabay key first.' });
        const out = [], errors = [];
        await Promise.all(Object.keys(keys).map(async (s) => { try { out.push(...(await searchPhotos(s, { key: keys[s], q, category: FOOD_CATEGORIES.has(p.category) ? 'food' : undefined, base: baseFor(s, env), count: 9 })).map((c) => ({ thumb: c.thumb, url: c.url, credit: c.credit, label: `${s}${c.credit.photographer ? ' · ' + c.credit.photographer : ''}` }))); } catch (e) { errors.push(`${s}: ${e.message}`); } }));
        return json(res, 200, { q, candidates: out, errors });
      }
      if (u.pathname === '/api/choose' && req.method === 'POST') {
        const { slug, url, credit } = await body(req); const p = bySlug.get(slug);
        if (!p || typeof url !== 'string') return json(res, 400, { error: 'bad request' });
        let host; try { const x = new URL(url); if (!['https:', 'http:'].includes(x.protocol)) throw 0; host = x.hostname; } catch { return json(res, 400, { error: 'bad url' }); }
        if (!allowed.has(host)) return json(res, 400, { error: `downloads from ${host} are not allowed` });
        const img = await fetch(url, { headers: { 'user-agent': 'GrocerAI-college-project/0.1' }, signal: AbortSignal.timeout(30000) });
        if (!img.ok) return json(res, 502, { error: `download failed (HTTP ${img.status})` });
        const type = img.headers.get('content-type') || ''; if (!type.startsWith('image/')) return json(res, 400, { error: 'that URL is not an image' });
        const buf = Buffer.from(await img.arrayBuffer()); if (buf.length > 15e6) return json(res, 400, { error: 'image too large' });
        EXTS.forEach((e) => fs.rmSync(path.join(dir, `${slug}.${e}`), { force: true }));
        fs.writeFileSync(path.join(dir, `${slug}.${type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'}`), buf);
        const credits = fs.existsSync(creditsFile) ? JSON.parse(fs.readFileSync(creditsFile, 'utf8')) : {};
        credits[slug] = { ...(credit && typeof credit === 'object' ? { source: String(credit.source || 'picked'), photographer: credit.photographer, photographer_url: credit.photographer_url, page: credit.page } : { source: 'picked' }), image: url, picked: true };
        fs.writeFileSync(creditsFile, JSON.stringify(credits, null, 2));
        const dl = credit?.download_location; if (dl && keys.unsplash && /^https:\/\/api\.unsplash\.com\//.test(dl)) fetch(dl, { headers: { authorization: `Client-ID ${keys.unsplash}` } }).catch(() => {}); // Unsplash API guideline: report the download
        return json(res, 200, { ok: true });
      }
      res.writeHead(404); res.end();
    } catch (e) { json(res, 500, { error: e.message }); }
  });
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GrocerAI Photo Picker</title>
<style>body{font:15px/1.5 system-ui,Segoe UI,Arial;margin:0;background:#0f1a15;color:#e8f3ec}header{position:sticky;top:0;background:#13201a;border-bottom:1px solid #25382e;padding:12px 18px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
main{max-width:1200px;margin:0 auto;padding:16px}button{font:inherit;font-weight:700;border:1px solid #2f4a3c;background:#1a2b23;color:#e8f3ec;padding:8px 14px;border-radius:10px;cursor:pointer}button.p{background:#2fd08a;color:#062b19;border-color:#2fd08a}
input{font:inherit;padding:8px 12px;border-radius:10px;border:1px solid #2f4a3c;background:#0f1a15;color:#e8f3ec;min-width:240px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;margin-top:14px}
.c{background:#13201a;border:2px solid transparent;border-radius:14px;overflow:hidden;cursor:pointer;padding:0;text-align:left}.c:hover{border-color:#2fd08a}.c img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}.c span{display:block;padding:6px 10px;font-size:.8rem;color:#9bb0a3}
.cur{display:flex;gap:14px;align-items:center}.cur img{width:120px;height:90px;object-fit:cover;border-radius:12px;background:#1a2b23}.msg{padding:8px 12px;border-radius:10px;background:#1a2b23;margin-top:10px}.ok{color:#2fd08a}.err{color:#ff9a9a}</style></head>
<body><header><b>🥬 GrocerAI Photo Picker</b><span id="pos"></span><button id="prev">← Prev</button><button id="next">Next →</button><button id="nextmissing">Next without photo</button></header>
<main><div class="cur"><img id="cur" alt="current photo"><div><h2 id="name" style="margin:0"></h2><div id="has" class="msg"></div></div></div>
<form id="f" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><input id="q" aria-label="Search words"><button class="p">Search photos</button></form><div id="status" class="msg"></div><div id="grid" class="grid"></div></main>
<script>
let list=[],i=0,sources=[];const $=id=>document.getElementById(id);
const status=(t,c)=>{const s=$('status');s.textContent=t;s.className='msg '+(c||'')};
async function load(){const r=await (await fetch('/api/products')).json();list=r.products;sources=r.sources;i=Math.max(0,list.findIndex(p=>!p.hasPhoto));if(i<0)i=0;show()}
function show(){const p=list[i];$('pos').textContent=(i+1)+' / '+list.length;$('name').textContent=p.name;$('q').value=p.query;$('cur').src='/current/'+p.slug+'?t='+Date.now();$('cur').style.visibility=p.hasPhoto?'visible':'hidden';$('has').textContent=p.hasPhoto?'Current photo shown. Pick another below to replace it.':'No photo yet.';search()}
async function search(){const p=list[i];$('grid').replaceChildren();if(!sources.length){status('No photo API key in server/.env. Run "npm run setup" first.','err');return}status('Searching '+sources.join(', ')+'…');
const r=await (await fetch('/api/candidates?slug='+encodeURIComponent(p.slug)+'&q='+encodeURIComponent($('q').value))).json();if(r.error){status(r.error,'err');return}
status(r.candidates.length?'Click the best photo ('+r.candidates.length+' results)'+(r.errors.length?' — '+r.errors.join(' | '):''):'No results. Try different words.'+(r.errors.length?' '+r.errors.join(' | '):''),r.candidates.length?'':'err');
for(const c of r.candidates){const b=document.createElement('button');b.className='c';const im=document.createElement('img');im.src=c.thumb;im.loading='lazy';const sp=document.createElement('span');sp.textContent=c.label;b.append(im,sp);b.onclick=()=>choose(c);$('grid').append(b)}}
async function choose(c){status('Saving…');const r=await fetch('/api/choose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slug:list[i].slug,url:c.url,credit:c.credit})});const j=await r.json();if(!r.ok){status(j.error||'Failed','err');return}list[i].hasPhoto=true;status('Saved ✓','ok');if(i<list.length-1){i++;show()}else show()}
$('f').onsubmit=e=>{e.preventDefault();search()};$('prev').onclick=()=>{if(i>0){i--;show()}};$('next').onclick=()=>{if(i<list.length-1){i++;show()}};
$('nextmissing').onclick=()=>{const n=list.findIndex((p,k)=>k>i&&!p.hasPhoto);if(n>=0){i=n;show()}else status('Every product has a photo 🎉','ok')};load();
</script></body></html>`;
