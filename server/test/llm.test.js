import test from 'node:test';
import assert from 'node:assert/strict';
import { products as seed } from '../src/data/seedProducts.js';
import { copilot } from '../src/ai/copilot.js';
import { understand } from '../src/ai/understand.js';
import { createLLM, LLMError } from '../src/ai/provider.js';

const P = seed.map((p, i) => ({ ...p, id: `id${i}` }));
const fake = (fn) => ({ name: 'fake', complete: async (a) => fn(a) });

test('LLM filters are used only if they pass strict validation', async () => {
  const good = await understand('anything', fake(() => '{"maxPrice":150,"categories":["snacks"]}'));
  assert.equal(good.source, 'llm'); assert.deepEqual(good.filters, { maxPrice: 150, categories: ['snacks'] });
  for (const bad of ['{"$where":"evil()"}', '{"maxPrice":"lots"}', 'not json at all', '{"sort":"drop table"}']) {
    const r = await understand('vegetarian snacks under 200', fake(() => bad));
    assert.equal(r.source, 'rule-based', bad); assert.deepEqual(r.filters.categories, ['snacks']); assert.ok(r.note);
  }
});
test('copilot degrades gracefully on provider timeout / rate limit / outage', async () => {
  for (const kind of ['timeout', 'rate-limit', 'auth', 'network']) {
    const r = await copilot({ message: 'vegetarian snacks under ₹100', products: P, llm: fake(() => { throw new LLMError('x', kind); }) });
    assert.equal(r.source, 'rule-based'); assert.ok(r.cards.products.length > 0); assert.ok(r.reply.length > 10);
  }
});
test('LLM only rephrases; numbers/cards still come from deterministic tools', async () => {
  let seen;
  const r = await copilot({ message: 'compare rolled oats and corn flakes', products: P, llm: fake(({ prompt }) => { seen = prompt; return 'Oats are cheaper per 100 g.'; }) });
  assert.equal(r.source, 'llm-phrased'); assert.match(seen, /Facts:/); assert.equal(r.cards.compare.length, 2);
});
test('LLM-drafted recipes are flagged unverified and still matched against real stock', async () => {
  const llm = fake(({ system }) => (/recipes/.test(system) ? JSON.stringify({ name: 'Banana Oats', servings: 2, ingredients: [{ label: 'Rolled oats', qty: 80, unit: 'g' }, { label: 'Bananas', qty: 200, unit: 'g' }, { label: 'Dragonfruit foam', qty: 50, unit: 'g' }], steps: ['Mix.'] }) : 'ok'));
  const r = await copilot({ message: 'plan muesli parfait', products: P, llm });
  assert.match(r.cards.recipe.recipe.source, /unverified/);
  assert.deepEqual(r.cards.recipe.unavailable, ['Dragonfruit foam']); // not in catalogue => reported, never invented
});
test('provider factory: no credentials => null (fallback mode), never throws', () => {
  assert.equal(createLLM({ provider: 'none' }), null);
  assert.equal(createLLM({ provider: 'openai-compatible' }), null);
  assert.equal(createLLM({ provider: 'bedrock' }), null);
  assert.equal(createLLM({ provider: 'mystery' }), null);
});
test('provider timeout and error mapping (real HTTP, local server)', async () => {
  const http = await import('node:http');
  const srv = http.createServer((req, res) => { if (req.url.includes('slow')) return; res.statusCode = req.url.includes('limit') ? 429 : 200; res.end(JSON.stringify({ choices: [{ message: { content: 'hi' } }] })); }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const mk = (p) => createLLM({ provider: 'openai-compatible', baseUrl: `${base}/${p}`, apiKey: 'k', model: 'm', timeoutMs: 300 });
  assert.equal(await mk('ok').complete({ system: 's', prompt: 'p' }), 'hi');
  await assert.rejects(() => mk('slow').complete({ system: 's', prompt: 'p' }), (e) => e.kind === 'timeout');
  await assert.rejects(() => mk('limit').complete({ system: 's', prompt: 'p' }), (e) => e.kind === 'rate-limit');
  srv.close();
});
