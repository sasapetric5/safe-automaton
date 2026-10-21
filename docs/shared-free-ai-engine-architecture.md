# Shared Free AI Engine — architecture contract

Status: implementation roadmap for the existing Safe Automaton AI Pool. This document is a contract, not a claim that every planned capability is already implemented.

## Goal

Provide one reusable, provider-neutral inference engine for RankGeo, CEOAI, and future applications. Applications submit a typed task and receive a bounded draft plus safe diagnostics. Provider-specific behavior belongs behind adapters, not in application UI code.

## Non-negotiable policy

1. **€0 hard limit.** A provider is eligible only when its exact model/account route has been explicitly approved as free. If cost status is unknown, skip it.
2. **Fail closed.** Missing key, model, approval, endpoint, or quota evidence means the provider is unavailable—not an invitation to guess.
3. **No secret leakage.** Keys exist only in server-side secret bindings. Never return keys, authorization headers, raw upstream bodies, or full request URLs in diagnostics.
4. **No external side effects.** The engine generates analysis/drafts only. Sending, publishing, applying, purchasing, payments, and production changes require separate human approval outside inference.
5. **Bounded work.** Enforce request-size limits, output limits, provider timeouts, an overall deadline, and a maximum number of fallback attempts.
6. **Explicit model routing.** Never silently replace a requested model with an unknown or paid model. A fallback must satisfy the same free-only policy.
7. **Privacy by default.** Do not persist prompts or responses centrally by default. Store only minimal, redacted operational metadata if an approved store is added later.

## Provider adapter contract

Every adapter should expose the same conceptual operations:

- `id`: stable provider ID, independent of display name or API-key variable name.
- `validateConfig(env)`: returns redacted reason codes; never values of secrets.
- `listApprovedModels()`: only models that have been reviewed for the required free tier and task capabilities.
- `infer(request, deadline)`: performs one bounded request and normalizes text, finish status, token usage (when available), provider/model identity, and timing.
- `classifyError(error)`: maps failures to stable categories such as authentication, quota/rate limit, model unavailable, timeout, invalid request, provider outage, or unknown.
- `health`: configuration health is separate from live availability; do not send synthetic traffic to a provider unless explicitly enabled.

Existing adapters: Gemini OpenAI-compatible endpoint, Cloudflare Workers AI binding, Mistral, OpenRouter, Hugging Face, DeepSeek, and xAI. Optional future adapters: NVIDIA NIM and a separately hosted FreeLLMAPI-compatible router. A listed adapter is not automatically approved for production use.

## Routing algorithm

1. Validate caller authentication, task schema, payload size, and global AI enablement.
2. Resolve the requested task to a small, explicit capability policy (for example: short structured JSON, research synthesis, or QA review).
3. Build an ordered candidate list from the configured provider order, intersected with explicit free-only approvals and allowed model IDs.
4. Before each attempt, check remaining overall deadline and per-request limits.
5. Call one provider at a time; validate and normalize the response. On a retryable error, record a redacted attempt result and move to the next approved candidate.
6. Never retry an unapproved model or change an endpoint to a paid service. Treat HTTP 401/403 as configuration/permission errors; 429 as quota/rate-limit; timeout and 5xx as potentially retryable.
7. Validate output shape and maximum length. Empty, malformed, or unsafe output is a failed attempt, not a successful draft.
8. Return the result with provider/model and redacted attempt codes. If all candidates fail, return a stable error and diagnostics without secrets.

## Cost and quota controls

- Global kill switch: `SAFE_AUTOMATON_AI_ENABLED`.
- Pool kill switch: `SAFE_AUTOMATON_FREE_POOL_ENABLED`.
- Provider-specific exact opt-in: `YES_FREE_ONLY` approval value.
- Model allowlist and explicit model ID per provider.
- OpenRouter model IDs must end in `:free` when this is the approved free-route mechanism.
- NVIDIA NIM must remain disabled until the exact model, account terms, and billing controls confirm no possible charge for the intended usage.
- FreeLLMAPI must be hosted separately. Its router must be restricted to approved free models, and its own API key must be stored server-side. An HTTPS URL alone does not prove free routing.
- Do not interpret a provider's promotional credits or temporary trial as an ongoing free tier.
- If reliable quota information is unavailable, rely on the provider's documented hard free limit and stop on quota/rate-limit responses; never automatically upgrade.

## Diagnostics and observability

Allowed fields: stable provider ID, configured/disabled state, redacted reason code, selected model ID, attempt status, elapsed time, and request correlation ID. Never include API keys, authorization headers, full prompts, full upstream response bodies, or sensitive user content in operational logs.

Diagnostics should distinguish:
- `not_configured`
- `approval_missing`
- `model_missing_or_not_allowed`
- `endpoint_invalid`
- `authentication_or_permission`
- `quota_or_rate_limit`
- `timeout`
- `provider_unavailable`
- `invalid_or_empty_output`
- `success`

Configuration diagnostics are not proof of live service health. Live probes must be opt-in, bounded, and cost-safe.

## Test gates

Before merging a provider change, CI should cover:

- unapproved provider is never called;
- missing key/model/approval fails closed;
- paid/unknown model routes are rejected;
- malformed or unsafe endpoints are rejected;
- secret strings never appear in returned diagnostics;
- HTTP 401/403, 429, 5xx, timeout, malformed JSON, and empty output are classified correctly;
- retry moves only to the next approved provider and respects the overall deadline;
- output size and request-body limits are enforced;
- all existing repository tests remain green.

Mocked tests prove control-flow behavior only. Live-provider tests are separate, opt-in, and must never run automatically against an account that could incur charges.

## Phased delivery

### Phase 1 — current PR
Add opt-in NVIDIA NIM and configurable FreeLLMAPI-compatible provider adapters, endpoint validation, documentation, and mocked regression tests. No production deployment.

### Phase 2 — harden the common pool
Audit all current providers against actual Cloudflare environment variable names, unify diagnostics, confirm timeout/deadline behavior, and add tests for quota/error fallback and output validation. Do not re-test the separate CEOAI implementation repeatedly; adapt its established orchestration patterns and test only integration boundaries.

### Phase 3 — shared engine extraction
Extract provider registry, policy checks, routing, error classification, and response normalization into a reusable module with a stable interface. Keep Cloudflare-specific bindings in a thin adapter. Confirm the deployment runtime supports the chosen module format before extraction.

### Phase 4 — task/model capability registry
Add reviewed model metadata (free-tier evidence, context/output limits, structured-output support, tool support, languages, and last verification date). Unknown or stale metadata means the model is disabled by default.

### Phase 5 — app integration
Expose a narrow internal API to RankGeo and CEOAI. Each app retains its own authorization, task rules, data minimization, and human-approval gates. One app's credentials must not grant access to another app's data or actions.

### Phase 6 — maintenance
Schedule a lightweight review of official provider pricing/terms and model availability. A detected change marks the affected route as needs-review and disables it when zero-cost eligibility is uncertain. Do not self-modify production policy without review and approval.

## Definition of done

The engine is not considered production-ready merely because a request succeeds. Required evidence includes green automated tests, reviewed free-tier/model eligibility, secret-redaction tests, bounded fallback behavior, an explicit kill switch, documented deployment/configuration, and a separate human-approved deployment.