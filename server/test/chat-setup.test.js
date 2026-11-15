import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { products as seed } from '../src/data/seedProducts.js';
import { copilot } from '../src/ai/copilot.js';
import { setEnvKeys, readEnv } from '../src/lib/envFile.js';
import { listModels, testChat, pickDefault } from '../src/lib/aiSetup.js';

const GOOD = 'good-key-' + 'x'.repeat(20), BAD = 'bad-key-' + 'x'.repeat(20); // real keys are 20+ chars; shorter ones are ignored by design
const P = seed.map((p, i) => ({ ...p, id: `id${i}` }));
const fake = (fn) => ({ name: 'fake', complete: async (a) => fn(a) });

test('with an LLM, any message gets a real answer (not "no products matched")', async () => {
  const llm = fake(() => JSON.stringify({ reply: 'Hello! How can I help with your groceries today?', cookDish: null }));
  for (const m of ['hello', 'tell me a joke', "what's the capital of France?", 'is it okay to eat rice daily']) {
    const r = await copilot({ message: m, products: P, llm }); assert.equal(r.source, 'llm-chat', m); assert.match(r.reply, /Hello/);
  }
});
test('LLM names a dish => server builds a stock-matched shopping list (any dish, not just the catalogue)', async () => {
  const llm = fake(({ system }) => (/cookDish/.test(system) ? JSON.stringify({ reply: 'Great choice! Here is what you need.', cookDish: 'Chicken Biryani' }) : JSON.stringify({ name: 'Chicken Biryani', servings: 4, ingredients: [{ label: 'Basmati rice', qty: 400, unit: 'g' }, { label: 'Chicken', qty: 500, unit: 'g' }, { label: 'Onions', qty: 200, unit: 'g' }], steps: ['Marinate.', 'Layer and cook.'] })));
  const r = await copilot({ message: 'veg biryani or chicken biryani? teach me', products: P, llm });
  assert.equal(r.source, 'llm-chat'); assert.ok(r.cards.recipe); assert.deepEqual(r.cards.recipe.unavailable, ['Chicken']);
  assert.equal(r.cards.recipe.lines.find((l) => l.label === 'Onions').status, 'matched');
});
test('JSON-less or failing LLM replies degrade gracefully', async () => {
  const plain = await copilot({ message: 'hello there', products: P, llm: fake(() => 'Hi! Plain text reply.') });
  assert.equal(plain.reply, 'Hi! Plain text reply.');
  const broken = await copilot({ message: 'hello there', products: P, llm: fake(() => { throw new Error('boom'); }) });
  assert.equal(broken.source, 'rule-based'); assert.ok(broken.reply.length > 5);
});
test('without an LLM, an unknown dish gets recipe ideas plus the setup hint (and "veg biryani" now exists)', async () => {
  const r = await copilot({ message: 'veg biryani', products: P }); assert.equal(r.cards.recipe.recipe.slug, 'veg-biryani'); assert.equal(r.intent, 'recipe');
  const r2 = await copilot({ message: 'i want to cook veg biryani', products: P }); assert.equal(r2.cards.recipe.recipe.slug, 'veg-biryani'); assert.deepEqual(r2.cards.recipe.unavailable, []);
  const r3 = await copilot({ message: 'quantum soufflé', products: P }); assert.match(r3.reply, /npm run setup/);
});

test('.env writer replaces active keys, keeps others, adds new ones', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'env-')), '.env');
  fs.writeFileSync(f, 'PORT=4000\n# LLM_MODEL=old\nSTORE_MODE=local\nLLM_MODEL=a\n');
  setEnvKeys(f, { LLM_MODEL: 'b', LLM_API_KEY: 'k=with=equals' });
  const e = readEnv(f); assert.equal(e.PORT, '4000'); assert.equal(e.STORE_MODE, 'local'); assert.equal(e.LLM_MODEL, 'b'); assert.equal(e.LLM_API_KEY, 'k=with=equals');
  assert.match(fs.readFileSync(f, 'utf8'), /# LLM_MODEL=old/);
});
test('provider helpers: model discovery filters non-chat models; test call falls back to the models/ prefix', async () => {
  const srv = http.createServer((req, res) => {
    if (req.headers.authorization !== 'Bearer good') { res.statusCode = 401; return res.end('{}'); }
    if (req.url === '/models') return res.end(JSON.stringify({ data: [{ id: 'models/gemini-x-flash' }, { id: 'whisper-large' }, { id: 'llama-3.3-70b' }, { id: 'models/text-embedding-1' }] }));
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { const m = JSON.parse(b).model; if (m.startsWith('models/')) return res.end(JSON.stringify({ choices: [{ message: { content: 'ready' } }] })); res.statusCode = 404; res.end('{}'); });
  }).listen(0); const baseUrl = `http://127.0.0.1:${srv.address().port}`;
  const ids = await listModels({ baseUrl, apiKey: 'good' }); assert.deepEqual(ids, ['gemini-x-flash', 'llama-3.3-70b']);
  assert.equal(pickDefault(ids, /flash/i), 'gemini-x-flash');
  await assert.rejects(() => listModels({ baseUrl, apiKey: 'bad' }), /rejected this key/);
  const t = await testChat({ baseUrl, apiKey: 'good', model: 'gemini-x-flash' }); assert.equal(t.ok, true); assert.equal(t.model, 'models/gemini-x-flash');
  assert.equal((await testChat({ baseUrl, apiKey: 'bad', model: 'm' })).ok, false);
  srv.close();
});

