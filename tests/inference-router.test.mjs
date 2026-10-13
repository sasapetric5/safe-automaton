import test from "node:test";
import assert from "node:assert/strict";
import { planInferenceRoute, validateInferencePermit } from "../functions/_lib/inference-router.mjs";

const now = 1_800_000_000_000;
function route(overrides = {}) {
  return {
    id: "cf-free-1",
    provider: "cloudflare-workers-ai",
    model: "@cf/zai-org/glm-4.7-flash",
    quotaDomain: "cloudflare-account-1",
    enabled: true,
    credentialConfigured: true,
    billingStatus: "free_verified",
    paidBudgetEur: 0,
    quotaVerified: true,
    quotaCheckedAt: now,
    remainingRequests: 20,
    remainingTokens: 20_000,
    ...overrides
  };
}

test("router plans only a verified free route and never invokes a provider", () => {
  const result = planInferenceRoute([
    route({ id: "unknown", provider: "random-provider" }),
    route({ id: "no-credential", credentialConfigured: false }),
    route({ id: "selected", quotaDomain: "account-independent" })
  ], { inputTokens: 300, maxOutputTokens: 1000, safetyTokens: 200 }, now);
  assert.equal(result.status, "ROUTE_CANDIDATE_NOT_RESERVED");
  assert.equal(result.route.id, "selected");
  assert.equal(result.executionEnabled, false);
  assert.equal(result.providerCalls, 0);
  assert.equal(result.reservationRequired, true);
  assert.deepEqual(result.skipped.slice(0, 2).map(item => item.reason), ["provider-not-allowlisted", "credential-not-configured"]);
});

test("router stops when free billing or quota is uncertain", () => {
  const result = planInferenceRoute([
    route({ id: "unknown-billing", billingStatus: "unknown" }),
    route({ id: "stale", quotaCheckedAt: now - 120_000, quotaDomain: "other-account" })
  ], { inputTokens: 100, maxOutputTokens: 1000 }, now);
  assert.equal(result.status, "STOPPED");
  assert.equal(result.route, null);
  assert.equal(result.executionEnabled, false);
  assert.equal(result.providerCalls, 0);
});

test("permit requires a matching route, zero paid budget and future expiry", () => {
  const selected = route();
  const permit = {
    allowed: true, billingStatus: "free_verified", paidBudgetEur: 0,
    reservationId: "reservation-123", routeId: selected.id,
    provider: selected.provider, model: selected.model,
    quotaDomain: selected.quotaDomain, expiresAt: now + 30_000
  };
  assert.equal(validateInferencePermit(permit, selected, now).ok, true);
  assert.equal(validateInferencePermit({ ...permit, paidBudgetEur: 0.01 }, selected, now).code, "FREE_BILLING_NOT_VERIFIED");
  assert.equal(validateInferencePermit({ ...permit, model: "different-model" }, selected, now).code, "PERMIT_ROUTE_MISMATCH");
  assert.equal(validateInferencePermit({ ...permit, expiresAt: now - 1 }, selected, now).code, "PERMIT_EXPIRED");
  assert.equal(validateInferencePermit({ ...permit, allowed: false }, selected, now).code, "PERMIT_NOT_GRANTED");
});

test("client-supplied absence of routes fails closed", () => {
  const result = planInferenceRoute(null, { inputTokens: 1, maxOutputTokens: 1 }, now);
  assert.equal(result.code, "ROUTES_NOT_VERIFIED");
  assert.equal(result.providerCalls, 0);
});
