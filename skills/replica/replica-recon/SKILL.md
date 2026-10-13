---
name: replica-recon
description: Inspect an existing application, repository, public documentation, and observable behavior before proposing changes.
---
# Reconnaissance

1. Identify the exact repository, branch, commit, target environment, task, and allowed scope.
2. Inspect existing docs, routes, UI, functions, tests, configuration, and relevant history before proposing implementation.
3. Build an inventory of present, partial, missing, and unverified capabilities.
4. Reproduce the reported issue where possible; capture exact steps, inputs, outputs, timestamps, and evidence.
5. Prefer read-only inspection. Do not reveal secrets or infer that unseen code is absent.
6. Output: evidence table, unknowns, risks, dependencies, and a minimal next step.
7. Stop if repository/branch identity is ambiguous or inspection would affect production.
