# Development Verification Protocol

## Goal

Minimize user-side checking and shorten delivery time by having the developer/agent perform every safe, available verification step before asking the user to intervene.

## Required workflow after each code change

1. Inspect the diff and confirm only intended files changed.
2. Run the broadest relevant test suite available in one pass (unit, regression, API/endpoint, integration, and security/safety checks where present).
3. Run syntax, formatting, type-check, and build checks when the repository provides them.
4. Review the results and fix failures on the development/feature branch when access and evidence are sufficient; rerun affected tests and the broader suite.
5. Report the exact commit, branch, tests run, pass/fail results, and remaining limitations.

## Required workflow after a deployment

Only after a deployment is authorized and actually occurs, independently verify as access allows:

- deployment/build status and deployed commit;
- target URL and HTTP status;
- key pages and API routes, including expected error behavior;
- browser/runtime logs and smoke checks where tooling is available;
- regression-sensitive functionality and security boundaries.

A successful build or mocked test is not proof that a live deployment or third-party integration works. Clearly distinguish mocked tests, local tests, CI results, and live Preview checks.

## Batch testing and efficient diagnosis

- Group compatible checks into a single test run rather than asking the user to execute them individually.
- Prefer automated smoke, regression, endpoint, and health checks when safe and available.
- For AI providers, test routing/fallback and failure handling with mocks first. Use live calls only when necessary, explicitly permitted, and safe within verified free-tier constraints.
- Never print, expose, commit, or request secrets in chat or logs. Never deliberately trigger paid usage to test a provider.
- If a check cannot be performed because credentials, browser access, deployment permissions, or external access are unavailable, state the exact limitation and ask the user only for the smallest necessary action.

## Safety and release boundaries

- Default all implementation and repair work to the designated development/feature branch.
- Do not merge, deploy to production, modify production configuration, send external messages, purchase services, or take other consequential external actions without explicit user approval.
- A passing test suite does not itself authorize a merge or deployment.
- Keep free-only and human-approval safeguards enabled; if allowed providers are exhausted or their billing status is uncertain, stop rather than fall back to a potentially paid route.

## Completion report

Every change should conclude with a concise report containing:

- branch and commit;
- files changed;
- tests/checks run and their actual results;
- whether live Preview/deployment behavior was verified;
- unresolved issues, untested areas, and any user action that is genuinely required.
