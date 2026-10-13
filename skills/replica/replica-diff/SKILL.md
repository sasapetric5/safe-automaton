---
name: replica-diff
description: Compare implementation against requirements and a known-good baseline.
---
# Diff and regression review
1. Compare requested and observed behavior criterion by criterion.
2. Inspect the actual diff against the correct base; identify unrelated changes or removed safeguards.
3. Check neighboring features, persistence, API contracts and mobile layout.
4. Mark each requirement PASS, FAIL, WARN or NOT TESTED with evidence.
5. Do not treat implementer self-assessment as independent verification.
6. Recommend the smallest fix and rerun affected tests.
7. Deliver go/no-go, unresolved issues and rollback target.