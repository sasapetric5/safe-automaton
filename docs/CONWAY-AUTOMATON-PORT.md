# Safe port map: Conway Research Automaton

Source project: https://github.com/Conway-Research/automaton
Source license: MIT (see the upstream LICENSE file).
Reference architecture: https://github.com/Conway-Research/automaton/blob/main/ARCHITECTURE.md

## Porting rule

Transfer useful engineering patterns, not Conway-specific financial sovereignty or unrestricted autonomy. Safe Automaton is a zero-spend, review-first product. The upstream runtime includes wallet/USDC flows, paid inference, shell access, self-modification, replication, and external actions; those capabilities are intentionally excluded.

## Implemented in Safe Automaton

- Bounded request-scoped multi-agent pipeline: planner -> specialist -> reviewer, in `functions/api/agent-run.js`.
- Fail-closed runtime gate for AI enablement, access token, body size, origin, and Workers AI binding.
- Task-specific skill profiles for SEO audit, customer research, QA, and copywriting/scope in `functions/_lib/agent-skill-registry.mjs`.
- Explicit capability policy in `functions/_lib/agent-policy.mjs`: unknown capabilities denied; shell, financial operations, external sending/publishing, git writes, self-modification, and replication hard-denied.
- AI outputs remain unverified drafts; no tools or external actions are executed by the agent pipeline.
- Repository smoke tests cover policy and skill routing.

## Not yet ported / requires separate infrastructure

- Durable multi-turn state and tiered memory: no persistent state binding is configured in this repository.
- Heartbeat/background scheduler: Pages Functions are request-driven; no scheduled runtime is configured here.
- Real tool execution and sandbox: deliberately disabled. A future tool must have a narrow schema, policy check, resource/time limits, audit event, and tests before it can be enabled.
- Provider discovery, quota registry, and atomic budget reservations: failover planner exists, but a durable budget guard and provider integrations are not implemented.
- Upstream update automation: never auto-pull upstream code into the deployed branch; review diffs and license/dependency changes first.

## Safety invariants

1. Authorized paid spend remains EUR 0.
2. No wallet, USDC, payments, paid API fallback, or financial transactions.
3. No shell, arbitrary code execution, self-modification, cloning, or replication.
4. No automatic messages, submissions, publishing, domain registration, or DNS changes.
5. Unknown tool names, unknown billing state, missing evidence, and missing required bindings fail closed.
6. Human approval records intent only; this runtime does not execute the external action after approval.
7. Tests and reports must distinguish a generated proposal from a verified or executed result.

## License and attribution

The upstream Conway Automaton repository declares the MIT License. This phase ports architectural concepts and does not copy upstream runtime source files. If source code is copied in a later phase, retain the upstream copyright and MIT license notice in all copies or substantial portions, and review dependencies separately.
