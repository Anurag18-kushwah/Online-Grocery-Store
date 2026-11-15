# GrocerAI — Smarter Choices. Fresher Living.

An explainable, AI-assisted online grocery platform (React + Vite · Node/Express · MongoDB). The Android project in the repo root is **untouched**; this is a separate web app (see *Migration decisions*).

## What's inside
| Feature | Where | How it works |
|---|---|---|
| **Intelligence Engine** | `server/src/services/recommend.js` | Deterministic hybrid score: content similarity (cart/viewed), purchase history (**consent-gated**), value-per-unit, discount, popularity, budget fit. Weights renormalise over components that apply. Each card shows reasons generated from the numbers. *Not an AI model, and labelled so.* |
| **Smart Filter 2.0** | `services/filters.js`, `FilterPanel` | 15+ combinable filters, chips, counts, clear-all, empty-state suggestions. Nutrition/shelf-life filters only match products with real data and report exclusions. |
| **Natural-language filters** | `services/nlQuery.js`, `ai/understand.js` | Rule-based parser; optional LLM output is accepted only if it passes the strict Zod schema. Never becomes a DB query. |
| **Basket Optimizer** | `services/optimizer.js` | Budget maths, expensive lines, duplicates, avoid-list conflicts, pack-size & alternative swaps with trade-offs. Every swap needs user approval. |
| **Substitution** | `services/substitutes.js` | Same category/unit, diet + allergen safe, ranked by purpose, unit price, brand, history, rating; shows price/pack/nutrition differences; nutrition equivalence never claimed without data. |
| **Recipe → Cart** | `services/recipes.js`, `data/recipes.js` | 42 local recipes (clearly labelled; any dish with an AI key), scaling, pantry, stock-aware matching, whole-pack vs used-portion cost, budget meal planner. |
| **AI Copilot** | `ai/copilot.js`, `ai/provider.js` | Intent → real tools (search, basket, recipe, plan, compare, substitutes). LLM (Bedrock / OpenAI-compatible) only rephrases results or drafts unlisted recipes (flagged *unverified*); timeouts, rate limits and auth failures fall back to deterministic replies. |
| **E-commerce** | `routes/index.js` | Auth (bcrypt + JWT), guest carts + merge, wishlist, profile/preferences/addresses, stock-validated checkout, orders, cancel, admin (stats, products, stock, categories, orders). |

## Quick start
Requirements: Node 20+.
```bash
cd grocerai
npm run install:all
cp .env.example server/.env        # edit: set JWT_SECRET, and either MONGODB_URI or STORE_MODE=local
```
**With MongoDB / Atlas** (set `MONGODB_URI` in `server/.env`):
```bash
npm run seed          # 56 products, 8 categories, demo users + order history
npm run build         # builds the React app
npm start             # http://localhost:4000  (API + UI on one port)
```
**Without MongoDB** (file-backed dev store, single process, *not for production*): put `STORE_MODE=local` in `server/.env`, then `npm run build && npm run start:local`. Data lives in `server/.local-db.json`; `npm run seed` resets it.

**Development with hot reload:** `npm run dev:server` and, in a second terminal, `npm run dev:client` → http://localhost:5173 (proxies `/api`).

**Docker:** `JWT_SECRET=$(openssl rand -hex 32) docker compose up --build` → http://localhost:4000, then `docker compose exec app node server/src/scripts/seed.js`. *(Dockerfiles were written but not executed in the authoring sandbox.)*

**MongoDB Atlas:** create a free cluster → Database Access user → Network Access (allow your IP) → Connect → copy the `mongodb+srv://…` URI into `MONGODB_URI`.

### Demo credentials (seeded)
Shopper `demo@grocerai.dev` / `Demo@1234` · Admin `admin@grocerai.dev` / `Admin@123`. Change or delete these before any public deployment.

