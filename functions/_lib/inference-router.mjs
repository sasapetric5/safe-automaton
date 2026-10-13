import { selectFailoverRoute } from "./ai-failover.mjs";

const ALLOWED_PROVIDERS = new Set([
  "cloudflare-workers-ai",
  "google-gemini",
  "openrouter",
  "huggingface-inference"
]);

/**
 * Produces a routing candidate only. It never calls a provider and never
 * treats a model/key name as proof of free billing or available quota.
 * Quota snapshots must come from a trusted server-side guard, not the client.
 */
export function planInferenceRoute(routes, estimate, now = Date.now()) {
  if (!Array.isArray(routes)) {
    return { status: "STOPPED", route: null, code: "ROUTES_NOT_VERIFIED", executionEnabled: false, providerCalls: 0, skipped: [] };
  }
  const skipped = [];
  const eligible = [];
  for (const route of routes) {
    const id = typeof route?.id === "string" ? route.id : "unknown-route";
    if (!ALLOWED_PROVIDERS.has(route?.provider)) {
      skipped.push({ id, reason: "provider-not-allowlisted" });
      continue;
    }
    if (route?.credentialConfigured !== true) {
      skipped.push({ id, reason: "credential-not-configured" });
      continue;
    }
    eligible.push(route);
  }
  const selection = selectFailoverRoute(eligible, estimate, now);
  const allSkipped = [...skipped, ...selection.skipped];
  if (!selection.route) {
    return {
      status: "STOPPED", route: null, code: selection.code,
      executionEnabled: false, providerCalls: 0, skipped: allSkipped
    };
  }
  return {
    status: "ROUTE_CANDIDATE_NOT_RESERVED",
    route: selection.route,
    code: selection.code,
    requiredTokens: selection.requiredTokens,
    executionEnabled: false,
    providerCalls: 0,
    reservationRequired: true,
    skipped: allSkipped
  };
}

/**
 * Validate a guard-issued permit before any provider adapter is allowed to
 * use it. This is only a validator; it does not issue or reserve quota.
 */
export function validateInferencePermit(permit, route, now = Date.now()) {
  if (!permit || permit.allowed !== true) return { ok: false, code: "PERMIT_NOT_GRANTED" };
  if (permit.billingStatus !== "free_verified" || permit.paidBudgetEur !== 0) {
    return { ok: false, code: "FREE_BILLING_NOT_VERIFIED" };
  }
  if (typeof permit.reservationId !== "string" || !permit.reservationId.trim()) {
    return { ok: false, code: "RESERVATION_ID_MISSING" };
  }
  if (!route || permit.routeId !== route.id || permit.provider !== route.provider ||
      permit.model !== route.model || permit.quotaDomain !== route.quotaDomain) {
    return { ok: false, code: "PERMIT_ROUTE_MISMATCH" };
  }
  const expiresAt = typeof permit.expiresAt === "number" ? permit.expiresAt : Date.parse(permit.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return { ok: false, code: "PERMIT_EXPIRED" };
  return { ok: true, reservationId: permit.reservationId, expiresAt };
}
