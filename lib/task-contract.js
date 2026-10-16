/**
 * Safe Automaton v1 task contract and deterministic state transitions.
 *
 * This module is deliberately side-effect free: it does not call models,
 * access the network, persist data, execute code, or perform external actions.
 */

export const TASK_SCHEMA_VERSION = 1;

export const TASK_STATUS = Object.freeze({
  QUEUED: "QUEUED",
  PLANNING: "PLANNING",
  RUNNING: "RUNNING",
  VERIFYING: "VERIFYING",
  PASSED: "PASSED",
  FAILED: "FAILED",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  BLOCKED: "BLOCKED"
});

export const CHECK_STATUS = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  NOT_RUN: "NOT_RUN"
});

const TERMINAL_STATUSES = new Set([
  TASK_STATUS.PASSED,
  TASK_STATUS.FAILED,
  TASK_STATUS.NEEDS_REVIEW,
  TASK_STATUS.BLOCKED
]);

const TRANSITIONS = Object.freeze({
  [TASK_STATUS.QUEUED]: new Set([TASK_STATUS.PLANNING, TASK_STATUS.BLOCKED]),
  [TASK_STATUS.PLANNING]: new Set([
    TASK_STATUS.RUNNING, TASK_STATUS.FAILED, TASK_STATUS.NEEDS_REVIEW, TASK_STATUS.BLOCKED
  ]),
  [TASK_STATUS.RUNNING]: new Set([
    TASK_STATUS.VERIFYING, TASK_STATUS.FAILED, TASK_STATUS.NEEDS_REVIEW, TASK_STATUS.BLOCKED
  ]),
  [TASK_STATUS.VERIFYING]: new Set([
    TASK_STATUS.PASSED, TASK_STATUS.FAILED, TASK_STATUS.NEEDS_REVIEW, TASK_STATUS.BLOCKED
  ])
});

export class TaskContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TaskContractError";
    this.code = code;
  }
}

function requireText(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TaskContractError("INVALID_TASK_FIELD", `${field} must be a non-empty string.`);
  }
  return value.trim();
}

function normalizeCriteria(criteria) {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    throw new TaskContractError("ACCEPTANCE_CRITERIA_REQUIRED", "At least one acceptance criterion is required.");
  }
  const seen = new Set();
  return criteria.map((criterion, index) => {
    const id = requireText(criterion?.id, `acceptanceCriteria[${index}].id`);
    const description = requireText(criterion?.description, `acceptanceCriteria[${index}].description`);
    if (seen.has(id)) {
      throw new TaskContractError("DUPLICATE_CRITERION_ID", `Duplicate acceptance criterion ID: ${id}`);
    }
    seen.add(id);
    return { id, description, required: criterion.required !== false };
  });
}

/**
 * Create a new, versioned task. Safety permissions are fixed fail-closed
 * defaults and cannot be elevated through caller-supplied permissions.
 */
export function createTask({
  taskId,
  taskType,
  goal,
  acceptanceCriteria,
  input = {},
  permittedSources = [],
  allowedTools = [],
  createdAt = new Date().toISOString(),
  maxAttempts = 2
}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 2) {
    throw new TaskContractError("INVALID_MAX_ATTEMPTS", "maxAttempts must be an integer from 1 to 2.");
  }
  if (!Array.isArray(permittedSources) || !Array.isArray(allowedTools)) {
    throw new TaskContractError("INVALID_TASK_LIST", "permittedSources and allowedTools must be arrays.");
  }

  return {
    task_id: requireText(taskId, "taskId"),
    schema_version: TASK_SCHEMA_VERSION,
    task_type: requireText(taskType, "taskType"),
    created_at: requireText(createdAt, "createdAt"),
    goal: requireText(goal, "goal"),
    input,
    permitted_sources: [...permittedSources],
    acceptance_criteria: normalizeCriteria(acceptanceCriteria),
    permissions: {
      allowed_tools: [...allowedTools],
      allowed_actions: [],
      external_actions_allowed: false,
      spend_limit_eur: 0
    },
    plan: [],
    artifacts: [],
    evidence: [],
    checks: [],
    attempt_count: 0,
    max_attempts: maxAttempts,
    errors: [],
    status: TASK_STATUS.QUEUED,
    human_approval_required: true,
    approval_record: null
  };
}

