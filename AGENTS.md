# Safe Automaton — project instructions for Codex

## Safety and authorization
- Treat this repository as a safety-critical, human-in-the-loop prototype.
- Never push changes to `main`, merge a pull request, change Cloudflare settings, or trigger a production deployment without explicit user approval.
- Work on a feature branch. Before any write, inspect the current branch, relevant files, and git diff; preserve unrelated changes.
- No paid services, paid APIs, subscriptions, purchases, external messages, applications, or financial actions. Do not ask the user to enter payment details.
- Never expose, commit, print, or copy secrets, tokens, credentials, or environment-variable values. Use only approved test credentials and redact logs.
- No autonomous background actions, external submissions, publishing, or contacting third parties. Prepare drafts and ask for human approval.
- Do not claim a test, audit, deployment, or browser check passed unless it was actually run and its evidence is available.

## Required engineering workflow
1. Research first: read the relevant files and current project state; identify the smallest safe change.
2. Plan: state the intended behavior, affected files, risks, and verification steps before broad changes.
3. Test first when practical: add or update a regression test that demonstrates the bug before implementation.
4. Implement the smallest targeted change; avoid unrelated refactors and dependency additions.
5. Verify: run available tests, build/type/lint checks where applicable, inspect the diff, and report commands and actual results. If a check cannot run in the current environment, mark it NOT RUN rather than PASS.
6. Security review: inspect user input, authentication/authorization, secret handling, external requests, dependencies, and any new endpoint.
7. UI regression: for broken controls, trace the complete click/touch path from event handler through state changes to rendered output.
8. Before proposing a merge, summarize changed files, evidence, known limitations, and rollback steps.

## Project-specific constraints
- Preserve the user's 0 EUR spending policy and human approval before every external action.
- Do not invent that an AI provider, API key, notification channel, or payment integration is configured.
- Keep local data and JSON export behavior safe; do not delete user data or alter storage formats without a migration plan.
- Prefer free/open-source tooling and existing dependencies. Ask before introducing dependencies or network services.
- Keep changes isolated on a feature branch until the user explicitly approves a merge.
