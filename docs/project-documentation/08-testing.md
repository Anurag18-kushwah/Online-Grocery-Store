# 8. Testing and Quality Assurance
## Test coverage areas in source
The repository includes `api.test.js`, `chat-setup.test.js`, `engine.test.js`, `filters.test.js`, `helpers.js`, `llm.test.js`, `photos.test.js`, `recipes-chat.test.js`, and `store.contract.test.js`.

## Run
```bash
npm test
```
Use the root package.json as authority for exact scripts. The README reports 64 tests in default local-store mode and 81 when a MongoDB-protocol-compatible server is available. These are repository documentation claims, not freshly rerun results in this report.

## Suggested test cases
| ID | Scenario | Expected |
|---|---|---|
| TC-01 | Valid registration | Account created |
| TC-02 | Short password | Validation error |
| TC-03 | Invalid login | Authentication rejected |
| TC-04 | Protected endpoint without JWT | Unauthorized |
| TC-05 | Non-admin calls admin API | Forbidden |
| TC-06 | Search/filter catalogue | Matching results |
| TC-07 | Guest cart add | Cart updated |
| TC-08 | Guest cart merge | Items merged |
| TC-09 | Checkout quantity exceeds stock | Checkout rejected |
| TC-10 | Valid checkout | Order created, stock updated |
| TC-11 | Access another user's order | Denied/not found |
| TC-12 | LLM provider unavailable | Deterministic fallback |
| TC-13 | Invalid LLM structured response | Schema rejection |
| TC-14 | Optimisation request | Advisory suggestions returned |
| TC-15 | Excluded allergen filter | Matching labelled products omitted |

## Verification caveats
This documentation task did not run the tests, connect to a live MongoDB deployment, verify Bedrock/OpenAI credentials, or perform browser-based end-to-end testing. Project notes indicate some Mongo-protocol testing used FerretDB; this is not equivalent to production MongoDB. Run tests locally and attach genuine output/screenshots if required.
