// Interactive helper:  npm run setup   -> connect a real-time AI model and/or download real product photos.
import readline from 'node:readline/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setEnvKeys, readEnv } from '../lib/envFile.js';
import { PROVIDERS, listModels, testChat, rankModels, looksLikeKey } from '../lib/aiSetup.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envFile = path.join(root, '.env');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q) => (await rl.question(q)).trim();
const env = readEnv(envFile);
if (!env.JWT_SECRET || !env.STORE_MODE && !env.MONGODB_URI) {
  setEnvKeys(envFile, { PORT: env.PORT || 4000, ...(env.MONGODB_URI ? {} : { STORE_MODE: 'local' }), JWT_SECRET: env.JWT_SECRET || `secret-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}` });
}

console.log('\n=== GrocerAI setup ===\n');
console.log('1) REAL-TIME AI CHAT (answers any question, drafts any recipe)');
console.log('   Choose a provider:'); for (const [k, p] of Object.entries(PROVIDERS)) console.log(`   ${k}. ${p.name}`); console.log('   4. Skip (keep built-in logic only)');
const choice = await ask('Enter 1-4: ');
const prov = PROVIDERS[choice];
if (prov) {
  let apiKey = 'ollama';
  if (!prov.noKey) { console.log(`\nGet a free key at: ${prov.keyUrl}`); apiKey = await ask('Paste your API key here: '); }
  else console.log(`\nMake sure Ollama is installed and running (${prov.keyUrl}) and you ran e.g.: ollama pull llama3.2`);
  try {
    if (!prov.noKey && !looksLikeKey(apiKey)) throw new Error('That does not look like an API key (keys are long, 20+ characters). Copy the whole key from the website.');
    const ids = await listModels({ baseUrl: prov.baseUrl, apiKey });
    if (!ids.length) throw new Error('The provider returned no models.');
    const ranked = rankModels(ids, prov.prefer), shown = ranked.slice(0, 20);
    console.log('\nAvailable models (best first):'); shown.forEach((m, i) => console.log(`  ${i + 1}. ${m}${i === 0 ? '   <- recommended' : ''}`));
    const n = await ask('Pick a number, or just press Enter to let me try the best ones automatically: ');
    const candidates = n && shown[Number(n) - 1] ? [shown[Number(n) - 1]] : ranked.slice(0, 6);
    let t = null;
    for (const model of candidates) {
      process.stdout.write(`\nTesting ${model} ... `); const r = await testChat({ baseUrl: prov.baseUrl, apiKey, model });
      if (r.ok) { t = r; console.log(`works! (it said: "${r.sample}")`); break; }
      console.log(`✗ ${r.error}`);
    }
    if (!t) throw new Error(candidates.length > 1 ? 'none of the top models worked with this key (see reasons above).' : 'that model did not work (see reason above). Run setup again and choose another number.');
    setEnvKeys(envFile, { LLM_PROVIDER: 'openai-compatible', LLM_BASE_URL: prov.baseUrl, LLM_API_KEY: apiKey, LLM_MODEL: t.model });
    console.log('Saved to server/.env. The copilot badge will show the model name after you restart.');
  } catch (e) { console.log(`\n✗ Could not enable AI: ${e.message}\n  Nothing was changed. Run "npm run setup" again to retry.`); }
}

console.log('\n2) REAL PRODUCT PHOTOS (free key needed)');
console.log('   1. Unsplash - best-looking photos. Create a free app at https://unsplash.com/oauth/applications -> copy the "Access Key"');
console.log('   2. Pixabay  - https://pixabay.com/api/docs/  (key shown right after login; easiest)');
console.log('   3. Pexels   - https://www.pexels.com/api/');
console.log('   4. Skip');
const pc = await ask('Enter 1-4: ');
const photoProv = { 1: ['UNSPLASH_ACCESS_KEY', 'Unsplash Access Key'], 2: ['PIXABAY_API_KEY', 'Pixabay'], 3: ['PEXELS_API_KEY', 'Pexels'] }[pc];
if (photoProv) {
  const [envName, label] = photoProv; let pk = readEnv(envFile)[envName] || '';
  if (!looksLikeKey(pk)) pk = await ask(`Paste your ${label} key (the LONG code from their website, not the menu number): `);
  if (pk && !looksLikeKey(pk)) { console.log('\n✗ That does not look like a key (too short). Photos skipped; run "npm run setup" again when you have the key.'); pk = ''; }
  if (pk) {
    setEnvKeys(envFile, { [envName]: pk });
    console.log('\nDownloading photos (about 1-2 minutes)...\n');
    spawnSync(process.execPath, [path.join(root, 'src/scripts/fetchPhotos.js')], { stdio: 'inherit', env: { ...process.env, [envName]: pk } });
  }
}
rl.close();
console.log('\nAll done. Now restart the app:  Ctrl+C, then  npm start   (and Ctrl+F5 in the browser)');
console.log('Not happy with some photos? Hand-pick the best one for each product:  npm run photos:pick\n');
