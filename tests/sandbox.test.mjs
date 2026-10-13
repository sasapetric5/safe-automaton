import test from "node:test";
import assert from "node:assert/strict";
import { runSandboxCheck } from "../functions/_lib/sandbox.mjs";
import { onRequest } from "../functions/api/sandbox-check.js";

test("sandbox validates JSON without evaluating code", () => {
  assert.equal(runSandboxCheck("validate_json", '{"safe":true}').code, "JSON_VALID");
  assert.equal(runSandboxCheck("validate_json", '{"x":').code, "INVALID_JSON");
  assert.equal(runSandboxCheck("validate_json", "(()=>process.exit())()").code, "INVALID_JSON");
});

test("sandbox bounds nesting and rejects unknown operations", () => {
  let nested = "0";
  for (let i = 0; i < 22; i++) nested = "[" + nested + "]";
  assert.equal(runSandboxCheck("validate_json", nested).code, "JSON_DEPTH_LIMIT");
  assert.equal(runSandboxCheck("exec", "return process.env").code, "OPERATION_NOT_ALLOWLISTED");
  assert.equal(runSandboxCheck("validate_json", "x".repeat(20_001)).code, "INVALID_INPUT_SIZE");
});

test("markdown static checks flag active content but do not claim sanitization", () => {
  const result = runSandboxCheck("check_markdown", '<script>alert(1)</script><a onclick="x" href="javascript:alert(1)">x</a>');
  assert.equal(result.ok, false);
  assert.ok(result.warnings.includes("SCRIPT_TAG_PRESENT"));
  assert.ok(result.warnings.includes("INLINE_EVENT_HANDLER_PRESENT"));
  assert.ok(result.warnings.includes("JAVASCRIPT_URL_PRESENT"));
  assert.match(result.note, /nije HTML sanitizer/i);
});

test("task contract validation is deterministic and allowlisted", () => {
  assert.equal(runSandboxCheck("validate_task_contract", JSON.stringify({ taskType: "seo", title: "Review", brief: "Prepare draft" })).ok, true);
  assert.equal(runSandboxCheck("validate_task_contract", JSON.stringify({ taskType: "payment", title: "x", brief: "y" })).code, "TASK_CONTRACT_INVALID");
});

test("sandbox endpoint requires token and never enables execution or network", async () => {
  const token = "a".repeat(40);
  const req = new Request("https://safe-automaton.example/api/sandbox-check", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Safe-Automaton-AI-Token": token },
    body: JSON.stringify({ operation: "validate_json", input: '{"ok":true}' })
  });
  const response = await onRequest({ request: req, env: { SAFE_AUTOMATON_AI_TOKEN: token } });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.executionEnabled, false);
  assert.equal(data.networkEnabled, false);
  assert.equal(data.fileAccessEnabled, false);
  assert.equal(data.spendingAuthorized, false);
});
