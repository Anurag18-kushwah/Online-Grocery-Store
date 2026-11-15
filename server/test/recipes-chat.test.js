import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { products as seed } from '../src/data/seedProducts.js';
import { findRecipe, searchRecipes, buildRecipePlan, localRecipes } from '../src/services/recipes.js';
import { copilot } from '../src/ai/copilot.js';
import { targets, boot } from './helpers.js';

const P = seed.map((p, i) => ({ ...p, id: `id${i}` }));
const fake = (fn) => ({ name: 'fake', complete: async (a) => fn(a) });

test('the screenshot bug: "i want to cook paneer rice" finds the recipe; Maggi works', () => {
  assert.equal(findRecipe('i want to cook paneer rice').slug, 'paneer-fried-rice');
  assert.equal(findRecipe('maggi').slug, 'masala-noodles');
  assert.equal(findRecipe('How to make maggi noodles?').slug, 'masala-noodles');
  assert.equal(findRecipe('chicken biryani'), null);
  assert.equal(findRecipe('what can I cook with potatoes'), null); // ambiguous => suggestions, not a random dish
  const ideas = searchRecipes('what can I cook with potatoes', 10).map((r) => r.slug);
  assert.ok(ideas.includes('aloo-paratha') && ideas.includes('aloo-tikki'));
});
test('catalogue: 40+ recipes, every ingredient matches a real in-stock product (units, slugs, stock)', () => {
  assert.ok(localRecipes.length >= 40);
  const slugs = new Set(seed.map((p) => p.slug));
  for (const r of localRecipes) {
    for (const i of r.ingredients) assert.ok(i.slugs.every((s) => slugs.has(s)), `${r.slug}: bad slug in ${i.label}`);
    const plan = buildRecipePlan({ recipe: r, servings: r.servings, products: P });
    assert.deepEqual(plan.unavailable, [], `${r.slug} has unmatched ingredients`);
  }
  assert.equal(new Set(localRecipes.map((r) => r.slug)).size, localRecipes.length);
});
test('copilot without LLM: unknown dish gives honest suggestions and says how to enable AI', async () => {
  const r = await copilot({ message: 'i want to cook chicken biryani', products: P });
  assert.equal(r.source, 'rule-based'); assert.match(r.reply, /real-time AI/); assert.equal(r.cards.recipe, undefined);
  const r2 = await copilot({ message: 'i want to cook paneer rice', products: P });
  assert.equal(r2.cards.recipe.recipe.slug, 'paneer-fried-rice');
  const r3 = await copilot({ message: 'what can I cook with potatoes', products: P });
  assert.ok(r3.cards.ideas.length >= 3);
});
test('copilot with LLM: any dish is drafted, flagged unverified, and matched to real stock; open questions are answered conversationally', async () => {
  const llm = fake(({ system }) => (/recipes/.test(system) ? JSON.stringify({ name: 'Chicken Biryani', servings: 4, ingredients: [{ label: 'Basmati rice', qty: 400, unit: 'g' }, { label: 'Chicken', qty: 500, unit: 'g' }, { label: 'Onions', qty: 200, unit: 'g' }], steps: ['Cook.'] }) : 'Biryani is best with long-grain rice.'));
  const r = await copilot({ message: 'i want to cook chicken biryani', products: P, llm });
  assert.match(r.cards.recipe.recipe.source, /unverified/); assert.deepEqual(r.cards.recipe.unavailable, ['Chicken']); // not sold here => reported, not invented
  assert.ok(r.cards.recipe.lines.find((l) => l.label === 'Basmati rice').status === 'matched');
  let seen; const chat = await copilot({ message: 'Which rice is best for biryani?', products: P, llm: fake(({ prompt }) => { seen = prompt; return 'Basmati.'; }), chatHistory: [{ role: 'user', text: 'hello' }] });
  assert.equal(chat.source, 'llm-chat'); assert.match(seen, /catalogueMatches/); assert.match(seen, /Conversation so far/);
});

for (const { name, make } of targets) {
  test(`API: recipe endpoints + photo route [${name}]`, async (t) => {
    const app = await boot(await make()); t.after(app.close);
    const list = (await app.call('GET', '/api/ai/recipes')).body; assert.ok(list.recipes.length >= 40); assert.equal(list.aiEnabled, false); assert.ok(list.recipes[0].thumbs.length > 0);
    const miss = await app.call('POST', '/api/ai/recipe', { body: { query: 'chicken biryani' } });
    assert.equal(miss.status, 404); assert.equal(miss.body.aiEnabled, false); assert.match(miss.body.error, /API key|AI/);
    const near = await app.call('POST', '/api/ai/recipe', { body: { query: 'what can I cook with potatoes' } });
    assert.equal(near.status, 404); assert.ok(near.body.closest.length >= 3);
    assert.equal((await app.call('POST', '/api/ai/recipe', { body: { query: 'maggi', servings: 2 } })).body.plan.recipe.slug, 'masala-noodles');
    const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../public/images/products'), f = path.join(dir, 'zz-test-photo.jpg');
    fs.writeFileSync(f, Buffer.from([0xff, 0xd8, 0xff, 0xd9])); t.after(() => fs.rmSync(f, { force: true }));
    const base = app.base; const img = await fetch(`${base}/images/products/zz-test-photo.svg`);
    assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/jpeg');
    assert.equal((await fetch(`${base}/images/products/fresh-paneer.svg`)).headers.get('content-type'), 'image/svg+xml'); // placeholder still served when no photo
  });
}

test('photo downloader works against a mock Wikipedia, skips failures, writes credits', async () => {
  const srv = http.createServer((req, res) => {
    if (req.url.startsWith('/api/rest_v1/page/summary/')) {
      if (req.url.endsWith('/Carrot')) { res.statusCode = 404; return res.end('{}'); }
      return res.end(JSON.stringify({ thumbnail: { source: `http://127.0.0.1:${srv.address().port}/thumb/a/ab/x.jpg/320px-x.jpg` }, content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/X' } } }));
    }
    res.setHeader('content-type', 'image/jpeg'); res.end(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  }).listen(0);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'photos-'));
  const out = await new Promise((resolve) => execFile('node', ['src/scripts/fetchPhotos.js'], { env: { ...process.env, PEXELS_API_KEY: '', WIKI_BASE: `http://127.0.0.1:${srv.address().port}`, PHOTO_DIR: dir, PHOTO_DELAY_MS: '0' } }, (e, so) => resolve(so)));
  srv.close();
  assert.ok(fs.existsSync(path.join(dir, 'fresh-paneer.jpg')));
  assert.ok(!fs.existsSync(path.join(dir, 'carrots.jpg')));            // 404 page => no file, placeholder remains
  assert.match(out, /1 failed/); assert.match(out, /carrots/);
  assert.ok(JSON.parse(fs.readFileSync(path.join(dir, 'CREDITS.json'), 'utf8'))['fresh-paneer'].page);
  fs.rmSync(dir, { recursive: true });
});
