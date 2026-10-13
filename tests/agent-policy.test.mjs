import test from "node:test";
import assert from "node:assert/strict";
import { evaluateToolCall, getRuntimePolicySummary } from "../functions/_lib/agent-policy.mjs";

test("permits only explicitly allowlisted local draft capabilities", () => {
  for (const name of ["read_task_context", "summarize_evidence", "create_draft", "build_checklist"]) {
    assert.equal(evaluateToolCall({ name }).decision, "allow");
  }
});

test("hard-denies shell, money, external actions, self-modification and replication", () => {
  for (const name of ["exec", "shell", "wallet", "send_payment", "send_email", "publish_content", "self_modify", "replicate_agent", "git_push"]) {
    const result = evaluateToolCall({ name });
    assert.equal(result.decision, "deny", name);
    assert.equal(result.code, "HARD_DENY_CAPABILITY", name);
  }
});

test("external preparation is not execution and requires separate human review", () => {
  const result = evaluateToolCall({ name: "prepare_external_submission" });
  assert.equal(result.decision, "approval_required");
  assert.equal(result.executed, false);
});

test("unknown or malformed capabilities fail closed", () => {
  assert.equal(evaluateToolCall({ name: "future_magic_tool" }).decision, "deny");
  assert.equal(evaluateToolCall({}).code, "CAPABILITY_NAME_MISSING");
});

test("runtime policy remains draft-only with zero authorized spend", () => {
  const policy = getRuntimePolicySummary();
  assert.equal(policy.mode, "draft-only");
  assert.equal(policy.toolExecutionEnabled, false);
  assert.equal(policy.externalActionsEnabled, false);
  assert.equal(policy.spendingLimitEur, 0);
  assert.equal(policy.humanApprovalExecutesActions, false);
});
