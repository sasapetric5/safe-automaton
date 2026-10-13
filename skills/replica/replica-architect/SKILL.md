---
name: replica-architect
description: Turn a goal into a maintainable, bounded architecture and staged implementation plan.
---
# Architecture

1. Translate the goal into user stories and measurable acceptance criteria.
2. Map components, data flow, trust boundaries, persistence, external dependencies, and failure modes.
3. Prefer the smallest architecture that reuses working components; avoid duplicate systems.
4. Define interfaces, schemas, state transitions, retry limits, timeouts, and observability.
5. Explicitly document what is not in scope and which decisions require human approval.
6. Output: component map, implementation sequence, test plan, rollback plan, and cost/risk estimate.
7. Do not label a design as implemented until code and runtime evidence confirm it.
