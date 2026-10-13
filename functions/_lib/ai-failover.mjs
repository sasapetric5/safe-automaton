/**
 * Safe Automaton failover planner.
 *
 * This module never contacts providers and never reads raw API keys. The caller
 * supplies verified quota snapshots from a durable guard. Routes are tried in
 * declared order; every candidate must have enough headroom for input, the
 * maximum output, and a safety margin before it is eligible.
 */
const DEFAULT_MAX_SNAPSHOT_AGE_MS = 60_000;

export function selectFailoverRoute(routes, estimate = {}, now = Date.now()) {
  const inputTokens = Number.isSafeInteger(estimate.inputTokens) && estimate.inputTokens >= 0
    ? estimate.inputTokens : null;
  const maxOutputTokens = Number.isSafeInteger(estimate.maxOutputTokens) && estimate.maxOutputTokens > 0
    ? estimate.maxOutputTokens : null;
  const safetyTokens = Number.isSafeInteger(estimate.safetyTokens) && estimate.safetyTokens >= 0
    ? estimate.safetyTokens : 0;
  const maxSnapshotAgeMs = Number.isSafeInteger(estimate.maxSnapshotAgeMs) && estimate.maxSnapshotAgeMs > 0
    ? estimate.maxSnapshotAgeMs : DEFAULT_MAX_SNAPSHOT_AGE_MS;

  if (!Array.isArray(routes) || inputTokens === null || maxOutputTokens === null) {
    return { route: null, code: "INVALID_FAILOVER_ESTIMATE", skipped: [] };
  }

  const skipped = [];
  const blockedQuotaDomains = new Set();
  for (const route of routes) {
    const id = typeof route?.id === "string" ? route.id : "unknown-route";
    const domain = typeof route?.quotaDomain === "string" ? route.quotaDomain : "";
    const skip = (reason, blockDomain = false) => { skipped.push({ id, reason }); if (blockDomain && domain) blockedQuotaDomains.add(domain); };

    if (route?.enabled !== true) { skip("disabled"); continue; }
    if (!domain) { skip("quota-domain-missing"); continue; }
    if (blockedQuotaDomains.has(domain)) { skipped.push({ id, reason: "quota-domain-already-rejected" }); continue; }
    if (route?.billingStatus !== "free_verified" || route?.paidBudgetEur !== 0) { skip("free-billing-not-verified", true); continue; }
    if (route?.quotaVerified !== true) { skip("quota-not-verified", true); continue; }

    const checkedAt = typeof route.quotaCheckedAt === "number" ? route.quotaCheckedAt : Date.parse(route.quotaCheckedAt);
    if (!Number.isFinite(checkedAt) || checkedAt > now || now - checkedAt > maxSnapshotAgeMs) {
      skip("quota-snapshot-stale", true); continue;
    }
    if (!Number.isSafeInteger(route.remainingRequests) || route.remainingRequests < 1) {
      skip("request-quota-insufficient", true); continue;
    }
    const requiredTokens = inputTokens + maxOutputTokens + safetyTokens;
    if (!Number.isSafeInteger(route.remainingTokens) || route.remainingTokens < requiredTokens) {
      skip("token-headroom-insufficient", true); continue;
    }
    if (typeof route.provider !== "string" || !route.provider || typeof route.model !== "string" || !route.model) {
      skip("provider-or-model-missing"); continue;
    }
    return {
      route: { id, provider: route.provider, model: route.model, quotaDomain: domain },
      code: "ROUTE_RESERVED_FOR_GUARD_RESERVATION",
      requiredTokens,
      skipped
    };
  }

  return { route: null, code: "NO_VERIFIED_FREE_ROUTE", skipped };
}

/**
 * Decide whether an already failed request may proceed to a candidate in the
 * ordered list. A quota failure never rotates to another key sharing the same
 * quota domain. Billing-related responses always stop the entire chain.
 */
export function mayFailoverAfterResponse({ status, currentRoute, nextRoute }) {
  if (!nextRoute || nextRoute.enabled !== true ||
      nextRoute.billingStatus !== "free_verified" || nextRoute.paidBudgetEur !== 0 ||
      nextRoute.quotaVerified !== true) return false;
  if (status === 402) return false;
  if (status === 401) return true; // invalid credential; candidate still needs guard reservation
  if (status === 429) {
    return typeof currentRoute?.quotaDomain === "string" &&
      typeof nextRoute?.quotaDomain === "string" &&
      currentRoute.quotaDomain !== nextRoute.quotaDomain;
  }
  // Network/5xx failover is permitted only across an independent provider
  // quota domain; do not hammer the same provider/quota pool.
  if (status === 0 || status >= 500) {
    return typeof currentRoute?.quotaDomain === "string" &&
      typeof nextRoute?.quotaDomain === "string" &&
      currentRoute.quotaDomain !== nextRoute.quotaDomain;
  }
  return false;
}
