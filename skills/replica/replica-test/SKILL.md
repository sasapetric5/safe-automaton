---
name: replica-test
description: Create repeatable tests for behavior, APIs, security and regressions.
---
# Test
1. Derive tests from acceptance criteria before code changes.
2. Cover success, empty state, invalid input, network failure, timeout, repeated clicks, refresh and recovery.
3. Test mobile behavior as well as source syntax.
4. Mock provider bindings; do not consume live quota in automated tests.
5. Report tests written, executed and passed separately with environment and results.
6. Missing evidence is NOT TESTED, never PASS.
7. Block readiness on critical failures.