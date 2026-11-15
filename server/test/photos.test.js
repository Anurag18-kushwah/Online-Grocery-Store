import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { createPicker } from '../src/lib/photoPicker.js';

const KEY = 'k'.repeat(30);
const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
function mockPhotoApis() {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), port = srv.address().port, q = u.searchParams.get('query') || u.searchParams.get('q') || '';
    if (u.pathname === '/search/photos') { // unsplash
      if (req.headers.authorization === `Client-ID ${'x'.repeat(30)}`) { res.statusCode = 403; return res.end('Rate Limit Exceeded'); }
      return res.end(JSON.stringify({ results: [{ id: 'u1', alt_description: 'unrelated scene', likes: 999, urls: { small: `http://127.0.0.1:${port}/img/a.jpg`, regular: `http://127.0.0.1:${port}/img/a.jpg` } }, { id: 'u2', alt_description: `${q.split(' ')[0]} low likes`, likes: 5, urls: { regular: `http://127.0.0.1:${port}/img/b.jpg` } }, { id: 'u3', alt_description: `${q.split(' ')[0]} popular`, likes: 50, urls: { small: `http://127.0.0.1:${port}/img/c.jpg`, regular: `http://127.0.0.1:${port}/img/c.jpg` }, user: { name: 'Una' }, links: { html: 'https://unsplash.com/photos/u3', download_location: 'https://api.unsplash.com/photos/u3/download' } }] }));
    }
    if (u.pathname === '/api/') return res.end(JSON.stringify({ hits: [{ tags: `${q.split(' ')[0]}, food`, largeImageURL: `http://127.0.0.1:${port}/img/p.jpg`, webformatURL: `http://127.0.0.1:${port}/img/p.jpg`, user: 'Pio', pageURL: 'https://pixabay.com/p', likes: 10 }] }));
    if (u.pathname === '/img/notimage') { res.setHeader('content-type', 'text/html'); return res.end('<html>'); }
    if (u.pathname.startsWith('/img/')) { res.setHeader('content-type', 'image/jpeg'); return res.end(Buffer.from(u.pathname.includes('c.jpg') ? [3, 3, 3] : [1, 1])); }
    res.statusCode = 404; res.end('{}');
  });
  return srv;
}

test('photo picker: lists products, merges candidates from all keyed sources, saves the chosen photo with credits', async (t) => {
  const apis = mockPhotoApis(); const ap = await listen(apis); const base = `http://127.0.0.1:${ap}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pick-'));
  const picker = createPicker({ dir, env: { UNSPLASH_ACCESS_KEY: KEY, UNSPLASH_BASE: base, PIXABAY_API_KEY: KEY, PIXABAY_BASE: base, PICKER_ALLOW_HOSTS: '127.0.0.1' } });
  const pp = await listen(picker); const api = (p, o) => fetch(`http://127.0.0.1:${pp}${p}`, o).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null), r }));
  t.after(() => { picker.close(); apis.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  const list = (await api('/api/products')).body; assert.equal(list.products.length, 56); assert.deepEqual(list.sources.sort(), ['pixabay', 'unsplash']); assert.equal(list.products[0].hasPhoto, false);
  assert.ok((await fetch(`http://127.0.0.1:${pp}/`).then((r) => r.text())).includes('GrocerAI Photo Picker'));
  const c = (await api('/api/candidates?slug=carrots&q=carrots%20fresh')).body; assert.ok(c.candidates.length >= 4); assert.ok(c.candidates.every((x) => x.thumb && x.url && x.label));
  assert.equal((await api('/api/candidates?slug=nope')).status, 400);

  const pick = c.candidates.find((x) => x.url.endsWith('c.jpg') && x.credit.source === 'unsplash');
  assert.equal((await api('/api/choose', { method: 'POST', body: JSON.stringify({ slug: 'carrots', url: pick.url, credit: pick.credit }) })).status, 200);
  assert.deepEqual([...fs.readFileSync(path.join(dir, 'carrots.jpg'))], [3, 3, 3]);
  const credits = JSON.parse(fs.readFileSync(path.join(dir, 'CREDITS.json'), 'utf8')).carrots; assert.equal(credits.photographer, 'Una'); assert.equal(credits.picked, true);
  assert.equal((await fetch(`http://127.0.0.1:${pp}/current/carrots`)).status, 200);
  assert.equal((await api('/api/products')).body.products.find((p) => p.slug === 'carrots').hasPhoto, true);
});
test('photo picker security: unknown slug / path traversal / disallowed host / non-image are all rejected', async (t) => {
  const apis = mockPhotoApis(); const ap = await listen(apis); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pick2-'));
  const picker = createPicker({ dir, env: { PICKER_ALLOW_HOSTS: '127.0.0.1', PIXABAY_API_KEY: KEY, PIXABAY_BASE: `http://127.0.0.1:${ap}` } }); const pp = await listen(picker);
  t.after(() => { picker.close(); apis.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const choose = (b) => fetch(`http://127.0.0.1:${pp}/api/choose`, { method: 'POST', body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  assert.equal((await choose({ slug: '../../etc/passwd', url: `http://127.0.0.1:${ap}/img/a.jpg` })).status, 400);
  assert.equal((await choose({ slug: 'onions', url: 'http://evil.example.com/x.jpg' })).status, 400);
  assert.match((await choose({ slug: 'onions', url: 'http://evil.example.com/x.jpg' })).body.error, /not allowed/);
  assert.equal((await choose({ slug: 'onions', url: 'file:///etc/passwd' })).status, 400);
  assert.equal((await choose({ slug: 'onions', url: `http://127.0.0.1:${ap}/img/notimage` })).status, 400);
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f !== 'CREDITS.json'), []); // nothing written
  const noKeys = createPicker({ dir, env: {} }); const np = await listen(noKeys);
  const r = await fetch(`http://127.0.0.1:${np}/api/candidates?slug=onions`).then(async (x) => ({ s: x.status, b: await x.json() })); noKeys.close();
  assert.equal(r.s, 400); assert.match(r.b.error, /npm run setup/);
});
test('bulk downloader with Unsplash: picks the relevant AND most-liked photo; rate limit is a clear fatal message', async () => {
  const apis = mockPhotoApis(); const ap = await listen(apis); const base = `http://127.0.0.1:${ap}`; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uns-'));
  const run = (key, extra = []) => new Promise((r) => execFile('node', ['src/scripts/fetchPhotos.js', ...extra], { env: { ...process.env, UNSPLASH_ACCESS_KEY: key, PEXELS_API_KEY: '', PIXABAY_API_KEY: '', UNSPLASH_BASE: base, PHOTO_DIR: dir, PHOTO_DELAY_MS: '0' } }, (e, so) => r(so)));
  const out = await run(KEY, ['--only=fresh-paneer']);
  assert.match(out, /Using unsplash/); assert.deepEqual([...fs.readFileSync(path.join(dir, 'fresh-paneer.jpg'))], [3, 3, 3]); // 'paneer popular' (50 likes) beats 'paneer low likes' (5) and the 999-likes unrelated one
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'CREDITS.json'), 'utf8'))['fresh-paneer'].source, 'unsplash');
  const limited = await run('x'.repeat(30), ['--only=onions']); assert.match(limited, /Unsplash rate limit/); assert.ok(!fs.existsSync(path.join(dir, 'onions.jpg')));
  apis.close(); fs.rmSync(dir, { recursive: true, force: true });
});
