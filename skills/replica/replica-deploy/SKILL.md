---
name: replica-deploy
description: Review deployment evidence and rollback without unapproved production changes.
---
# Controlled deploy
1. Identify project, branch, commit, environment, build settings and target URL.
2. Review diff and tests before release.
3. Confirm secrets and bindings are not exposed; scope config changes explicitly.
4. Prefer preview deployments and verify health plus critical flows.
5. Never merge, publish, change production settings, trigger paid services or alter DNS without explicit approval.
6. Record deployment ID, commit, build result, smoke tests and rollback commit.
7. If evidence is unavailable, report NOT VERIFIED.