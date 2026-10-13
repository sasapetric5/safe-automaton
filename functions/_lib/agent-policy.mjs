const ALLOWED_DRAFT_CAPABILITIES = new Set([
  "read_task_context",
  "summarize_evidence",
  "create_draft",
  "build_checklist"
]);

const HUMAN_REVIEW_ONLY = new Set([
  "prepare_external_submission",
  "prepare_publish_plan",
  "prepare_contact_draft"
]);

const HARD_DENY = new Set([
  "exec", "shell", "run_command", "write_file", "delete_file",
  "install_package", "git_push", "git_commit", "git_clone",
  "self_modify", "modify_heartbeat", "spawn_agent", "replicate_agent",
  "wallet", "transfer_credits", "send_payment", "x402_fetch",
  "register_domain", "manage_dns", "send_message", "send_email",
  "publish_content", "submit_offer", "external_fetch", "network_request",
  "scrape_private_data", "read_secret"
]);

function normalizeCapability(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[\s-]+/g, "_")
    : "";
}

/**
 * Policy evaluator for proposed capabilities. It does not execute tools.
 * Unknown capabilities are denied by default.
 */
export function evaluateToolCall(proposal = {}) {
  const capability = normalizeCapability(proposal.name ?? proposal.capability);
  if (!capability) {
    return { decision: "deny", code: "CAPABILITY_NAME_MISSING", capability: null };
  }
  if (HARD_DENY.has(capability)) {
    return { decision: "deny", code: "HARD_DENY_CAPABILITY", capability };
  }
  if (HUMAN_REVIEW_ONLY.has(capability)) {
    return {
      decision: "approval_required",
      code: "HUMAN_REVIEW_REQUIRED",
      capability,
      executed: false
    };
  }
  if (ALLOWED_DRAFT_CAPABILITIES.has(capability)) {
    return { decision: "allow", code: "SAFE_LOCAL_DRAFT_CAPABILITY", capability, executed: false };
  }
  return { decision: "deny", code: "UNKNOWN_CAPABILITY_DENIED", capability };
}

export function getRuntimePolicySummary() {
  return {
    mode: "draft-only",
    toolExecutionEnabled: false,
    externalActionsEnabled: false,
    spendingLimitEur: 0,
    unknownCapabilities: "deny",
    humanApprovalExecutesActions: false,
    allowedDraftCapabilities: [...ALLOWED_DRAFT_CAPABILITIES],
    humanReviewOnlyCapabilities: [...HUMAN_REVIEW_ONLY],
    hardDeniedCapabilities: [...HARD_DENY]
  };
}
