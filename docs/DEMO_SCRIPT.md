# 8-minute college demo script

**Setup (before class):** `npm run build && npm run seed && npm start` → open http://localhost:4000. Demo logins are on the sign-in page.

1. **Pitch (30 s).** "GrocerAI makes every grocery suggestion explainable. The core engine is deterministic and testable; an LLM is optional and clearly labelled."
2. **Home → cold start (30 s).** Logged out: "Popular right now" cards each show *Why this?* reasons from real data.
3. **Sign in as shopper demo (45 s).** Home becomes *Picked for you*: reasons like "You've bought this 11 times before". Profile → toggle personalisation consent off → recommendations stop using history. *(Privacy by design.)*
4. **Smart Filter 2.0 (90 s).** Shop → type "peanut-free low sugar snacks under ₹150" → chips appear ("understood as rule-based"). Remove a chip, use Clear all, try a no-result query to show suggestions. Note the banner: items without nutrition data are excluded and counted, never guessed.
5. **Basket Optimizer (90 s).** Add 5 × Basmati Rice 1 kg → Optimizer → budget ₹500 → Analyse. Shows ₹750 total, ₹250 over, a ₹100 pack-size swap with trade-offs, and an honest "still ₹150 over". Approve the swap: cart changes only now.
6. **Recipe → Cart (90 s).** Type "Plan vegetarian paneer fried rice for four people under ₹300", pantry "oil, salt, soy sauce". Show matched products, whole-pack cost (₹374) vs portions-used cost (≈₹194), unavailable items, Add selected to cart.
7. **Copilot (60 s).** Ask "I have ₹700 for breakfast and dinner groceries for three days. Suggest a vegetarian shopping list." Expand *Tools used*; point out the assumption notice and the fallback badge.
8. **Checkout (30 s).** Place order (mock payment banner). Orders page shows it.
9. **Admin (45 s).** Sign in as admin → stats computed from real orders → set a product's stock to 0 → it disappears from recommendations / shows Out of stock.
10. **Engineering close (30 s).** `npm test`: 64 tests (81 with a Mongo target) incl. the same API flow against MongoDB-protocol storage; recommender and optimizer verified against hand-computed numbers.
