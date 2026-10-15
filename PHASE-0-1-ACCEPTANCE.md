# Safe Automaton — Phase 0 and Phase 1 Acceptance Criteria

Status: implementation branch; not approved for production deployment.

## Non-negotiable operating limits

- Approved spending limit is EUR 0 until the project records its first revenue and the owner explicitly changes the policy.
- A dashboard budget number is informational only; it must never be treated as payment authorization.
- No paid API, subscription, advertising, paid cloud feature, wallet, transfer, or automatic purchase.
- No AI-driven code changes, shell execution, cloning, or production publishing.
- Research may produce findings and drafts. External submissions require explicit, separate human approval.
- Secrets must never be stored in browser code, repository files, or local exports.

## Phase 0 — Safety and project baseline

- Preserve the current `main` branch and production deployment.
- Work only on `phase-0-1-safe-research-foundation`.
- Document the existing static prototype and known limitations.
- Make the interface clearly distinguish planning budget from authorized spending.
- Block recording a positive expense as an approved spend while the spending authorization is EUR 0; allow recording a proposed cost without executing or paying it.
- Confirm that export does not contain secrets.
- Warn before deleting local data and keep export available as a backup option.
- Do not connect any AI provider or paid service.

## Phase 1 — Research log and human approval workflow

- Add a manual research-opportunity record with title, source URL, date found, summary, relevance, conditions/deadline, uncertainties, and next step.
- Validate URLs and required fields; escape user-provided text before rendering.
- Support duplicate review by source URL and title.
- Use explicit statuses: DISCOVERED, RESEARCHED, DRAFT_READY, AWAITING_APPROVAL, APPROVED, REJECTED.
- Store the approval decision, timestamp, and a short rationale.
- Approval records are for workflow tracking only; they do not send a submission or trigger any external action.
- Make it visually clear that no automated web research or AI connection exists yet.
- Keep data local to the current browser in this phase; explain that localStorage is not a multi-user database or secure backup.

## Acceptance tests before review

1. Existing page opens and remains usable on a narrow mobile viewport.
2. No positive expense can be treated as authorized while spending authorization is EUR 0.
3. A proposed expense can be recorded separately without payment or external action.
4. Research opportunity required fields are validated; malformed URLs are rejected.
5. User-provided titles and summaries render as text, not executable HTML.
6. Status changes follow the defined workflow and approval/rejection is recorded.
7. JSON export includes research and approval records, but no secrets.
8. Deleting local data requires confirmation.
9. No AI/API calls, payment calls, external submissions, or automatic deployment to production are introduced.
10. Production branch `main` is not modified by this work.

## Review and release gate

Provide a summary of files changed, test results, known limitations, and preview URL if one is generated. Do not merge or deploy to production unless the owner gives a separate, explicit approval after reviewing the result.
