import { config, assertConfig } from './config/index.js';
import { createStore } from './services/storeFactory.js';
import { createLLM } from './ai/provider.js';
import { createApp } from './app.js';

try { assertConfig(); } catch (e) { console.error(`\n[config] ${e.message}\n`); process.exit(1); }

let store;
try { store = await createStore({ mode: config.storeMode, mongoUri: config.mongoUri }); }
catch (e) { console.error(`\n[db] Could not start the ${config.storeMode} store: ${e.message}\nCheck MONGODB_URI, or use STORE_MODE=local for the file-backed dev store.\n`); process.exit(1); }
console.log(config.storeMode === 'local' ? '[store] LOCAL file-backed dev store (not for production). Reset with: npm run seed' : '[store] connected to MongoDB');
if (config.storeMode === 'mongo' && (await store.allProducts()).length === 0) console.warn('[store] database is empty. Run: npm run seed');

const llm = createLLM(config.llm);
console.log(llm ? `[ai] LLM provider: ${llm.name}` : '[ai] no LLM configured: running deterministic fallback mode');
createApp({ store, config, llm }).listen(config.port, () => console.log(`[api] http://localhost:${config.port}  (health: /api/health)`));
