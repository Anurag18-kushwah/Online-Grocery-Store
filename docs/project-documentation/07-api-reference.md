# 7. API Reference
Base path `/api`; JSON payloads. Protected calls use `Authorization: Bearer <JWT>`. Guest cart uses `X-Guest-Id`. This is a concise route index based on the project's `docs/API.md`; check that file for exact schemas.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/auth/register` | Register `{name,email,password}`; password min 8 |
| POST | `/auth/login` | Login `{email,password}` |
| GET | `/auth/me` | Current user |
| PUT | `/me` | Update profile/preferences |
| GET | `/categories` | List categories |
| GET | `/products` | Product listing/search/filter/sort |
| GET | `/products/:idOrSlug` | Product detail |
| GET | `/search/suggest?q=` | Search suggestions |
| GET/POST | `/cart` | Read/add/update cart |
| POST | `/cart/changes` | Apply cart changes |
| DELETE | `/cart` | Clear cart |
| POST | `/cart/merge` | Merge guest cart |
| GET/PUT | `/wishlist` | Read/update wishlist |
| DELETE | `/wishlist/:id` | Remove wishlist item |
| POST | `/orders` | Checkout with address/addressId and mock/COD |
| GET | `/orders` | Order list |
| GET | `/orders/:id` | Order detail |
| POST | `/orders/:id/cancel` | Request cancellation |
| GET | `/ai/status` | AI status |
| POST | `/ai/parse-filter` | Parse natural-language filter |
| POST | `/ai/recommend` | Recommendations |
| POST | `/ai/optimize` | Basket optimisation |
| GET | `/ai/substitutes/:id` | Product substitutes |
| GET | `/ai/recipes` | Recipe list |
| POST | `/ai/recipe` | Recipe assistance |
| POST | `/ai/mealplan` | Meal plan |
| POST | `/ai/chat` | Copilot |
| GET | `/admin/stats` | Admin statistics |
| POST/PUT/DELETE | `/admin/products[/:id]` | Product CRUD |
| PATCH | `/admin/products/:id/stock` | Stock update |
| PUT/DELETE | `/admin/categories[/:slug]` | Category management |
| GET | `/admin/orders` | Admin order list |
| PATCH | `/admin/orders/:id` | Update order |

Product query filters documented include `q`, `minPrice`, `maxPrice`, `categories`, `brands`, `diet`, `excludeAllergens`, `inStock`, `maxDeliveryMins`, `minDiscount`, `minPackSize`, `maxPackSize`, `maxUnitPrice`, `minRating`, `minShelfLifeDays`, `minProtein`, `maxSugar`; sort values include `popular`, `price-asc`, `price-desc`, `discount`, `rating`, `value`.

Payment modes are demonstration mock/COD; no live gateway is claimed.
