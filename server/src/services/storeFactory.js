import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalStore, emptyData } from './store.local.js';
import { MongoStore } from './store.mongo.js';
import { seedStore } from './seedData.js';
import fs from 'node:fs';

const dataFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../.local-db.json');

export async function createStore({ mode, mongoUri, file = dataFile }) {
  if (mode === 'mongo') { const s = new MongoStore({ uri: mongoUri }); await s.connect(); return s; }
  // local: seed on first run (or when file is absent); file === null means pure in-memory (tests)
  const fresh = !file || !fs.existsSync(file);
  const store = new LocalStore({ file, seed: emptyData() });
  if (fresh) await seedStore(store);
  return store;
}
