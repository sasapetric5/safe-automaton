# AI provider pool configuration

This document describes optional providers added to Safe Automaton's existing Free AI Pool. These are opt-in integrations; no credentials or endpoints are committed here.

## NVIDIA NIM

Configure these in the same Cloudflare Pages environment as the deployed function:

- `NVIDIA_NIM_API_KEY` — secret.
- `SAFE_AUTOMATON_NVIDIA_NIM_MODEL` — exact model ID enabled for the account.
- `SAFE_AUTOMATON_NVIDIA_NIM_FREE_ONLY=YES_FREE_ONLY` — explicit owner attestation that the selected model/account path is permitted and cannot incur charges.
- Add `nvidia_nim` to `SAFE_AUTOMATON_AI_ORDER` where it should be tried.

Endpoint: `https://integrate.api.nvidia.com/v1/chat/completions`.

**Important:** NVIDIA API catalog availability is not a guarantee of perpetual free use or production rights. Do not set the approval flag unless the selected model's current account terms and billing controls have been checked. If in doubt, leave it unset; the provider will be skipped.

## FreeLLMAPI

FreeLLMAPI is a separate service, not a Cloudflare Pages function. It must first be hosted somewhere that meets the project's €0 budget and must itself be configured to use only approved free-tier models/providers. Do not expose its dashboard or unified API key publicly.

Configure:

- `SAFE_AUTOMATON_FREELLMAPI_BASE_URL` — HTTPS base URL ending in `/v1`, without query string or credentials.
- `SAFE_AUTOMATON_FREELLMAPI_API_KEY` — secret unified API key.
- `SAFE_AUTOMATON_FREELLMAPI_MODEL` — typically `auto` only if the router is configured to select exclusively free endpoints.
- `SAFE_AUTOMATON_FREELLMAPI_FREE_ONLY=YES_FREE_ONLY` — explicit owner attestation that the remote router cannot route to a paid model.
- Add `freellmapi` to `SAFE_AUTOMATON_AI_ORDER` only after deployment and configuration are verified.

The function rejects non-HTTPS, localhost, and `.local` endpoints. The endpoint is never printed in provider diagnostics. This check is a safety guard, not a substitute for securely hosting and configuring the router.

## Safety model

- Existing provider keys remain in Cloudflare secrets; never paste them into GitHub source.
- A provider is skipped unless its key, model, and exact `YES_FREE_ONLY` approval flag are present.
- OpenRouter retains its existing `:free` model-name check.
- Provider failures/timeouts fall through to the next approved provider.
- Requests only create drafts; they do not send, publish, apply, purchase, or perform other external actions.
- This integration adds configuration and mocked regression tests; it does not prove live provider access, free quota availability, or production readiness.
