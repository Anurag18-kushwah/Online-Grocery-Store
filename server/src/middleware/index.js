import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export class HttpError extends Error { constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; } }

export const signToken = (user, secret) => jwt.sign({ sub: user.id }, secret, { expiresIn: '7d' });

export function authMiddleware({ store, secret }) {
  const load = async (req) => {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return null;
    try { const { sub } = jwt.verify(h.slice(7), secret); return await store.findUserById(sub); } catch { return null; }
  };
  return {
    optional: asyncHandler(async (req, _res, next) => { req.user = await load(req); next(); }),
    required: asyncHandler(async (req, _res, next) => { req.user = await load(req); if (!req.user) throw new HttpError(401, 'Please sign in'); next(); }),
    admin: asyncHandler(async (req, _res, next) => {
      req.user = await load(req);
      if (!req.user) throw new HttpError(401, 'Please sign in');
      if (req.user.role !== 'admin') throw new HttpError(403, 'Admin access required'); // role is re-read from the DB on every request
      next();
    }),
  };
}

// Tiny in-memory fixed-window limiter (per IP). Fine for one process; use a shared store when scaling out.
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const k = req.ip, now = Date.now(), e = hits.get(k);
    if (!e || now - e.start > windowMs) { hits.set(k, { start: now, n: 1 }); return next(); }
    if (++e.n > max) return res.status(429).json({ error: 'Too many requests, please slow down.' });
    next();
  };
}

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) return res.status(400).json({ error: 'Invalid input', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
  if (/E11000|duplicate key/i.test(err?.message || '')) return res.status(409).json({ error: 'Already exists' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
