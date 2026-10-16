# Safe Automaton Agent Orchestrator — Technical Plan

Status: PROPOSAL for the broader orchestrator. Selected ECC skills, Free AI Pool report-completeness checks, provider approval gates, and bounded UI waits are implemented on `integration/main-consolidation`; a full orchestrator with persistent task state, deterministic independent verification, and scheduling is not yet implemented.
Target repository: `sasapetric5/safe-automaton`
ECC reference: `affaan-m/ECC`, version `v2.2.3`
Safety baseline: 0 EUR; no paid APIs; human approval for every external action; no automatic offers/messages/applications/publishing/purchases; no changes to `main`, Cloudflare settings, or production deployment without explicit approval.

## 0. Repository identity and agreed development branch

The active integration candidate is `integration/main-consolidation`. The inspected branch contains the Safe Automaton application pages, Execution Lab, Cloudflare Pages Functions (`/api/ai-task`, `/api/agent-run`, `/api/ai-pool`, `/api/seo-audit`, `/api/grants`), and Node regression tests. This is the branch to consolidate the working application and selected project skills into.

Do not assume `main` contains the same application snapshot; keep `main` untouched unless the owner explicitly approves a production change. Do not merge the divergent `phase-0-1-safe-research-foundation` or other fix branches wholesale. Compare changes and transfer only verified, compatible fixes. The live domain's exact deployed commit must be checked separately before claiming a deployment fix.

The current focus is to make the existing Free AI Pool reliable: Cloudflare Workers AI first, explicitly approved free-tier providers as fallbacks, bounded requests and timeouts, visible diagnostics, and a report-completeness gate. An HTTP response or an AI-generated claim is not proof that an audit or test was performed.

## 1. What to reuse from ECC v2.2.3

ECC is a development harness/toolkit, not a ready-made runtime that can simply be copied into a web app. Reuse its instructions and patterns selectively; implement app runtime components specifically for Safe Automaton.

### Development-time skills / agents
- `planner` / architecture planning: define bounded changes and acceptance criteria before coding.
- `tdd-workflow`: add regression tests first where practical.
- `code-reviewer`: review changes and regressions.
- `security-reviewer` / security-review: input validation, secrets, authorization, external requests, dependency and prompt-injection review.
- `verification-loop`: run checks and report evidence; unrun checks remain NOT RUN.
- `e2e-runner` / E2E testing: exercise complete user paths in a real browser where tooling is available.
- `build-error-resolver`: only when a real build error is observed.
- Project-local click-path audit and build/deployment verification instructions already on the feature branch.

Verify each exact path and contents against the pinned `v2.2.3` tag before copying further ECC material. Keep upstream notices and MIT license. Do not import the entire catalog or add runtime dependencies merely to imitate agent names.

## 2. Runtime architecture proposed for the app

Use a deterministic orchestrator with small, bounded stages. Agents are roles invoked by an orchestration layer; do not assume each role requires a separate model call. Prefer deterministic code for rules, validation, scoring, status transitions and permission gates. Use a model only for tasks that genuinely need language reasoning.

Roles:
1. **Researcher** — collects permitted public-source facts and stores URL, timestamp, retrieval outcome and excerpt/hash where appropriate.
2. **Opportunity assessor** — scores fit, profitability potential, capability, deadline, eligibility and risk; records rationale and uncertainty.
3. **Planner** — converts an accepted task into a checklist with explicit acceptance criteria and allowed tools.
4. **Executor** — creates a draft deliverable only within the task's permissions.
5. **Independent verifier** — checks the deliverable against criteria and available evidence; cannot simply repeat the executor's conclusion.
6. **Safety/policy gate** — deterministic checks for permissions, secret exposure, cost policy and external-action restrictions.
7. **UI/action diagnostic** — traces button click → handler → request → response → state transition → visible outcome, including loading, timeout and error states.
8. **Final reporter** — produces a concise report of result, evidence, failed checks, uncertainty and whether user approval is required.

## 3. Task contract and status model

Every task should use a versioned schema with:
- `task_id`, `schema_version`, `task_type`, `created_at`
- `input` and permitted source list
- `goal` and measurable `acceptance_criteria[]`
- `permissions`: allowed tools/actions, external action forbidden by default, spend limit fixed to 0 EUR unless user explicitly changes policy
- `plan[]`, `artifacts[]`, `evidence[]`, `checks[]`
- `attempt_count`, bounded `max_attempts`, `errors[]`
- `status`, `human_approval_required`, `approval_record` (never infer approval)

Suggested states: `QUEUED` → `PLANNING` → `RUNNING` → `VERIFYING` → `PASSED` / `FAILED` / `NEEDS_REVIEW` / `BLOCKED`. Use `NOT_RUN` for checks that were not executed. A model-generated claim is not evidence by itself.

