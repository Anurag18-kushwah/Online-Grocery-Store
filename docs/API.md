# GrocerAI API

Base URL `/api`. JSON in/out. Auth: `Authorization: Bearer <token>`. Guests send `X-Guest-Id: <8-64 chars [A-Za-z0-9-]>` for carts.
Errors: `{ "error": "message", "details"?: [...] }` with 400 (validation), 401, 403, 404, 409 (conflict / stock), 429, 500.

| Method & path | Auth | Purpose |
|---|---|---|
| GET `/health` | – | status, store (`mongo`/`local`), AI mode |
| POST `/auth/register` `{name,email,password≥8}` | – | create account (bcrypt-hashed) → `{token,user}` |
| POST `/auth/login` `{email,password}` | – | → `{token,user}` (rate-limited) |
| GET `/auth/me` | user | profile + preferences |
| PUT `/me` `{name?,addresses?,preferences?}` | user | update profile, addresses, preferences, personalisation consent |
| GET `/categories` | – | categories |
| GET `/products?…` | – | **Smart Filter 2.0**: `q,minPrice,maxPrice,categories,brands,diet,excludeAllergens,inStock,maxDeliveryMins,minDiscount,minPackSize,maxPackSize,maxUnitPrice,minRating,minShelfLifeDays,minProtein,maxSugar,sort(popular|price-asc|price-desc|discount|rating|value)`. Lists are comma-separated. Unknown/invalid params → 400. |
| GET `/products/:idOrSlug` | opt | product + smart substitutes |
| GET `/search/suggest?q=` | – | typeahead |
| GET `/cart` · POST `/cart/changes` `{changes:[{productId,qty,mode:set|add}]}` · DELETE `/cart` | opt | cart (guest or user); quantities are clamped to stock with warnings |
| POST `/cart/merge` `{guestId}` | user | merge guest cart after login |
| GET/PUT/DELETE `/wishlist[/:id]` | user | wishlist |
| POST `/orders` `{addressId|address,payment:mock|cod}` | user | checkout: re-validates and reserves stock atomically per line, snapshots prices, clears cart. **Payment is a labelled mock.** 409 + `problems[]` if stock changed |
| GET `/orders`, GET `/orders/:id`, POST `/orders/:id/cancel` | user | history; cancel only while `placed` (stock restored) |
| GET `/ai/status` | – | LLM configured or fallback-only |
| POST `/ai/parse-filter` `{text}` | – | NL → validated filters (+ intent, entities, chips, source) |
| POST `/ai/recommend` `{viewed?,budget?,limit?}` | opt | explainable hybrid recommendations; purchase history used **only** with consent |
| POST `/ai/optimize` `{budget?,goals}` | opt | basket analysis of the server cart; never modifies it |
| GET `/ai/substitutes/:id` | opt | ranked substitutes with price/pack/nutrition differences |
| GET `/ai/recipes`, POST `/ai/recipe` `{query|slug,servings?,pantry?,diet?,budget?}` | opt | recipe → matched products, cost, missing-from-cart |
| POST `/ai/mealplan` `{days,servings,budget?,meals,diet}` | opt | budgeted multi-day plan |
| POST `/ai/chat` `{message}` | opt | copilot with tool results + cards |
| GET `/admin/stats` · POST/PUT/DELETE `/admin/products[/:id]` · PATCH `/admin/products/:id/stock` · PUT `/admin/categories` · DELETE `/admin/categories/:slug` · GET `/admin/orders` · PATCH `/admin/orders/:id` | admin | management; role re-checked from DB on every request |
