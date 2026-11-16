# 11. Requirements Traceability Matrix
| Requirement | Implementation area | Suggested verification |
|---|---|---|
| FR-01/02 | Auth routes, User model, JWT | TC-01 to TC-04 |
| FR-03/04 | `/auth/me`, `/me`, preferences | Profile API tests |
| FR-05/06 | Product/category routes, filter engine | TC-06, TC-15 |
| FR-07/08 | Cart routes/store | TC-07 |
| FR-09 | `/cart/merge` | TC-08 |
| FR-10 | Wishlist routes/model | Wishlist tests |
| FR-11 | Order service and stock model | TC-09, TC-10 |
| FR-12/13 | Order routes/model | TC-11 and lifecycle tests |
| FR-14/15 | Recommendation and substitute services | Engine tests |
| FR-16/17 | Recipe/meal-plan services | Recipe/chat tests |
| FR-18 | Basket optimiser | Engine/API tests |
| FR-19 | Copilot intent router and LLM adapter | TC-12, TC-13 |
| FR-20 | Admin routes and role checks | TC-05 and admin tests |
| FR-21 | `/health` | Health endpoint test |

Module paths may change between commits; the checked-out repository is authoritative.
