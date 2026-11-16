# 12. Limitations and Future Scope
## Current limitations
1. Recommendation engine is deterministic hand-weighted scoring, not trained ML.
2. No live payment gateway; mock/COD only.
3. No courier tracking integration established.
4. No external retailer price comparison.
5. No supplier inventory synchronisation.
6. Nutrition, allergens, expiry, and ingredient data may be incomplete or approximate.
7. Basket optimiser is a heuristic/greedy aid, not a proof of global optimum.
8. Rate limiting is in-memory and not shared across server instances.
9. File-backed store is for local development, not shared production.
10. RecommendationEvent schema exists but event capture is not fully wired.
11. Optional LLM requires provider configuration and can fail due to latency, quota, or network.
12. Substitute ranking does not guarantee nutrition equivalence.

## Future work
- Add a verified payment gateway in sandbox-first stages.
- Integrate delivery partners and tracking.
- Sync supplier inventory and show data freshness.
- Improve catalogue provenance and nutrition/allergen verification.
- Wire consent-aware recommendation feedback and event analytics.
- Evaluate recommendation quality with labelled data before introducing trained ML.
- Add distributed rate limiting, background jobs, observability, audit logs, and backups.
- Add browser E2E, accessibility, load, and security testing.
- Add multilingual UI and privacy export/deletion workflows.

## Risks
| Risk | Mitigation |
|---|---|
| Incorrect allergen data | Verify source and show freshness; avoid medical claims |
| LLM hallucination | Tool-grounding, schema validation, fallback |
| Stock race | Server-side atomic/transactional stock validation |
| Secret leakage | Secret manager, rotation, repository scanning |
| Scaling limits | Shared database, distributed rate limit, monitoring |