## AI provider configuration
Works with **no keys**. To enable an LLM set `LLM_PROVIDER` in `server/.env`:
- `bedrock`: `AWS_REGION`, `BEDROCK_MODEL_ID` + standard AWS credentials (env vars or IAM role).
- `openai-compatible`: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`.
The header badge on the Copilot page shows which mode is active. Keys never reach the browser.

## One-command setup for real AI chat + real photos
```
npm run setup
```
It asks two things, tests them, saves them to `server/.env`, and downloads the photos:
1. **Real-time AI chat** (answers *anything*, drafts *any* recipe). Choose Groq or Gemini (free keys) or Ollama (free, local, no key). The script lists the models your key can use (so nothing goes stale), tests one, and saves it. Get a key: https://console.groq.com/keys or https://aistudio.google.com/apikey.
2. **Real photos.** Choose **Unsplash** (best-looking; free app at https://unsplash.com/oauth/applications, copy the *Access Key*), **Pixabay** (https://pixabay.com/api/docs/, easiest) or Pexels, and paste the free key. It downloads one real photo per product into `server/public/images/products/` with photographer credits in `CREDITS.json`. Without a key it falls back to Wikipedia images, which are inconsistent.

Then restart (`Ctrl+C`, `npm start`) and hard-refresh the browser (`Ctrl+F5`).

How the AI is used: the model chats freely and, when you want to cook something, names the dish; the **server** then drafts the recipe, matches ingredients to real in-stock products (anything unsold shows "Not sold here"), and computes every price and total. AI-drafted recipes are labelled "unverified". Without an AI key the app still works with 42 built-in recipes, smart search and honest "I can't answer that without AI" messages.

**Hand-pick the best photos:** automatic search can't judge looks, so run `npm run photos:pick`. It opens a local page (http://localhost:4400) that shows 9-27 real candidates per product from your keyed sources; click the best one and it is saved (then moves to the next product). You can edit the search words per product. Unsplash's demo key allows 50 searches/hour, which is plenty for the picker.

Photos: your own `server/public/images/products/<slug>.jpg` always wins and is never overwritten (slug = lowercase name with dashes, e.g. `carrots.jpg`). Photos are not scraped from Google (against its terms and the photos' licences). Pexels photos are free to use; keep `CREDITS.json` and credit "Photos: Pexels" in your report.

Not verified from the authoring sandbox: the live Groq / Gemini / Ollama / Pexels / Wikipedia services (unreachable there). The setup script's helpers, the chat paths and the photo downloader are tested against local mock servers, but `npm run setup` itself (interactive prompts) was not run end to end.

## Tests (`npm test`)
64 tests on the default (local-store) run, 81 when a MongoDB-protocol server is also available; all passed when last run. They cover: filters (hand-computed dataset), recommender (known data, consent gating, determinism), optimizer (exact ₹ amounts), substitutes, recipes (exact costs, scaling, unavailable items), NL parser (spec queries), LLM fallback (timeouts, invalid/malicious output, real HTTP error mapping), a shared store-contract suite, and a full API flow (register → cart → checkout → admin → cancel/restock → authorization). To also run the suite against a MongoDB-protocol server: `MONGO_TEST_URI=mongodb://127.0.0.1:27017/grocerai_test npm test`.

## Honest status & limitations
- **Verified here:** server logic and API (above); client **builds** (`vite build`) and is served by the server; seeded stack smoke-tested over HTTP.
- **Not verified here:** UI was **not viewed in a browser** (none available in the authoring sandbox) → expect small visual/responsive fixes; Docker files; real **MongoDB** (tests ran against **FerretDB**, a MongoDB-compatible server, not MongoDB itself); real **Bedrock/OpenAI** calls (code paths for timeouts/errors are tested against a local HTTP server and fakes, not the live services).
- Payments are a labelled **mock**; no card data is collected.
- No live inventory, delivery tracking or external price checks exist; the copilot says so.
- Seed nutrition values are approximate (`seed-approximate`). The *value score* compares unit price to the median of the same category and unit, so a bulk staple can look "cheap vs typical" next to spices; it is a relative indicator, not a quality claim.
- Recommendation weights are hand-set, not learned. The optimizer is a per-line greedy heuristic, not globally optimal.
- Filtering loads the catalogue in memory (fine for hundreds of products).
- Rate limiting is in-memory (single process). RecommendationEvent logging is modelled but not wired.

## Migration decisions
The root project is a native Android client (Java/Kotlin/Gradle) for a separate Java + PostgreSQL "Nearby Shops" backend that is not in the repo, so it cannot be evolved into a React/Express/MongoDB app. It was left intact; GrocerAI lives in `grocerai/` and only `.gitignore` was extended.

## Structure
```
grocerai/
  client/src/{pages,components.jsx,context.jsx,api.js,styles.css}
  server/src/{config,models,data,services,ai,routes,middleware,utils,scripts}
  server/test/   docs/API.md   docs/DEMO_SCRIPT.md   Dockerfile   docker-compose.yml
```
