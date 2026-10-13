const MAX_KEYS = 30;
const MAX_BLOCKS = 20;
const MAX_DEPTH = 5;

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function safeKeys(value, limit = MAX_KEYS) {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value).slice(0, limit);
}

function describe(value) {
  const type = typeOf(value);
  const info = { type };
  if (typeof value === "string") info.length = value.length;
  if (Array.isArray(value)) {
    info.length = value.length;
    info.blockTypes = value.slice(0, MAX_BLOCKS).map(item => {
      if (item && typeof item === "object") {
        return typeof item.type === "string" ? item.type.slice(0, 80) : typeOf(item);
      }
      return typeOf(item);
    });
  } else if (value && typeof value === "object") {
    info.keys = safeKeys(value, 20);
  }
  return info;
}

function textFrom(value, depth = 0) {
  if (depth > MAX_DEPTH || value == null) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map(item => textFrom(item, depth + 1)).filter(Boolean).join("\n").trim();
  }
  if (typeof value !== "object") return "";
  // Prefer actual text fields; do not mistake reasoning/refusal metadata for a draft.
  for (const key of ["text", "content", "response", "output_text", "generated_text"]) {
    if (key in value) {
      const found = textFrom(value[key], depth + 1);
      if (found) return found;
    }
  }
  return "";
}

export function extractText(result) {
  const candidates = [
    result?.response,
    result?.result?.response,
    result?.output_text,
    result?.generated_text,
    result?.text,
    result?.choices?.[0]?.message?.content,
    result?.result?.choices?.[0]?.message?.content,
    result?.output?.[0]?.content,
    result?.output,
    result?.result?.output_text
  ];
  for (const candidate of candidates) {
    const text = textFrom(candidate);
    if (text) return { text };
  }
  return { text: "" };
}

function redactString(value, redactions) {
  let output = String(value ?? "").slice(0, 500);
  for (const secret of redactions) {
    if (typeof secret === "string" && secret.length >= 3) {
      output = output.split(secret).join("[REDACTED]");
    }
  }
  // Mask common credential-like values even if they were not explicitly passed.
  output = output
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/(token|api[_ -]?key|secret|authorization)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[REDACTED]");
  return output;
}

export function buildDiagnostics({ model, maxTokensRequested, maxTokens, result, error, redact = [] } = {}) {
  const requested = Number.isFinite(maxTokensRequested) ? maxTokensRequested : maxTokens;
  const diagnostics = {
    model: typeof model === "string" ? model.slice(0, 160) : "unknown",
    status: result && typeof result.status === "string"
      ? result.status.slice(0, 100)
      : result && typeof result.done === "boolean"
        ? (result.done ? "done" : "not_done")
        : null,
    finishReason: null,
    maxTokensRequested: Number.isFinite(requested) ? requested : null,
    usage: null,
    blocks: [],
    responseType: typeOf(result),
    responseKeys: safeKeys(result),
    output: null,
    usableTextFound: false,
    textLength: 0,
    responseState: "unknown",
    error: null
  };

  if (result && typeof result === "object") {
    const choice = result.choices?.[0] ?? result.result?.choices?.[0];
    diagnostics.finishReason = typeof choice?.finish_reason === "string"
      ? choice.finish_reason.slice(0, 100)
      : typeof result.finish_reason === "string"
        ? result.finish_reason.slice(0, 100)
        : typeof result.stop_reason === "string"
          ? result.stop_reason.slice(0, 100)
          : null;

    const usage = result.usage ?? result.result?.usage ?? choice?.usage;
    if (usage && typeof usage === "object" && !Array.isArray(usage)) {
      const safeUsage = {};
      for (const key of ["prompt_tokens", "completion_tokens", "total_tokens", "input_tokens", "output_tokens"]) {
        if (Number.isFinite(usage[key])) safeUsage[key] = usage[key];
      }
      diagnostics.usage = safeUsage;
    }

    const rawBlocks = Array.isArray(result.output) ? result.output
      : Array.isArray(result.response) ? result.response
      : Array.isArray(result.content) ? result.content
      : Array.isArray(choice?.message?.content) ? choice.message.content
      : [];
    diagnostics.blocks = rawBlocks.slice(0, MAX_BLOCKS).map(block => {
      if (!block || typeof block !== "object") return { type: typeOf(block) };
      const item = { type: typeof block.type === "string" ? block.type.slice(0, 80) : typeOf(block) };
      for (const key of ["status", "finish_reason", "stop_reason"]) {
        if (typeof block[key] === "string") item[key] = block[key].slice(0, 100);
      }
      const textValue = typeof block.text === "string" ? block.text
        : typeof block.content === "string" ? block.content : null;
      if (textValue !== null) item.textLength = textValue.length;
      if (Array.isArray(block.content)) {
        item.contentBlocks = block.content.slice(0, MAX_BLOCKS).map(part => ({
          type: part && typeof part.type === "string" ? part.type.slice(0, 80) : typeOf(part),
          ...(part && typeof part.text === "string" ? { textLength: part.text.length } : {})
        }));
      }
      return item;
    });

    const candidates = [
      ["response", result.response],
      ["result.response", result.result?.response],
      ["output_text", result.output_text],
      ["generated_text", result.generated_text],
      ["text", result.text],
      ["choices[0].message.content", result.choices?.[0]?.message?.content],
      ["result.choices[0].message.content", result.result?.choices?.[0]?.message?.content],
      ["output[0].content", result.output?.[0]?.content],
      ["output", result.output]
    ];
    for (const [path, value] of candidates) {
      if (value !== undefined) {
        diagnostics.output = { path, ...describe(value) };
        break;
      }
    }
  }

  const extracted = extractText(result).text;
  diagnostics.usableTextFound = Boolean(extracted);
  diagnostics.textLength = extracted.length;
  if (error) {
    diagnostics.error = {
      name: redactString(error?.name || "Error", redact),
      message: redactString(error?.message || "Model/API call failed", redact)
    };
    diagnostics.responseState = "exception";
  } else if (result == null) {
    diagnostics.responseState = "empty_response";
  } else if (extracted) {
    diagnostics.responseState = "text_found";
  } else if (result && typeof result === "object" && Object.keys(result).length === 0) {
    diagnostics.responseState = "empty_object";
  } else if (diagnostics.output?.type === "array" && diagnostics.output.length === 0) {
    diagnostics.responseState = "empty_output_array";
  } else {
    diagnostics.responseState = "unsupported_or_empty_output";
  }
  return diagnostics;
}
