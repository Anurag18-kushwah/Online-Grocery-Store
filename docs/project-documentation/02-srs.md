# 2. Software Requirements Specification
## Purpose and perspective
This SRS defines the functional and quality requirements of the GrocerAI web application. A React browser client calls a REST API served by Express. The API applies validation and access checks, invokes domain services, and reads/writes through the configured store. LLM assistance is optional.

## Functional requirements
| ID | Requirement |
|---|---|
| FR-01 | Register a user using name, email, and password. |
| FR-02 | Authenticate users and issue JWT credentials. |
| FR-03 | Return the current authenticated user's profile. |
| FR-04 | Update profile and shopping preferences. |
| FR-05 | List product categories and products. |
| FR-06 | Search, suggest, sort, and filter products. |
| FR-07 | Maintain a guest cart using a guest identifier. |
| FR-08 | Maintain an authenticated user's cart. |
| FR-09 | Merge guest cart after sign-in. |
| FR-10 | Maintain a user wishlist. |
| FR-11 | Validate stock and quantities at checkout. |
| FR-12 | List order history and order details. |
| FR-13 | Support cancellation where business rules allow. |
| FR-14 | Return deterministic product recommendations. |
| FR-15 | Suggest possible product substitutes. |
| FR-16 | List recipes and provide recipe assistance. |
| FR-17 | Generate meal-plan suggestions from available data. |
| FR-18 | Analyse basket and propose optimisation actions. |
| FR-19 | Route supported copilot intents to application tools. |
| FR-20 | Allow admins to manage catalogue, stock, categories, orders, and stats. |
| FR-21 | Provide a health endpoint. |

## Non-functional requirements
Security: hashed passwords, JWT protection, role checks, input validation. Privacy: purchase-history personalisation is consent-gated. Reliability: core functions should work without an LLM. Maintainability: separation of client, API, models, and domain services. Portability: Node.js runtime. Scalability caveats: local file store and in-memory rate limiting are not suitable for multi-instance production.

## Interfaces and business rules
API base path `/api`; protected requests use `Authorization: Bearer <token>`; guest cart uses `X-Guest-Id`. MongoDB mode requires a URI. Password registration minimum is eight characters. Admin endpoints require admin role. Checkout revalidates stock. LLM output is schema-validated. Recommendations and optimiser suggestions are advisory. Allergen/dietary filtering depends on catalogue label quality.

## Acceptance criteria
Valid users can register/login; shoppers can browse/filter, manage carts and wishlists, checkout valid stock, view orders, and access assistance endpoints; non-admin users cannot call admin endpoints; optional LLM failure falls back safely.