test('Pexels downloader: replaces old Wikipedia photos, keeps the user\'s own, handles misses and bad keys', async () => {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), port = srv.address().port;
    if (u.pathname === '/v1/search') {
      if (req.headers.authorization === BAD) { res.statusCode = 401; return res.end('{}'); }
      if (u.searchParams.get('query').startsWith('carrots')) return res.end(JSON.stringify({ photos: [] }));
      return res.end(JSON.stringify({ photos: [{ alt: 'something else', src: { large: `http://127.0.0.1:${port}/other.jpg` }, photographer: 'A' }, { alt: `${u.searchParams.get('query').split(' ')[0]} on table`, src: { large: `http://127.0.0.1:${port}/best.jpg` }, photographer: 'Pat', photographer_url: 'https://pexels.com/@pat', url: 'https://pexels.com/photo/1' }] }));
    }
    res.setHeader('content-type', 'image/jpeg'); res.end(Buffer.from(u.pathname === '/best.jpg' ? [1, 2, 3, 4] : [9, 9]));
  }).listen(0);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'px-')), base = `http://127.0.0.1:${srv.address().port}`;
  fs.writeFileSync(path.join(dir, 'onions.png'), 'old-wiki'); fs.writeFileSync(path.join(dir, 'CREDITS.json'), JSON.stringify({ onions: { page: 'https://en.wikipedia.org/wiki/Onion' } }));
  fs.writeFileSync(path.join(dir, 'potatoes.jpg'), 'MY OWN PHOTO'); // no credits entry => user's own
  const run = (key) => new Promise((r) => execFile('node', ['src/scripts/fetchPhotos.js'], { env: { ...process.env, PEXELS_API_KEY: key, PEXELS_BASE: base, PHOTO_DIR: dir, PHOTO_DELAY_MS: '0' } }, (e, so) => r(so)));
  const out = await run(GOOD);
  assert.deepEqual([...fs.readFileSync(path.join(dir, 'fresh-paneer.jpg'))], [1, 2, 3, 4]); // picked the relevant result, not the first
  assert.ok(!fs.existsSync(path.join(dir, 'onions.png')) && fs.existsSync(path.join(dir, 'onions.jpg'))); // wikipedia photo replaced
  assert.equal(fs.readFileSync(path.join(dir, 'potatoes.jpg'), 'utf8'), 'MY OWN PHOTO');
  assert.match(out, /1 failed/); assert.match(out, /carrots/);
  const cr = JSON.parse(fs.readFileSync(path.join(dir, 'CREDITS.json'), 'utf8')); assert.equal(cr['fresh-paneer'].photographer, 'Pat'); assert.equal(cr['fresh-paneer'].source, 'pexels');
  const again = await run(GOOD); assert.match(again, /0 downloaded/); // idempotent
  const bad = await run(BAD); fs.rmSync(path.join(dir, 'fresh-paneer.jpg')); const bad2 = await run(BAD); assert.match(bad2, /rejected your API key/);
  srv.close(); fs.rmSync(dir, { recursive: true });
});

