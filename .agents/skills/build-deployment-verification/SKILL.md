---
name: build-deployment-verification
description: Verify that a change builds and that the tested commit matches the intended preview or production deployment. Use after UI fixes, route/API changes, or when a deployment appears not to reflect repository code.
---

# Build and Deployment Verification — Safe Automaton

Use this skill after a code change or when a live page behaves differently from the inspected source.

## Safety rules
- Read-only inspection by default. Never alter Cloudflare settings, deployment configuration, DNS, secrets, production branch settings, or deployment state without explicit approval.
- Do not merge or write to `main`, create a production release, or intentionally trigger a deployment without explicit approval. If a feature-branch push may create a preview deployment, disclose that possibility before writing.
- Never expose secret values. Redact credentials, tokens, cookies, and sensitive request headers.
- Do not use paid services or paid APIs. Do not make real external submissions or financial actions.
- A repository commit, a successful build, a successful HTTP response, and a verified browser interaction are different kinds of evidence; do not conflate them.

## Verification sequence
1. **Establish identity.** Record repository, branch, commit SHA, target environment, URL, and the deployment's reported source commit where available.
2. **Inspect change scope.** Review the diff and affected routes/assets/functions. Confirm unrelated files and production configuration were not changed.
3. **Run local checks where available.** Use existing project scripts and installed dependencies. Run relevant tests, lint/type checks, and build. Do not install new dependencies or invoke paid services without approval. Record exact commands and exit status.
4. **Inspect build output.** Confirm the expected output directory/files exist; look for syntax, missing-import, bundling, and route-generation errors. A successful command alone does not prove the intended feature works.
5. **Verify preview identity.** Use the hosting provider's reported deployment metadata or GitHub checks to connect the preview URL to the exact commit. Do not assume the newest deployment belongs to the current branch or that a URL reflects the latest commit.
6. **Check HTTP behavior safely.** For approved, read-only URLs, record status, redirect chain, content type, and relevant response evidence. Avoid dumping secret-bearing headers or full sensitive payloads.
7. **Check client/server parity.** For a UI control calling an endpoint, verify the deployed frontend and endpoint are from compatible commits/contracts. Check route path, method, response schema, and feature-flag behavior without exposing secrets.
8. **Exercise the actual interaction if possible.** Verify the deployed preview's control and its visible outcome in a browser/E2E test. An HTTP 200 or rendered page is not proof that a button works.
9. **Compare preview and production only when authorized.** Read-only comparison may note differences, but do not change production or promote a preview. Treat cache/stale assets as hypotheses until proven.
10. **Report evidence and gaps.** Separate PASS, FAIL, and NOT RUN. Provide commit SHA, URL/environment, command and test output summaries, and the evidence that connects each result to the target commit. State any uncertainty explicitly.

## Required report
- Source branch and commit SHA.
- Build/test commands run, with exact outcome.
- Preview URL and verified deployment commit (or **NOT VERIFIED**).
- HTTP/route checks and actual browser interaction result (or **NOT RUN**).
- Whether the deployed UI and endpoint are confirmed to match.
- Known gaps, risks, and safe next step.

## Evidence rules
- Never say "deployed successfully" based only on a GitHub commit.
- Never say "the button is fixed" based only on a build or HTTP 200.
- Never select a deployment by recency alone; compare its commit SHA.
- If a check cannot be executed in the current environment, report it as **NOT RUN**, not PASS.
