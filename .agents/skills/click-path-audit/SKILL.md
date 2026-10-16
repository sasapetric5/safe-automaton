---
name: click-path-audit
description: Trace UI buttons and controls end-to-end from user interaction through handler, async work, state updates, and visible outcome. Use when a button appears inert, produces no visible result, hangs, or reports success without evidence.
---

# Click-Path Audit — Safe Automaton

Use this skill whenever a button, form, toggle, or other interactive control is reported as broken or unreliable. Audit before changing code.

## Safety rules
- Work only on the explicitly authorized feature branch. Never merge, push to `main`, change Cloudflare configuration, or intentionally trigger production deployment without explicit approval.
- Do not expose secrets or print environment-variable values. Redact tokens, cookies, authorization headers, and personal data from logs.
- Do not invoke real external submissions, send messages, make purchases, trigger payments, or call paid APIs. Mock or stub side effects in tests.
- Do not claim the control works unless the relevant test was actually run and evidence is available.

## Required trace: click to visible outcome
1. **Identify the exact control.** Find its rendered component, accessible name, selector/test ID, disabled/loading conditions, and the user-visible expected result.
2. **Trace the event.** Follow the click/touch/submit handler. Confirm the handler is attached to the control that is actually rendered and is not shadowed by an overlay, propagation issue, stale closure, or early return.
3. **Trace every branch.** Follow validation, feature flags, permissions, configuration checks, request construction, asynchronous calls, response parsing, error handling, and cleanup. Record every condition that can exit early.
4. **Trace state and rendering.** Verify the result/error/loading state is updated, the relevant component observes it, and the UI renders the resulting state. Check that state is not immediately reset, hidden behind a condition, or stored in a disconnected component.
5. **Trace the response contract.** Check HTTP status, content type, JSON/body shape, and server/client field names. Ensure the client does not silently discard a valid response or assume JSON when the server returns another format.
6. **Trace failures.** Every expected failure should produce a safe, actionable visible message. Do not swallow errors or show a success state before the operation succeeds.
7. **Check lifecycle and races.** Look for unawaited promises, missing `return`, duplicate clicks, stale state, request cancellation, timeouts, component unmounts, and loading states that never clear. Use condition-based waits, not arbitrary sleeps.
8. **Add a regression test first when practical.** Reproduce the original symptom with a failing test, then implement the smallest fix. Include success, error, missing-config, and repeated-click cases where relevant.
9. **Verify the whole path.** Test the rendered control through its real handler and observable result. Prefer a browser/E2E test where the harness exists; otherwise use the narrowest available component/integration test and clearly state what it cannot prove.
10. **Inspect the diff.** Remove diagnostic secrets and unnecessary logging. Check accessibility (keyboard activation, labels, focus), loading/disabled behavior, and that unrelated controls were not changed.

## AI draft button checklist
For optional AI generation, verify separately:
- the click handler is invoked;
- the feature flag/configuration branch is normalized and interpreted correctly;
- the request reaches the intended same-origin endpoint;
- the endpoint method/path and request schema match the client;
- provider binding/model invocation is reached only when configured;
- server responses and errors are mapped to visible UI states;
- loading always clears in a `finally` path;
- no token or secret is returned to the browser or logged;
- provider errors, disabled AI, invalid input, and empty responses are shown as understandable outcomes;
- no offer is sent or external action taken automatically.

## Required report
Report:
- control and expected behavior;
- exact path from event handler to visible result;
- root cause supported by code or test evidence (or state that it remains unconfirmed);
- files changed;
- tests/commands actually run and their results;
- remaining untested paths and safe rollback approach.

Never infer root cause from a symptom alone. If browser execution is unavailable, label browser verification **NOT RUN** and provide the code-path evidence separately.
