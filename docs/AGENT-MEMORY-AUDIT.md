# Agent Memory and Audit Log — Phase 1

## Safety model
- Memory is written only after an explicit authenticated `save` request; there is no automatic prompt harvesting.
- `list` returns saved memory; `audit` returns operation metadata and a SHA-256 hash of the saved value, not the value itself.
- Obvious credential-like content is rejected. Do not store secrets, API keys, passwords, payment data, or sensitive personal data.
- The endpoint never invokes an AI model, external network, publishing, messaging, shell, or paid service.
- The endpoint fails closed unless `SAFE_AUTOMATON_AI_TOKEN` and Cloudflare KV binding `AGENT_MEMORY_KV` are configured.
- The memory API has no delete action in this first phase. Overwriting a key creates a new version and audit entry.

## Deployment prerequisite
Create a Cloudflare Workers KV namespace and bind it to the Pages Functions runtime as `AGENT_MEMORY_KV`. This is a manual Cloudflare configuration step and has deliberately not been performed by code. Until the binding exists, the API returns `503 MEMORY_STORE_NOT_CONFIGURED` and stores nothing.

## API
Authenticated POST to `/api/agent-memory` with header `X-Safe-Automaton-AI-Token`:
- `{"action":"save","key":"project.goal","value":"Draft-only workflow","category":"project"}`
- `{"action":"list"}`
- `{"action":"audit"}`

Keys are lowercase slugs of up to 80 characters. Values are limited to 3,000 characters. Results are limited to 50 entries per page. Pass a returned cursor to request the next page.

## Important audit limitation
This is an application-level audit log, not a tamper-proof ledger. Cloudflare KV is eventually consistent and does not provide transactional append-only guarantees. The random event key and content hash help identify records and compare values, but do not prove that no record was changed or omitted. A future stronger audit guarantee requires a serialized Durable Object or external append-only storage, with its own reviewed cost and retention limits.
