const TASK_TYPES = new Set(["seo", "research", "qa", "scope"]);
const STATUSES = new Set(["completed", "failed", "stopped"]);

export function createRequestId() {
  return crypto.randomUUID();
}

/**
 * Builds a low-sensitivity event. Never pass prompts, model output, headers,
 * API keys, user identifiers, or raw exception messages to this function.
 */
export function buildTelemetryEvent(input = {}, now = new Date().toISOString()) {
  const taskType = TASK_TYPES.has(input.taskType) ? input.taskType : "unknown";
  const status = STATUSES.has(input.status) ? input.status : "stopped";
  const code = typeof input.code === "string" && /^[A-Z0-9_]{1,48}$/.test(input.code)
    ? input.code : "UNCLASSIFIED";
  const durationMs = Number.isFinite(input.durationMs) && input.durationMs >= 0
    ? Math.min(Math.floor(input.durationMs), 86_400_000) : 0;
  const agentCount = Number.isSafeInteger(input.agentCount) && input.agentCount >= 0
    ? Math.min(input.agentCount, 3) : 0;
  const providerCalls = Number.isSafeInteger(input.providerCalls) && input.providerCalls >= 0
    ? Math.min(input.providerCalls, 3) : 0;
  const requestId = typeof input.requestId === "string" && /^[0-9a-f-]{16,64}$/i.test(input.requestId)
    ? input.requestId : createRequestId();
  return {
    schema: "safe-automaton.telemetry.v1",
    requestId,
    at: now,
    taskType,
    status,
    code,
    durationMs,
    agentCount,
    providerCalls,
    externalActionsTaken: false,
    spendingAuthorized: false
  };
}
