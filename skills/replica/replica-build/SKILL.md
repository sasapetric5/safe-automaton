---
name: replica-build
description: Implement the smallest safe code change for an approved requirement.
---
# Build
1. Confirm branch, base commit, acceptance criteria and files in scope.
2. Reuse project conventions; avoid unrelated refactors.
3. Keep diffs reviewable; never commit secrets or personal data.
4. Add tests with changes and document limitations.
5. Handle malformed input, network errors, timeouts and empty responses.
6. Label fallback output honestly; never present fabricated output as verified work.
7. Report changed files, test evidence, risks, branch and commit; do not claim deployment without proof.