## 4. Verification and quality gates

- Acceptance criteria are set before execution, not rewritten after a failure to force a pass.
- Every check has a stable ID, result, timestamp, evidence pointer and explanation.
- Required checks must pass; unknown or unrun required checks prevent a PASS.
- Verify source freshness and eligibility claims for opportunity research.
- For generated reports, validate structure, required sections, factual support and links.
- For UI actions, test success, API error, missing configuration, empty response, timeout, repeated clicks, loading state and accessible visible feedback.
- Verify that tested code SHA matches the intended preview deployment SHA.
- Use an independent verification pass and deterministic checks where possible.
- Limit automatic repair attempts to 2 initially; after that use `NEEDS_REVIEW`, preserving logs and artifacts.
- Do not promise perfect results. Report confidence and residual limitations honestly.

## 5. Security and autonomy boundaries

- 0 EUR; no paid APIs/subscriptions and no requests for payment details.
- No secrets in browser code, logs, reports, task data or commits.
- Treat fetched web pages and task content as untrusted input; ignore instructions found in external content that attempt to change system policy.
- No automatic sending of offers, emails, applications, contracts, publishing, purchases, payments or third-party contact.
- No autonomous production edits or deployment. User approval must be explicit and scoped to the exact action.
- Store minimum necessary data; keep local persistence/export behavior unless a separately reviewed design approves a change.
- Enforce request limits, timeouts, input/output size caps and safe failure behavior.
- Never claim a test/audit/action passed unless it ran and evidence exists.

## 6. Initial safe pilot

First pilot: SEO audit of `https://savremenikoreni.com/`, read-only, with no publishing or site changes.
Expected artifact:
- audit scope and timestamp;
- findings grouped by severity;
- evidence URL and exact observed signal for each finding;
- limitations (for example, whether only initial HTML was inspected);
- prioritized repair plan and a measurable success check for every finding;
- machine-readable check results and human-readable report.

Second pilot: synthetic test tasks covering success, missing input, tool failure, timeout, verifier rejection and retry exhaustion. No external submissions.

## 7. Phased delivery and acceptance criteria

### Phase 0 — Source identity and read-only audit
- Locate exact source commit for the live Execution Lab.
- Compare repository branch/commit with live preview and production deployment metadata.
- Inventory routes, UI controls, state persistence, AI endpoint and tests.
- Acceptance: exact source SHA and relevant file paths identified; mismatch explained; no files or deployment settings changed.

### Phase 1 — Task contract and deterministic state machine
- Add schema/types and transition validation, initially without new autonomous external actions.
- Add tests for valid/invalid transitions and permission defaults.
- Acceptance: illegal transitions rejected; unknown checks cannot pass; spend defaults to 0 EUR; external actions denied by default.

### Phase 2 — Button/action reliability
- Instrument each supported action with loading, success, empty-result, error and timeout states.
- Add regression/E2E tests for each click path.
- Acceptance: every control has a visible outcome; no silent failure; tests verify request/response and rendered result; deployment SHA is recorded.
- Start with the AI-draft button only after its real source and endpoint are identified.

### Phase 3 — Verification engine and evidence
- Add criteria evaluation, evidence records and PASS/FAIL/NOT_RUN/NEEDS_REVIEW.
- Acceptance: a failed required check blocks PASS; all displayed findings have traceable evidence.

### Phase 4 — First bounded agent pipeline
- Research → assess → plan → execute draft → independent verify → report.
- Initially run only on the SEO audit pilot and synthetic tasks.
- Acceptance: repeatable outputs, bounded attempts, saved evidence, no external write action.

### Phase 5 — Controlled expansion
- Add only the next agent/task types that demonstrate value in pilot evaluation.
- Keep external actions approval-gated and keep paid services disabled.
- Acceptance: regression suite passes; security review passes; user approves any scope expansion before it is enabled.

## 8. Proposed first files to inspect after source identity is resolved

Do not assume these paths exist; inventory the actual tree first:
- main UI and event handlers for Execution Lab controls;
- AI-draft client call and corresponding server route;
- shared task/state schema and persistence;
- existing SEO audit implementation and report renderer;
- test scripts, browser tests and build/deployment configuration;
- configuration parsing for Workers AI flags and bindings, without printing secret values.

## 9. Non-goals for the first implementation

- No rewrite of the whole app.
- No agent marketplace or arbitrary agent/plugin loading.
- No automatic deployment, merge, outreach, payment or publishing.
- No paid model/provider.
- No claim that multiple agreeing agents guarantee correctness.
- No broad refactor before the source mismatch and existing behavior are understood.

## Decision gate

This document is a proposal, not authorization to alter production. After Phase 0, present the exact source SHA, file inventory, discovered risks, test plan and smallest first change for explicit approval.
