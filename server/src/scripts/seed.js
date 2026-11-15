import mongoose from 'mongoose';
import fs from 'node:fs';
import { config, assertConfig } from '../config/index.js';
import { createStore } from '../services/storeFactory.js';
import { seedStore, DEMO_USER, DEMO_ADMIN } from '../services/seedData.js';
import { Product, Category, User, UserPreference, Cart, Wishlist, Order } from '../models/index.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

assertConfig();
if (config.storeMode === 'local') {
  const f = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../.local-db.json');
  fs.rmSync(f, { force: true });
  await createStore({ mode: 'local' });
  console.log('Local dev store re-seeded.');
} else {
  const store = await createStore({ mode: 'mongo', mongoUri: config.mongoUri });
  await Promise.all([Product, Category, User, UserPreference, Cart, Wishlist, Order].map((m) => m.deleteMany({})));
  await seedStore(store);
  await mongoose.disconnect();
  console.log('MongoDB seeded.');
}
console.log(`Demo user : ${DEMO_USER.email} / ${DEMO_USER.password}\nAdmin     : ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password}`);
