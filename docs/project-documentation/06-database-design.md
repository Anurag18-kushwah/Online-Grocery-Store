# 6. Database Design
The data layer uses Mongoose models and supports MongoDB plus a file-backed local development store.

| Model | Main fields | Purpose |
|---|---|---|
| Category | slug, name, emoji, color | Catalogue grouping |
| Product | slug, name, description, category, brand, mrp, discountPercent, price, stock, unit, packSize, dietaryLabels, allergens, tags, rating, ratingCount, imageUrl, nutrition, ingredients, expiryDate, deliveryMinutes | Grocery catalogue |
| User | name, email, passwordHash, role, addresses | Account/access |
| UserPreference | userId, dietary, avoidAllergens, favouriteBrands, monthlyBudget, personalisationConsent | Shopper preferences |
| Cart | ownerKey, items(productId, qty) | Guest/user cart |
| Wishlist | userId, productIds | Saved products |
| Order | userId, items, total, status, payment, address | Purchases |
| RecommendationEvent | userId, kind, productId, query | Recommendation event schema |
| Recipe | slug, name, servings, dietary, source, ingredients | Recipe catalogue |

## Constraints and integrity
- Email is unique; password stored as hash.
- Role is `user` or `admin`.
- Product units include `g`, `ml`, `pc`.
- Order status values include `placed`, `packed`, `delivered`, `cancelled`.
- Preference personalisation consent defaults false.
- Cart owner key differentiates guest and signed-in users.
- Checkout must validate stock server-side; do not trust client totals.
- Keep database URI, JWT secret, and LLM keys in environment configuration.

The RecommendationEvent model exists, but event capture is not fully wired according to implementation notes. Seed README claims 56 products, 8 categories, demo accounts/order history, and 42 recipes; recheck the final seed files.