function validateChecks(checks) {
  if (!Array.isArray(checks)) {
    throw new TaskContractError("INVALID_CHECKS", "checks must be an array.");
  }
  const ids = new Set();
  return checks.map((check, index) => {
    const id = requireText(check?.id, `checks[${index}].id`);
    const criterionId = requireText(check?.criterionId, `checks[${index}].criterionId`);
    if (!Object.values(CHECK_STATUS).includes(check?.result)) {
      throw new TaskContractError("INVALID_CHECK_RESULT", `Check ${id} has an invalid result.`);
    }
    if (ids.has(id)) {
      throw new TaskContractError("DUPLICATE_CHECK_ID", `Duplicate check ID: ${id}`);
    }
    ids.add(id);
    return { ...check, id, criterionId };
  });
}

function assertRequiredCriteriaPassed(task, checks) {
  const requiredCriteria = task.acceptance_criteria.filter(item => item.required);
  for (const criterion of requiredCriteria) {
    const related = checks.filter(check => check.criterionId === criterion.id);
    if (related.length === 0 || related.some(check => check.result === CHECK_STATUS.NOT_RUN)) {
      throw new TaskContractError(
        "REQUIRED_CHECK_NOT_PASSED",
        `Required acceptance criterion "${criterion.id}" has no completed check.`
      );
    }
    if (!related.some(check => check.result === CHECK_STATUS.PASS)) {
      throw new TaskContractError(
        "REQUIRED_CHECK_FAILED",
        `Required acceptance criterion "${criterion.id}" has no passing check.`
      );
    }
  }
}

/**
 * Return a new task snapshot after a legal transition; the original is unchanged.
 * A task can enter PASSED only from VERIFYING after every required criterion
 * has at least one PASS check and no associated required check is NOT_RUN.
 */
export function transitionTask(task, nextStatus, patch = {}) {
  if (!task || task.schema_version !== TASK_SCHEMA_VERSION) {
    throw new TaskContractError("UNSUPPORTED_TASK_SCHEMA", "Task is missing or uses an unsupported schema version.");
  }
  if (!Object.values(TASK_STATUS).includes(nextStatus)) {
    throw new TaskContractError("INVALID_TASK_STATUS", `Unknown task status: ${nextStatus}`);
  }
  if (TERMINAL_STATUSES.has(task.status)) {
    throw new TaskContractError("TASK_ALREADY_TERMINAL", `Task status ${task.status} is terminal.`);
  }
  if (!TRANSITIONS[task.status]?.has(nextStatus)) {
    throw new TaskContractError(
      "ILLEGAL_TASK_TRANSITION",
      `Transition from ${task.status} to ${nextStatus} is not allowed.`
    );
  }

  const checks = patch.checks === undefined ? task.checks : validateChecks(patch.checks);
  if (nextStatus === TASK_STATUS.PASSED) assertRequiredCriteriaPassed(task, checks);

  const next = {
    ...task,
    status: nextStatus,
    checks: checks.map(check => ({ ...check })),
    plan: patch.plan === undefined ? task.plan : [...patch.plan],
    artifacts: patch.artifacts === undefined ? task.artifacts : [...patch.artifacts],
    evidence: patch.evidence === undefined ? task.evidence : [...patch.evidence],
    errors: patch.errors === undefined ? task.errors : [...patch.errors]
  };

  // Safety invariants cannot be overridden by a transition patch.
  next.permissions = {
    ...task.permissions,
    allowed_actions: [],
    external_actions_allowed: false,
    spend_limit_eur: 0
  };
  next.human_approval_required = true;
  next.approval_record = null;
  return next;
}
