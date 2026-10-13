import test from "node:test";
import assert from "node:assert/strict";
import { selectFailoverRoute, mayFailoverAfterResponse } from "../functions/_lib/ai-failover.mjs";

const now = 1_800_000_000_000;
function route(overrides = {}) {
  return {
    id: "qwen-free-1",
    provider: "example-provider",
    model: "qwen-example",
    quotaDomain: "account-project-1",
    enabled: true,
    billingStatus: "free_verified",
    paidBudgetEur: 0,
    quotaVerified: true,
    quotaCheckedAt: now,
    remainingRequests: 10,
    remainingTokens: 10_000,
    ...overrides
  };
}

test("selects the first enabled route with verified free quota and sufficient token headroom", () => {
  const result = selectFailoverRoute([
    route({ id: "paid", billingStatus: "paid", quotaDomain: "paid-account" }),
    route({ id: "low-headroom", remainingTokens: 500, quotaDomain: "low-quota-account" }),
    route({ id: "next-free", provider: "provider-b", model: "deepseek-example", quotaDomain: "account-b" })
  ], { inputTokens: 400, maxOutputTokens: 1000, safetyTokens: 200, maxSnapshotAgeMs: 60_000 }, now);
  assert.equal(result.route.id, "next-free");
  assert.equal(result.requiredTokens, 1600);
  assert.equal(result.skipped[0].reason, "free-billing-not-verified");
  assert.equal(result.skipped[1].reason, "token-headroom-insufficient");
});

test("fails closed for missing, stale or unknown quota data", () => {
  const result = selectFailoverRoute([
    route({ id: "stale", quotaCheckedAt: now - 61_000 }),
    route({ id: "unknown", quotaDomain: "account-2", quotaVerified: false })
  ], { inputTokens: 100, maxOutputTokens: 1000 }, now);
  assert.equal(result.route, null);
  assert.equal(result.code, "NO_VERIFIED_FREE_ROUTE");
});

test("does not treat another key in the same exhausted quota domain as extra quota", () => {
  const result = selectFailoverRoute([
    route({ id: "key-1", remainingTokens: 20 }),
    route({ id: "key-2", remainingTokens: 50 }),
    route({ id: "independent-provider", quotaDomain: "other-account", provider: "other", model: "other-model" })
  ], { inputTokens: 100, maxOutputTokens: 1000 }, now);
  assert.equal(result.route.id, "independent-provider");
  assert.ok(result.skipped.some((item) => item.reason === "quota-domain-already-rejected"));
});

test("429 never rotates to another key in the same quota domain", () => {
  assert.equal(mayFailoverAfterResponse({
    status: 429,
    currentRoute: route(),
    nextRoute: route({ id: "same-project-key-2" })
  }), false);
  assert.equal(mayFailoverAfterResponse({
    status: 429,
    currentRoute: route(),
    nextRoute: route({ id: "other-provider", quotaDomain: "independent-account" })
  }), true);
});

test("401 may move to a verified candidate; 402 always stops", () => {
  const candidate = route({ id: "candidate" });
  assert.equal(mayFailoverAfterResponse({ status: 401, currentRoute: route(), nextRoute: candidate }), true);
  assert.equal(mayFailoverAfterResponse({ status: 402, currentRoute: route(), nextRoute: candidate }), false);
  assert.equal(mayFailoverAfterResponse({
    status: 503, currentRoute: route(), nextRoute: route({ quotaDomain: "independent-account" })
  }), true);
});

test("no failover is allowed if next route has uncertain billing or quota", () => {
  assert.equal(mayFailoverAfterResponse({
    status: 503,
    currentRoute: route(),
    nextRoute: route({ billingStatus: "unknown" })
  }), false);
  assert.equal(mayFailoverAfterResponse({
    status: 503,
    currentRoute: route(),
    nextRoute: route({ quotaVerified: false, quotaDomain: "independent-account" })
  }), false);
});
