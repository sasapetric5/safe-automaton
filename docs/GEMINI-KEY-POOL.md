# Gemini API Key Pool — development only

## Current implementation

- Endpoint: `POST /api/gemini-draft`.
- Server-side keys: `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3` as Cloudflare secrets. Never put keys in HTML, localStorage, JSON exports, commits, or logs.
- Endpoint authorization: `SAFE_AUTOMATON_GEMINI_TOKEN` (32+ characters) via `X-Safe-Automaton-Gemini-Token`.
- Master switch: `SAFE_AUTOMATON_GEMINI_ENABLED=true`; absent/other values keep it disabled.
- It requires an `AI_BUDGET_GUARD` service binding that implements an atomic, durable reservation protocol. Without that binding or a verified free-tier attestation, no request is sent to Google.
- API-key rotation is only attempted after HTTP 401 authentication rejection. HTTP 429, HTTP 402, any other provider failure, or uncertain billing/quota state stops immediately. Keys are assumed to belong to one Google project; they do not increase that project's quota.
- The generated output is an unverified draft; the endpoint never sends or publishes it.

## Critical limitations — do not enable yet

The repository has no `wrangler.toml`, `wrangler.json`, Durable Object class, migration, or configured `AI_BUDGET_GUARD` binding. Therefore the required guard is **not implemented/configured** and the endpoint must remain disabled. A missing binding intentionally causes a 503 response before any Gemini request.

The guard must be built and reviewed separately before enablement. It must use durable shared state and atomic reservations to enforce per-day request/token limits and a hard application budget of EUR 0, reject unknown billing state, and never return `free_verified` unless an operator has independently verified the exact Google AI Studio project/model billing tier. A plain environment variable or a Google API key cannot prove the account's billing tier. It must not reset/rotate counters merely because a provider returns 429.

Do not add a pretend localStorage-only budget guard: it cannot coordinate concurrent requests or users and is not a server-side spending limit. Do not create a Durable Object binding/migration or deploy it without an explicit deployment/configuration review.

## Required Cloudflare configuration (not applied)

1. Create and review a durable server-side budget-guard service with atomic reservation, per-project daily quotas, audit-safe counts, fail-closed behavior, and tests.
2. Add its Cloudflare service binding named `AI_BUDGET_GUARD` only after the implementation exists and the binding target is known.
3. Add `GEMINI_API_KEY_1` (optional additional same-project keys), `SAFE_AUTOMATON_GEMINI_TOKEN`, and leave `SAFE_AUTOMATON_GEMINI_ENABLED` absent/false until free-tier and zero-spend assumptions are independently verified.
4. Confirm in Google AI Studio that the exact project is Free Tier and that no paid key/feature or grounding tool is involved. Google states that quotas are project-scoped and billing/tiers affect available limits; check current official docs before any enablement.
5. Run CI and a no-provider-call test in preview. Only then consider a separate, explicit deployment approval.

## Tests

`tests/gemini-key-pool.test.mjs` uses mock fetch/guard responses only. It must not call the real Gemini API or require real credentials. The repository smoke workflow includes this test file.

## Official references

- Gemini rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Gemini billing: https://ai.google.dev/gemini-api/docs/billing
- Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing
