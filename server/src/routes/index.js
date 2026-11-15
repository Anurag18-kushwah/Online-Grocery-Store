import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { applyFilters, filterSchema } from '../services/filters.js';
import { recommend } from '../services/recommend.js';
import { analyzeBasket, missingForPlan } from '../services/optimizer.js';
import { substitutesFor } from '../services/substitutes.js';
import { findRecipe, buildRecipePlan, planMeals, searchRecipes, recipeThumbs, localRecipes } from '../services/recipes.js';
import { copilot } from '../ai/copilot.js';
import { understand, llmRecipe } from '../ai/understand.js';
import { unitPrice } from '../utils/units.js';
import { notifyAdminNewOrder } from '../services/orderNotifications.js';
import { slugify } from '../data/seedProducts.js';
import { asyncHandler as ah, HttpError, signToken, authMiddleware, rateLimit } from '../middleware/index.js';

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, addresses: u.addresses || [] });
const guestId = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);
const addressSchema = z.object({ id: z.string().max(40).optional(), label: z.string().min(1).max(30), line1: z.string().min(3).max(120), city: z.string().min(2).max(50), pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits') });
const prefsSchema = z.object({ dietary: z.array(z.string().max(30)).max(6).default([]), avoidAllergens: z.array(z.string().max(30)).max(10).default([]), favouriteBrands: z.array(z.string().max(40)).max(10).default([]), monthlyBudget: z.coerce.number().min(0).max(1e6).nullable().optional(), personalisationConsent: z.boolean().default(false) });
const goalsSchema = z.object({ minimizeSpend: z.boolean().optional(), maximizeValue: z.boolean().optional(), healthier: z.boolean().optional(), frequent: z.boolean().optional(), minimizeSubstitutions: z.boolean().optional(), avoid: z.array(z.string().max(30)).max(10).optional() });

export function buildRouter({ store, config, llm }) {
  const r = Router();
  const auth = authMiddleware({ store, secret: config.jwtSecret });
  const authLimiter = rateLimit({ windowMs: 60_000, max: 20 });

  // ---------- helpers ----------
  const ownerKey = (req) => {
    if (req.user) return `u:${req.user.id}`;
    const g = guestId.safeParse(req.headers['x-guest-id']);
    if (!g.success) throw new HttpError(400, 'Missing or invalid X-Guest-Id header');
    return `g:${g.data}`;
  };
  const hydrateCart = async (key) => {
    const items = await store.getCart(key); const out = [];
    for (const it of items) { const p = await store.getProduct(it.productId); if (p) out.push({ product: p, qty: it.qty, lineTotal: p.price * it.qty }); }
    return { items: out, total: out.reduce((t, i) => t + i.lineTotal, 0), count: out.reduce((t, i) => t + i.qty, 0) };
  };
  const userContext = async (user) => {
    if (!user) return { prefs: null, history: null };
    const prefs = await store.getPrefs(user.id);
    let history = null;
    if (prefs?.personalisationConsent) history = (await store.ordersByUser(user.id)).filter((o) => o.status !== 'cancelled').flatMap((o) => o.items.map((i) => ({ productId: i.productId, qty: i.qty })));
    return { prefs, history };
  };

  // ---------- auth ----------
  r.post('/auth/register', authLimiter, ah(async (req, res) => {
    const b = z.object({ name: z.string().trim().min(2).max(60), email: z.string().trim().email().max(120), password: z.string().min(8).max(100) }).parse(req.body);
    if (await store.findUserByEmail(b.email)) throw new HttpError(409, 'An account with this email already exists');
    const user = await store.createUser({ name: b.name, email: b.email, passwordHash: await bcrypt.hash(b.password, 10), role: 'user' });
    res.status(201).json({ token: signToken(user, config.jwtSecret), user: publicUser(user) });
  }));
  r.post('/auth/login', authLimiter, ah(async (req, res) => {
    const b = z.object({ email: z.string().email(), password: z.string().min(1).max(100) }).parse(req.body);
    const user = await store.findUserByEmail(b.email);
    if (!user || !(await bcrypt.compare(b.password, user.passwordHash)) || user.role === 'admin') throw new HttpError(401, 'Incorrect email or password');
    res.json({ token: signToken(user, config.jwtSecret), user: publicUser(user) });
  }));
  // Separate admin portal endpoint. Shopper credentials can never obtain an admin session here.
  r.post('/auth/admin/login', authLimiter, ah(async (req, res) => {
    const b = z.object({ email: z.string().email(), password: z.string().min(1).max(100) }).parse(req.body);
    const user = await store.findUserByEmail(b.email);
    if (!user || user.role !== 'admin' || !(await bcrypt.compare(b.password, user.passwordHash))) throw new HttpError(401, 'Invalid administrator credentials');
    res.json({ token: signToken(user, config.jwtSecret), user: publicUser(user) });
  }));
  r.get('/auth/me', auth.required, ah(async (req, res) => res.json({ user: publicUser(req.user), preferences: await store.getPrefs(req.user.id) })));

  r.put('/me', auth.required, ah(async (req, res) => {
    const b = z.object({ name: z.string().trim().min(2).max(60).optional(), addresses: z.array(addressSchema).max(5).optional(), preferences: prefsSchema.optional() }).parse(req.body);
    const patch = {}; if (b.name) patch.name = b.name;
    if (b.addresses) patch.addresses = b.addresses.map((a, i) => ({ ...a, id: a.id || `addr${Date.now()}${i}` }));
    const user = Object.keys(patch).length ? await store.updateUser(req.user.id, patch) : req.user;
    const preferences = b.preferences ? await store.setPrefs(req.user.id, b.preferences) : await store.getPrefs(req.user.id);
    res.json({ user: publicUser(user), preferences });
  }));

  // ---------- catalogue ----------
  r.get('/categories', ah(async (_q, res) => res.json({ categories: await store.categories() })));
  r.get('/products', ah(async (req, res) => res.json({ ...applyFilters(await store.allProducts(), req.query), mode: store.mode })));
  r.get('/products/:idOrSlug', auth.optional, ah(async (req, res) => {
    const p = await store.getProduct(req.params.idOrSlug); if (!p) throw new HttpError(404, 'Product not found');
    const all = await store.allProducts(); const { prefs, history } = await userContext(req.user);
    res.json({ product: { ...p, unitPrice: Number(unitPrice(p)?.toFixed(2)) }, substitutes: substitutesFor(p, all, { prefs, history, limit: 4 }) });
  }));
  r.get('/search/suggest', ah(async (req, res) => {
    const q = z.string().trim().min(1).max(40).parse(req.query.q).toLowerCase();
    const all = await store.allProducts();
    res.json({ suggestions: all.filter((p) => p.name.toLowerCase().includes(q) || p.tags.some((t) => t.includes(q))).slice(0, 6).map((p) => ({ name: p.name, slug: p.slug, category: p.category })) });
  }));

  // ---------- cart (guest via X-Guest-Id, or signed-in) ----------
  r.get('/cart', auth.optional, ah(async (req, res) => res.json(await hydrateCart(ownerKey(req)))));
  r.post('/cart/changes', auth.optional, ah(async (req, res) => {
    const { changes } = z.object({ changes: z.array(z.object({ productId: z.string().min(1).max(60), qty: z.number().int().min(0).max(50), mode: z.enum(['set', 'add']).default('set') })).min(1).max(40) }).parse(req.body);
    const key = ownerKey(req); const map = new Map((await store.getCart(key)).map((i) => [i.productId, i.qty]));
    const warnings = [];
    for (const c of changes) {
      const p = await store.getProduct(c.productId); if (!p) throw new HttpError(404, `Product not found: ${c.productId}`);
      let qty = c.mode === 'add' ? (map.get(p.id) || 0) + c.qty : c.qty;
      if (qty > p.stock) { warnings.push(`Only ${p.stock} of ${p.name} in stock; quantity reduced.`); qty = p.stock; }
      if (qty <= 0) map.delete(p.id); else map.set(p.id, qty);
    }
    await store.setCart(key, [...map].map(([productId, qty]) => ({ productId, qty })));
    res.json({ ...(await hydrateCart(key)), warnings });
  }));
  r.delete('/cart', auth.optional, ah(async (req, res) => { await store.deleteCart(ownerKey(req)); res.json({ items: [], total: 0, count: 0 }); }));
  r.post('/cart/merge', auth.required, ah(async (req, res) => {
    const { guestId: g } = z.object({ guestId }).parse(req.body);
    const guest = await store.getCart(`g:${g}`), mine = new Map((await store.getCart(`u:${req.user.id}`)).map((i) => [i.productId, i.qty]));
    for (const it of guest) { const p = await store.getProduct(it.productId); if (p) mine.set(p.id, Math.min(p.stock, (mine.get(p.id) || 0) + it.qty)); }
    await store.setCart(`u:${req.user.id}`, [...mine].filter(([, q]) => q > 0).map(([productId, qty]) => ({ productId, qty }))); await store.deleteCart(`g:${g}`);
    res.json(await hydrateCart(`u:${req.user.id}`));
  }));

  // ---------- wishlist ----------
  r.get('/wishlist', auth.required, ah(async (req, res) => { const ids = await store.getWishlist(req.user.id); res.json({ products: (await Promise.all(ids.map((i) => store.getProduct(i)))).filter(Boolean) }); }));
  r.put('/wishlist/:id', auth.required, ah(async (req, res) => { if (!(await store.getProduct(req.params.id))) throw new HttpError(404, 'Product not found'); const ids = new Set(await store.getWishlist(req.user.id)); ids.add(req.params.id); await store.setWishlist(req.user.id, [...ids]); res.json({ ids: [...ids] }); }));
  r.delete('/wishlist/:id', auth.required, ah(async (req, res) => { const ids = (await store.getWishlist(req.user.id)).filter((i) => i !== req.params.id); await store.setWishlist(req.user.id, ids); res.json({ ids }); }));

  // ---------- orders / checkout ----------
  const checkoutAddress = (b, user) => b.address || user.addresses?.find((a) => a.id === b.addressId);
  const finishOrder = async ({ req, address, payment }) => {
    const cart = await hydrateCart(`u:${req.user.id}`); if (!cart.items.length) throw new HttpError(400, 'Your cart is empty');
    const lines = cart.items.map((i) => ({ productId: i.product.id, qty: i.qty }));
    const stock = await store.reserveStock(lines);
    if (!stock.ok) throw new HttpError(409, 'Some items are no longer available in the requested quantity', { problems: stock.problems });
    let order;
    try { order = await store.createOrder({ userId: req.user.id, items: cart.items.map((i) => ({ productId: i.product.id, name: i.product.name, unitPrice: i.product.price, qty: i.qty })), total: cart.total, payment, address }); }
    catch (e) { await store.releaseStock(lines); throw e; }
    await store.deleteCart(`u:${req.user.id}`);
    return order;
  };
  r.post('/orders', auth.required, ah(async (req, res) => {
    const b = z.object({ addressId: z.string().optional(), address: addressSchema.optional(), saveAddress: z.boolean().optional(), payment: z.enum(['cod']).default('cod') }).parse(req.body);
    const address = checkoutAddress(b, req.user); if (!address) throw new HttpError(400, 'A delivery address is required');
    const order = await finishOrder({ req, address, payment: { method: 'cod', status: 'pay-on-delivery' } });
    if (b.saveAddress && b.address) await store.updateUser(req.user.id, { addresses: [...(req.user.addresses || []), { ...b.address, id: `addr${Date.now()}` }].slice(-5) });
    void notifyAdminNewOrder({ order, customer: { name: req.user.name, email: req.user.email }, config: config.notifications });
    res.status(201).json({ order, paymentNote: 'Pay on delivery.' });
  }));

  // Razorpay Standard Checkout: gateway creates the order; card/UPI data never touches this server.
  r.get('/payments/razorpay/status', (_req, res) => res.json({ enabled: !!(config.razorpay?.keyId && config.razorpay?.keySecret), keyId: config.razorpay?.keyId || null }));
  r.post('/payments/razorpay/order', auth.required, ah(async (req, res) => {
    if (!config.razorpay?.keyId || !config.razorpay?.keySecret) throw new HttpError(503, 'Online payments are not configured yet. Please use Cash on Delivery.');
    const b = z.object({ addressId: z.string().optional(), address: addressSchema.optional(), saveAddress: z.boolean().optional() }).parse(req.body);
    const address = checkoutAddress(b, req.user); if (!address) throw new HttpError(400, 'A delivery address is required');
    const cart = await hydrateCart(`u:${req.user.id}`); if (!cart.items.length) throw new HttpError(400, 'Your cart is empty');
    const amount = Math.round(cart.total * 100); if (amount < 100) throw new HttpError(400, 'Minimum online payment is ₹1');
    const receipt = `ga_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const authHeader = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', { method: 'POST', headers: { authorization: `Basic ${authHeader}`, 'content-type': 'application/json' }, body: JSON.stringify({ amount, currency: 'INR', receipt, notes: { userId: req.user.id, customerEmail: req.user.email } }) });
    const gatewayOrder = await response.json();
    if (!response.ok) throw new HttpError(502, gatewayOrder.error?.description || 'Could not start payment. Please try again.');
    res.status(201).json({ gatewayOrderId: gatewayOrder.id, amount: gatewayOrder.amount, currency: gatewayOrder.currency, keyId: config.razorpay.keyId, customer: { name: req.user.name, email: req.user.email }, address, saveAddress: !!b.saveAddress });
  }));
  r.post('/payments/razorpay/verify', auth.required, ah(async (req, res) => {
    if (!config.razorpay?.keyId || !config.razorpay?.keySecret) throw new HttpError(503, 'Online payments are not configured');
    const b = z.object({ razorpay_order_id: z.string().min(1), razorpay_payment_id: z.string().min(1), razorpay_signature: z.string().min(1), address: addressSchema, saveAddress: z.boolean().optional() }).parse(req.body);
    const prior = await store.getOrderByPaymentOrderId(b.razorpay_order_id);
    if (prior) { if (prior.userId !== req.user.id) throw new HttpError(403, 'Payment does not belong to this account'); return res.json({ order: prior, paymentNote: 'Payment already verified.' }); }
    const expected = crypto.createHmac('sha256', config.razorpay.keySecret).update(`${b.razorpay_order_id}|${b.razorpay_payment_id}`).digest('hex');
    const sigA = Buffer.from(expected); const sigB = Buffer.from(b.razorpay_signature);
    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) throw new HttpError(400, 'Payment signature verification failed');
    const authHeader = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(b.razorpay_payment_id)}`, { headers: { authorization: `Basic ${authHeader}` } });
    let paymentData = await paymentResponse.json();
    if (!paymentResponse.ok || paymentData.order_id !== b.razorpay_order_id || paymentData.currency !== 'INR') throw new HttpError(402, 'Could not confirm this Razorpay payment. Please contact support if money was deducted.');
    const cart = await hydrateCart(`u:${req.user.id}`);
    const expectedAmount = Math.round(cart.total * 100);
    if (!cart.items.length || expectedAmount !== paymentData.amount) throw new HttpError(409, 'Your cart changed during payment. Contact support with payment ID ' + b.razorpay_payment_id);
    // Capture authorised payments when automatic capture is not enabled on the Razorpay account.
    if (paymentData.status === 'authorized') {
      const captureResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(b.razorpay_payment_id)}/capture`, {
        method: 'POST', headers: { authorization: `Basic ${authHeader}`, 'content-type': 'application/json' },
        body: JSON.stringify({ amount: expectedAmount, currency: 'INR' }),
      });
      paymentData = await captureResponse.json();
      if (!captureResponse.ok) throw new HttpError(402, paymentData.error?.description || 'Payment is authorised but capture failed. Please contact support.');
    }
    if (paymentData.status !== 'captured') throw new HttpError(402, 'Payment has not been captured yet. Please contact support before retrying.');
    const order = await finishOrder({ req, address: b.address, payment: { method: 'razorpay', status: 'captured', gatewayOrderId: b.razorpay_order_id, gatewayPaymentId: b.razorpay_payment_id, gatewaySignature: b.razorpay_signature } });
    if (b.saveAddress) await store.updateUser(req.user.id, { addresses: [...(req.user.addresses || []), { ...b.address, id: `addr${Date.now()}` }].slice(-5) });
    void notifyAdminNewOrder({ order, customer: { name: req.user.name, email: req.user.email }, config: config.notifications });
    res.status(201).json({ order, paymentNote: 'Payment verified and captured successfully.' });
  }));
  r.get('/orders', auth.required, ah(async (req, res) => res.json({ orders: await store.ordersByUser(req.user.id) })));
  r.get('/orders/:id', auth.required, ah(async (req, res) => { const o = await store.getOrder(req.params.id); if (!o || (o.userId !== req.user.id && req.user.role !== 'admin')) throw new HttpError(404, 'Order not found'); res.json({ order: o }); }));
  r.post('/orders/:id/cancel', auth.required, ah(async (req, res) => {
    const o = await store.getOrder(req.params.id); if (!o || o.userId !== req.user.id) throw new HttpError(404, 'Order not found');
    if (o.status !== 'placed') throw new HttpError(409, `Order is already ${o.status} and cannot be cancelled`);
    await store.releaseStock(o.items.map((i) => ({ productId: i.productId, qty: i.qty })));
    res.json({ order: await store.updateOrder(o.id, { status: 'cancelled' }) });
  }));

  // ---------- AI & intelligence ----------
  r.get('/ai/status', (_q, res) => res.json({ llm: llm ? llm.name : null, mode: llm ? 'llm-enhanced' : 'fallback-only', note: llm ? 'LLM is used only to phrase answers, parse queries (validated) and draft unlisted recipes. Calculations are deterministic.' : 'No LLM configured: all features run on deterministic logic.' }));
  r.post('/ai/parse-filter', ah(async (req, res) => { const { text } = z.object({ text: z.string().trim().min(2).max(200) }).parse(req.body); const u = await understand(text, llm); res.json({ intent: u.intent, filters: u.filters, entities: u.entities, chips: u.chips, source: u.source, note: u.note || null }); }));
  r.post('/ai/recommend', auth.optional, ah(async (req, res) => {
    const b = z.object({ viewed: z.array(z.string().max(60)).max(20).default([]), budget: z.number().min(0).max(1e6).nullable().optional(), limit: z.number().int().min(1).max(20).default(8), useCart: z.boolean().default(true) }).parse(req.body || {});
    const all = await store.allProducts(); const { prefs, history } = await userContext(req.user);
    let cart = []; if (b.useCart) { try { cart = (await store.getCart(ownerKey(req))).map((i) => i.productId); } catch { /* no guest id: skip */ } }
    res.json(recommend(all, { cart, viewed: b.viewed, history, prefs, budget: b.budget ?? prefs?.monthlyBudget ?? null, limit: b.limit }));
  }));
  r.post('/ai/optimize', auth.optional, ah(async (req, res) => {
    const b = z.object({ budget: z.number().min(0).max(1e6).nullable().optional(), goals: goalsSchema.default({}) }).parse(req.body || {});
    const cart = await hydrateCart(ownerKey(req)); if (!cart.items.length) throw new HttpError(400, 'Your cart is empty');
    const { prefs, history } = await userContext(req.user);
    res.json(analyzeBasket({ lines: cart.items.map((i) => ({ product: i.product, qty: i.qty })), products: await store.allProducts(), budget: b.budget ?? null, goals: b.goals, prefs, history }));
  }));
  r.get('/ai/substitutes/:id', auth.optional, ah(async (req, res) => {
    const p = await store.getProduct(req.params.id); if (!p) throw new HttpError(404, 'Product not found');
    const { prefs, history } = await userContext(req.user); const maxPrice = req.query.maxPrice ? z.coerce.number().parse(req.query.maxPrice) : null;
    res.json({ for: p, substitutes: substitutesFor(p, await store.allProducts(), { prefs, history, limit: 6, maxPrice }) });
  }));
  r.get('/ai/recipes', (_q, res) => res.json({ source: 'local-catalogue', aiEnabled: !!llm, recipes: localRecipes.map((r) => ({ slug: r.slug, name: r.name, meal: r.meal, servings: r.servings, dietary: r.dietary, minutes: r.minutes, thumbs: recipeThumbs(r) })) }));
  r.post('/ai/recipe', auth.optional, ah(async (req, res) => {
    const b = z.object({ query: z.string().trim().min(2).max(200).optional(), slug: z.string().max(60).optional(), servings: z.number().int().min(1).max(20).optional(), pantry: z.array(z.string().max(40)).max(30).default([]), diet: z.array(z.string().max(30)).max(5).optional(), budget: z.number().min(0).max(1e6).nullable().optional() }).parse(req.body);
    const parsed = b.query ? await understand(b.query, llm) : null;
    let recipe = b.slug ? localRecipes.find((x) => x.slug === b.slug) : b.query ? findRecipe(b.query) : null;
    if (!recipe && b.query && llm) recipe = await llmRecipe(llm, b.query, b.servings ?? parsed?.entities.servings ?? 4, b.diet ?? parsed?.filters.diet ?? []);
    if (!recipe) throw new HttpError(404, llm ? 'Could not draft a recipe for that dish. Try rephrasing.' : "That dish isn't in the local recipe catalogue. Enable the real-time AI (API key) to plan any dish, or pick a close match.", { aiEnabled: !!llm, closest: b.query ? searchRecipes(b.query, 6).map((r) => ({ slug: r.slug, name: r.name, minutes: r.minutes, meal: r.meal, thumbs: recipeThumbs(r) })) : [] });
    const { prefs } = await userContext(req.user);
    const plan = buildRecipePlan({ recipe, servings: b.servings ?? parsed?.entities.servings ?? recipe.servings, products: await store.allProducts(), pantry: [...b.pantry, ...(parsed?.entities.pantry || [])], diet: b.diet ?? parsed?.filters.diet ?? prefs?.dietary ?? [], avoid: prefs?.avoidAllergens || [], budget: b.budget ?? parsed?.entities.budget ?? null });
    let missing = null; try { const cart = await store.getCart(ownerKey(req)); missing = missingForPlan(plan, cart.map((i) => i.productId)); } catch { /* no cart context */ }
    res.json({ plan, missingFromCart: missing });
  }));
  r.post('/ai/mealplan', auth.optional, ah(async (req, res) => {
    const b = z.object({ days: z.number().int().min(1).max(14), servings: z.number().int().min(1).max(12), budget: z.number().min(0).max(1e6).nullable().optional(), meals: z.array(z.enum(['breakfast', 'dinner'])).min(1).default(['breakfast', 'dinner']), diet: z.array(z.string().max(30)).max(4).default([]) }).parse(req.body);
    const { prefs } = await userContext(req.user);
    const plan = planMeals({ ...b, budget: b.budget ?? null, products: await store.allProducts(), avoid: prefs?.avoidAllergens || [] });
    if (plan.error) throw new HttpError(422, plan.error);
    res.json({ plan });
  }));
  r.post('/ai/chat', auth.optional, ah(async (req, res) => {
    const { message, history: chatHistory } = z.object({ message: z.string().trim().min(1).max(500), history: z.array(z.object({ role: z.enum(['user', 'bot']), text: z.string().max(600) })).max(10).default([]) }).parse(req.body);
    let cartLines = []; try { cartLines = (await hydrateCart(ownerKey(req))).items.map((i) => ({ product: i.product, qty: i.qty })); } catch { /* guest without id */ }
    const { prefs, history } = await userContext(req.user);
    res.json(await copilot({ message, cartLines, products: await store.allProducts(), prefs, history, llm, chatHistory }));
  }));

  // ---------- admin ----------
  const admin = Router(); admin.use(auth.admin);
  const productInput = z.object({
    name: z.string().trim().min(2).max(120), description: z.string().max(500).default(''), category: z.string().min(2).max(40), brand: z.string().min(1).max(40),
    mrp: z.number().min(0).max(1e6), discountPercent: z.number().min(0).max(90).default(0), stock: z.number().int().min(0).max(1e6), unit: z.enum(['g', 'ml', 'pc']), packSize: z.number().positive().max(1e6),
    dietaryLabels: z.array(z.string().max(30)).max(8).default([]), allergens: z.array(z.string().max(30)).max(8).default([]), tags: z.array(z.string().max(30)).max(12).default([]),
    nutrition: z.object({ per: z.number().default(100), perUnit: z.string().default('g'), calories: z.number().min(0), protein: z.number().min(0), sugar: z.number().min(0), fat: z.number().min(0), source: z.string().default('admin-entered') }).nullable().default(null),
    ingredients: z.string().max(400).nullable().default(null), expiryDate: z.string().datetime().nullable().default(null), deliveryMinutes: z.number().int().min(1).max(240).nullable().default(null), emoji: z.string().max(8).default('🛒'),
    rating: z.number().min(0).max(5).default(0), ratingCount: z.number().int().min(0).default(0), imageUrl: z.string().max(300).optional(),
  });
  const withPrice = (b) => ({ ...b, price: Math.round(b.mrp * (1 - b.discountPercent / 100)), slug: slugify(b.name), imageUrl: b.imageUrl || '/images/products/_fallback.svg' });
  admin.get('/stats', ah(async (_q, res) => {
    const [orders, products] = await Promise.all([store.allOrders(), store.allProducts()]);
    const live = orders.filter((o) => o.status !== 'cancelled'); const sold = new Map();
    for (const o of live) for (const i of o.items) sold.set(i.name, (sold.get(i.name) || 0) + i.qty);
    const byStatus = {}; for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    res.json({ computedFrom: 'stored orders and products', orders: orders.length, revenue: live.reduce((t, o) => t + o.total, 0), byStatus, products: products.length, outOfStock: products.filter((p) => p.stock === 0).map((p) => p.name), lowStock: products.filter((p) => p.stock > 0 && p.stock < 30).sort((a, b) => a.stock - b.stock).slice(0, 8).map((p) => ({ id: p.id, name: p.name, stock: p.stock })), topProducts: [...sold].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty })) });
  }));
  admin.post('/products', ah(async (req, res) => { const d = withPrice(productInput.parse(req.body)); if (await store.getProduct(d.slug)) throw new HttpError(409, 'A product with this name already exists'); res.status(201).json({ product: await store.createProduct(d) }); }));
  admin.put('/products/:id', ah(async (req, res) => { const d = withPrice(productInput.parse(req.body)); const p = await store.updateProduct(req.params.id, d); if (!p) throw new HttpError(404, 'Product not found'); res.json({ product: p }); }));
  admin.patch('/products/:id/stock', ah(async (req, res) => { const { stock } = z.object({ stock: z.number().int().min(0).max(1e6) }).parse(req.body); const p = await store.updateProduct(req.params.id, { stock }); if (!p) throw new HttpError(404, 'Product not found'); res.json({ product: p }); }));
  admin.delete('/products/:id', ah(async (req, res) => { if (!(await store.deleteProduct(req.params.id))) throw new HttpError(404, 'Product not found'); res.json({ deleted: true }); }));
  admin.put('/categories', ah(async (req, res) => { const c = z.object({ slug: z.string().regex(/^[a-z0-9-]{2,30}$/), name: z.string().min(2).max(40), emoji: z.string().max(8).optional(), color: z.string().max(9).optional() }).parse(req.body); res.json({ category: await store.upsertCategory(c) }); }));
  admin.delete('/categories/:slug', ah(async (req, res) => { if ((await store.allProducts()).some((p) => p.category === req.params.slug)) throw new HttpError(409, 'Category still has products'); if (!(await store.deleteCategory(req.params.slug))) throw new HttpError(404, 'Category not found'); res.json({ deleted: true }); }));
  admin.get('/orders', ah(async (_q, res) => {
    const orders = await store.allOrders();
    const enriched = await Promise.all(orders.map(async (o) => {
      const customer = await store.findUserById(o.userId);
      return { ...o, customer: customer ? { name: customer.name, email: customer.email } : null };
    }));
    res.json({ orders: enriched });
  }));
  admin.get('/notifications/status', (_q, res) => res.json({
    email: Boolean(config.notifications?.resendApiKey && config.notifications?.adminEmail && config.notifications?.emailFrom),
    whatsapp: Boolean(config.notifications?.twilioAccountSid && config.notifications?.twilioAuthToken && config.notifications?.twilioWhatsAppFrom && config.notifications?.adminWhatsApp),
    liveDashboard: true,
  }));
  admin.patch('/orders/:id', ah(async (req, res) => {
    const { status } = z.object({ status: z.enum(['placed', 'packed', 'delivered', 'cancelled']) }).parse(req.body);
    const o = await store.getOrder(req.params.id); if (!o) throw new HttpError(404, 'Order not found');
    if (status === 'cancelled' && o.status !== 'cancelled') await store.releaseStock(o.items.map((i) => ({ productId: i.productId, qty: i.qty })));
    if (o.status === 'cancelled' && status !== 'cancelled') throw new HttpError(409, 'Cancelled orders cannot be reopened');
    res.json({ order: await store.updateOrder(o.id, { status }) });
  }));
  r.use('/admin', admin);
  return r;
}
