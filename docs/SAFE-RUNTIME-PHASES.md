# Safe Automaton runtime phases 1–5

## Phase 1 — Memory and audit
- Explicit authenticated saves only; no automatic prompt harvesting.
- KV binding required: `AGENT_MEMORY_KV`.
- Audit metadata stores a SHA-256 content hash, not raw memory values.
- Not tamper-proof: KV is eventually consistent and lacks transactional append-only guarantees.

## Phase 2 — Inference router
- Selects only allowlisted providers with configured credentials and fresh, verified free-quota snapshots.
- Requires zero paid budget, sufficient token/request headroom, and an independent quota domain for failover.
- The router only produces a candidate. A trusted atomic guard reservation is required before any provider adapter may run.
- No paid fallback, no inference call from the routing planner.

## Phase 3 — Observability
- Emits request ID, task type, outcome code, duration, agent count, and phase-call count.
- Does not emit prompts, model output, tokens, credentials, raw exception text, or external personal identifiers.
- Telemetry is structured runtime logging, not a persistent metrics dashboard.

## Phase 4 — Heartbeat / scheduler
- Stores explicitly scheduled draft tasks and can list or preview due tasks.
- KV binding required: `AGENT_SCHEDULER_KV`.
- No cron/heartbeat trigger and no autonomous task execution in this phase. Due tasks are previews only.

## Phase 5 — Sandbox
- Offers allowlisted static checks for JSON, Markdown active-content warnings, and task contracts.
- No `eval`, shell, arbitrary code execution, filesystem, network, messaging, or publishing.
- Markdown checks are not a sanitizer. This phase is a safe validation boundary, not a general-purpose code execution sandbox.

## Deployment caveat
Code and CI tests do not create Cloudflare KV namespaces or bindings. Bindings must be configured separately in Cloudflare Pages settings before memory or scheduling endpoints become active. Until then those endpoints fail closed with HTTP 503. No Cloudflare settings were changed by this code change.
