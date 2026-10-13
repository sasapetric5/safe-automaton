# Replica skill coordinator (development only)

Endpoint: `POST /api/agent-orchestrator`

This is the first executable coordinator layer for the 11 Replica-inspired role profiles. It performs two bounded Workers AI passes:
1. The selected specialist creates a draft/proposal.
2. A separate reviewer prompt checks the proposal against the original request and reports PASS, WARN, FAIL or NOT TESTED.

## Request

Required header: `X-Safe-Automaton-AI-Token` (same server-side secret gate as the existing optional AI endpoint).
Required JSON: `skill`, `title`, `brief`. Optional: `mode` (`code-repair`), `source`, `evidence`.

Allowed `skill` values: `replica-recon`, `replica-architect`, `replica-design`, `replica-build`, `replica-backend`, `replica-test`, `replica-diff`, `replica-entrepreneur`, `replica-brand`, `replica-launch`, `replica-deploy`.

## Code repair behavior

For `mode: "code-repair"`, the build specialist proposes a minimal patch or replacement text and the second pass independently reviews it. It does **not** read the GitHub repository itself, apply changes, run code, run tests, open a PR, merge, or deploy. The operator must supply the relevant code and context, then manually review and apply any accepted change in the development branch.

## Safety and cost

- Disabled unless `SAFE_AUTOMATON_AI_ENABLED=true`, the `AI` binding and a 32+ character `SAFE_AUTOMATON_AI_TOKEN` are present.
- Requires two inference calls per successful request. It does not automatically retry or call a paid fallback.
- Workers AI quotas and account billing depend on Cloudflare's current plan; a UI label cannot guarantee zero billing. Do not enable unless the account's free quota and billing risk have been checked.
- Request body is capped at 16 KB; individual fields are bounded; skill names are allowlisted.
- No automatic external actions, code execution, repo writes, deployments or client communication. Results are unverified drafts.
- Automated tests use a mock binding and do not consume inference quota.

## Current status

The endpoint and mocked tests are committed to the feature branch only. A passing CI run is required before considering a preview integration. Production remains unchanged.