test('Pixabay downloader: picks tag-relevant hit, replaces Wikipedia photos, keeps user photos, fatal on bad key', async () => {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), port = srv.address().port;
    if (u.pathname === '/api/') {
      if (u.searchParams.get('key') === BAD) { res.statusCode = 400; return res.end('[ERROR 400] Invalid API key'); }
      const first = u.searchParams.get('q').split(' ')[0];
      if (first === 'carrots') return res.end(JSON.stringify({ hits: [] }));
      return res.end(JSON.stringify({ hits: [{ tags: 'unrelated, thing', largeImageURL: `http://127.0.0.1:${port}/other.jpg`, user: 'X' }, { tags: `${first}, food, fresh`, largeImageURL: `http://127.0.0.1:${port}/best.jpg`, user: 'Sam', pageURL: 'https://pixabay.com/photos/1' }] }));
    }
    res.setHeader('content-type', 'image/jpeg'); res.end(Buffer.from(u.pathname === '/best.jpg' ? [7, 7, 7] : [9]));
  }).listen(0);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-')), base = `http://127.0.0.1:${srv.address().port}`;
  fs.writeFileSync(path.join(dir, 'onions.png'), 'old'); fs.writeFileSync(path.join(dir, 'CREDITS.json'), JSON.stringify({ onions: { page: 'https://en.wikipedia.org/wiki/Onion' } }));
  fs.writeFileSync(path.join(dir, 'potatoes.jpg'), 'MINE');
  const run = (key) => new Promise((r) => execFile('node', ['src/scripts/fetchPhotos.js'], { env: { ...process.env, PEXELS_API_KEY: '', PIXABAY_API_KEY: key, PIXABAY_BASE: base, PHOTO_DIR: dir, PHOTO_DELAY_MS: '0' } }, (e, so) => r(so)));
  const out = await run(GOOD);
  assert.deepEqual([...fs.readFileSync(path.join(dir, 'fresh-paneer.jpg'))], [7, 7, 7]); assert.match(out, /Using pixabay/);
  assert.ok(!fs.existsSync(path.join(dir, 'onions.png')) && fs.existsSync(path.join(dir, 'onions.jpg')));
  assert.equal(fs.readFileSync(path.join(dir, 'potatoes.jpg'), 'utf8'), 'MINE'); assert.match(out, /carrots/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'CREDITS.json'), 'utf8'))['fresh-paneer'].source, 'pixabay');
  assert.match(await run(GOOD), /0 downloaded/);
  fs.rmSync(path.join(dir, 'fresh-paneer.jpg')); assert.match(await run(BAD), /rejected your API key/);
  srv.close(); fs.rmSync(dir, { recursive: true });
});

test('model default avoids weak/irrelevant models and key validation rejects typos', async () => {
  const { PROVIDERS, looksLikeKey } = await import('../src/lib/aiSetup.js');
  assert.equal(pickDefault(['allam-2-7b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b'], PROVIDERS[1].prefer), 'llama-3.3-70b-versatile');
  assert.equal(pickDefault(['allam-2-7b', 'openai/gpt-oss-120b', 'zzz'], PROVIDERS[1].prefer), 'openai/gpt-oss-120b');
  assert.equal(pickDefault(['gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'], PROVIDERS[2].prefer), 'gemini-2.5-flash');
  assert.equal(looksLikeKey('2'), false); assert.equal(looksLikeKey('has space in it 123456789012345'), false); assert.equal(looksLikeKey('x'.repeat(30)), true);
  const srv = http.createServer((q, r) => r.end(JSON.stringify({ data: [{ id: 'allam-2-7b' }, { id: 'llama-3.3-70b' }] }))).listen(0);
  assert.deepEqual(await listModels({ baseUrl: `http://127.0.0.1:${srv.address().port}`, apiKey: 'k' }), ['llama-3.3-70b']); srv.close(); // allam filtered out
});
test('an invalid key left in .env (like "2") is ignored instead of breaking photo download', async () => {
  const srv = http.createServer((req, res) => { if (req.url.startsWith('/api/rest_v1/')) { res.statusCode = 404; return res.end('{}'); } res.end('x'); }).listen(0);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bad-'));
  const out = await new Promise((r) => execFile('node', ['src/scripts/fetchPhotos.js', '--only=carrots'], { env: { ...process.env, PEXELS_API_KEY: '2', PIXABAY_API_KEY: '', WIKI_BASE: `http://127.0.0.1:${srv.address().port}`, PHOTO_DIR: dir, PHOTO_DELAY_MS: '0' } }, (e, so) => r(so)));
  srv.close(); assert.match(out, /Ignoring invalid PEXELS_API_KEY/); assert.doesNotMatch(out, /rejected your API key/); fs.rmSync(dir, { recursive: true });
});

test('setup: models are ranked best-first, and a failed test reports the provider\'s real message', async () => {
  const { rankModels, PROVIDERS } = await import('../src/lib/aiSetup.js');
  assert.deepEqual(rankModels(['zzz', 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'aaa'], PROVIDERS[1].prefer), ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'zzz', 'aaa']);
  const srv = http.createServer((q, r) => { r.statusCode = 404; r.end(JSON.stringify({ error: { message: 'The model `x` does not exist or you do not have access to it.' } })); }).listen(0);
  const out = await testChat({ baseUrl: `http://127.0.0.1:${srv.address().port}`, apiKey: 'k', model: 'x' }); srv.close();
  assert.equal(out.ok, false); assert.match(out.error, /HTTP 404: The model `x` does not exist/);
});
