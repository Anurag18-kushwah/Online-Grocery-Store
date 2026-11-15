import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildRouter } from './routes/index.js';
import { errorHandler } from './middleware/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ store, config, llm = null }) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
  if (config.clientOrigin) app.use(cors({ origin: config.clientOrigin.split(',') }));
  app.use(express.json({ limit: '100kb' }));
  // Real photos (downloaded with `npm run photos`) take precedence over the built-in placeholder illustrations.
  const imgDir = path.join(here, '../public/images/products');
  app.get('/images/products/:name.svg', (req, res, next) => {
    if (!/^[a-z0-9-]+$/.test(req.params.name)) return next();
    for (const ext of ['jpg', 'jpeg', 'png', 'webp']) { const f = path.join(imgDir, `${req.params.name}.${ext}`); if (fs.existsSync(f)) return res.sendFile(f, { maxAge: '1d' }); }
    next();
  });
  app.use('/images', express.static(path.join(here, '../public/images'), { maxAge: '1d' }));

  app.get('/api/health', (_req, res) => res.json({
    status: 'ok', store: store.mode, // 'local' = file-backed dev store, 'mongo' = MongoDB
    ai: llm ? llm.name : 'fallback-only', time: new Date().toISOString(),
  }));
  app.use('/api', buildRouter({ store, config, llm }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built React app (single-origin deployment) when present.
  const dist = path.join(here, '../../client/dist');
  if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html'))); }

  app.use(errorHandler);
  return app;
}
