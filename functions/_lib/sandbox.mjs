const MAX_INPUT_CHARS = 20_000;
const ALLOWED_OPERATIONS = new Set(["validate_json", "check_markdown", "validate_task_contract"]);

function inspectJsonDepth(value, depth = 0, state = { nodes: 0 }) {
  state.nodes += 1;
  if (depth > 20) return { ok: false, code: "JSON_DEPTH_LIMIT" };
  if (state.nodes > 5_000) return { ok: false, code: "JSON_NODE_LIMIT" };
  if (value && typeof value === "object") {
    for (const child of Array.isArray(value) ? value : Object.values(value)) {
      const result = inspectJsonDepth(child, depth + 1, state);
      if (!result.ok) return result;
    }
  }
  return { ok: true, nodes: state.nodes };
}

export function runSandboxCheck(operation, input) {
  if (!ALLOWED_OPERATIONS.has(operation)) {
    return { ok: false, code: "OPERATION_NOT_ALLOWLISTED", executionMode: "static-validation-only" };
  }
  if (typeof input !== "string" || !input.trim() || input.length > MAX_INPUT_CHARS) {
    return { ok: false, code: "INVALID_INPUT_SIZE", executionMode: "static-validation-only" };
  }

  if (operation === "validate_json") {
    let parsed;
    try { parsed = JSON.parse(input); } catch {
      return { ok: false, code: "INVALID_JSON", executionMode: "static-validation-only" };
    }
    const inspection = inspectJsonDepth(parsed);
    return inspection.ok
      ? { ok: true, code: "JSON_VALID", nodeCount: inspection.nodes, executionMode: "static-validation-only" }
      : { ok: false, code: inspection.code, executionMode: "static-validation-only" };
  }

  if (operation === "check_markdown") {
    const warnings = [];
    if (/<\s*script\b/i.test(input)) warnings.push("SCRIPT_TAG_PRESENT");
    if (/\bon[a-z]+\s*=/i.test(input)) warnings.push("INLINE_EVENT_HANDLER_PRESENT");
    if (/javascript\s*:/i.test(input)) warnings.push("JAVASCRIPT_URL_PRESENT");
    if (/<\s*iframe\b/i.test(input)) warnings.push("IFRAME_PRESENT");
    return {
      ok: warnings.length === 0,
      code: warnings.length ? "MARKDOWN_REVIEW_REQUIRED" : "MARKDOWN_STATIC_CHECK_PASSED",
      warnings,
      characterCount: input.length,
      executionMode: "static-validation-only",
      note: "Ovo je statička provera, nije HTML sanitizer i nije dokaz bezbednosti."
    };
  }

  let task;
  try { task = JSON.parse(input); } catch {
    return { ok: false, code: "TASK_CONTRACT_INVALID_JSON", executionMode: "static-validation-only" };
  }
  const errors = [];
  if (!task || typeof task !== "object" || Array.isArray(task)) errors.push("TASK_MUST_BE_OBJECT");
  else {
    if (typeof task.title !== "string" || !task.title.trim() || task.title.length > 180) errors.push("TITLE_INVALID");
    if (typeof task.brief !== "string" || !task.brief.trim() || task.brief.length > 4_000) errors.push("BRIEF_INVALID");
    if (!["seo", "research", "qa", "scope"].includes(task.taskType)) errors.push("TASK_TYPE_NOT_ALLOWED");
  }
  return {
    ok: errors.length === 0,
    code: errors.length ? "TASK_CONTRACT_INVALID" : "TASK_CONTRACT_VALID",
    errors,
    executionMode: "static-validation-only"
  };
}
