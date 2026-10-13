import test from "node:test";
import assert from "node:assert/strict";
import { buildTelemetryEvent, createRequestId } from "../functions/_lib/observability.mjs";

test("request IDs are unique UUIDs", () => {
  const a = createRequestId();
  const b = createRequestId();
  assert.match(a, /^[0-9a-f-]{36}$/i);
  assert.notEqual(a, b);
});

test("telemetry emits bounded low-sensitivity metadata only", () => {
  const event = buildTelemetryEvent({
    requestId: "12345678-1234-1234-1234-123456789abc",
    taskType: "seo", status: "completed", code: "DRAFT_READY",
    durationMs: 125, agentCount: 3,
    prompt: "private prompt", apiKey: "should-never-appear"
  }, "2026-10-13T10:00:00.000Z");
  assert.deepEqual(event, {
    schema: "safe-automaton.telemetry.v1",
    requestId: "12345678-1234-1234-1234-123456789abc",
    at: "2026-10-13T10:00:00.000Z",
    taskType: "seo", status: "completed", code: "DRAFT_READY",
    durationMs: 125, agentCount: 3, providerCalls: 0,
    externalActionsTaken: false, spendingAuthorized: false
  });
  assert.equal(JSON.stringify(event).includes("private prompt"), false);
  assert.equal(JSON.stringify(event).includes("should-never-appear"), false);
});

test("telemetry clamps durations and defaults unknown fields safely", () => {
  const event = buildTelemetryEvent({ taskType: "invalid", status: "anything", code: "raw error\nsecret", durationMs: 9e20, agentCount: 99 });
  assert.equal(event.taskType, "unknown");
  assert.equal(event.status, "stopped");
  assert.equal(event.code, "UNCLASSIFIED");
  assert.equal(event.durationMs, 86_400_000);
  assert.equal(event.agentCount, 3);
  assert.equal(event.spendingAuthorized, false);
});
