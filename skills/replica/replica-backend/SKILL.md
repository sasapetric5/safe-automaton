---
name: replica-backend
description: Review APIs, validation, security boundaries, quotas and failure handling.
---
# Backend
1. Validate method, content type, body size, schema, lengths and allowed task types.
2. Authenticate privileged actions server-side; never trust client-only flags or browser secrets.
3. Apply origin/CSRF controls as appropriate, timeouts, response limits and rate limits.
4. Restrict outbound requests to allowlists; defend against SSRF and unsafe redirects.
5. Store secrets in platform secret storage; redact them from logs and errors.
6. A UI budget is not a billing cap; assess provider quotas and account plan.
7. Test unauthorized, invalid-input, timeout, provider-failure and quota cases.