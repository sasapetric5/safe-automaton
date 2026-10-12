import test from "node:test";
import assert from "node:assert/strict";
import { buildDiagnostics, extractText } from "../functions/_lib/ai-diagnostics.mjs";

test("extracts standard text output", () => {
  assert.equal(extractText({ response: "Draft text" }).text, "Draft text");
  const d = buildDiagnostics({ model: "test-model", maxTokensRequested: 900, result: { response: "Draft text" } });
  assert.equal(d.usableTextFound, true);
  assert.equal(d.textLength, 10);
  assert.equal(d.responseState, "text_found");
  assert.equal(d.maxTokensRequested, 900);
  assert.equal(d.status, null);
  assert.equal(d.finishReason, null);
  assert.equal(d.usage, null);
  assert.deepEqual(d.blocks, []);
});

test("extracts nested text blocks", () => {
  const result = { response: [{ type: "text", text: "Hello" }, { type: "text", text: "world" }] };
  assert.equal(extractText(result).text, "Hello\nworld");
  const d = buildDiagnostics({ result });
  assert.deepEqual(d.output.blockTypes, ["text", "text"]);
});

test("reasoning-only output does not count as usable draft text", () => {
  const result = { output: [{ type: "reasoning", summary: [{ type: "summary_text", text: "private reasoning" }] }] };
  const d = buildDiagnostics({ result });
  assert.equal(d.usableTextFound, false);
  assert.equal(d.responseState, "unsupported_or_empty_output");
  assert.doesNotMatch(JSON.stringify(d), /private reasoning/);
});

test("handles empty output", () => {
  const d = buildDiagnostics({ model: "test-model", result: { response: "" } });
  assert.equal(d.usableTextFound, false);
  assert.equal(d.textLength, 0);
  assert.equal(d.responseState, "unsupported_or_empty_output");
});

test("handles malformed output without exposing its contents", () => {
  const d = buildDiagnostics({ result: { response: { strange: "private payload" } } });
  assert.equal(d.usableTextFound, false);
  assert.deepEqual(d.output.keys, ["strange"]);
  assert.doesNotMatch(JSON.stringify(d), /private payload/);
});

test("reports sanitized model/API errors and redacts supplied secrets", () => {
  const d = buildDiagnostics({
    model: "test-model",
    result: undefined,
    error: new Error("failed using token SECRET_TOKEN_VALUE for private brief"),
    redact: ["SECRET_TOKEN_VALUE", "private brief"]
  });
  assert.equal(d.responseState, "exception");
  assert.equal(d.error.name, "Error");
  assert.doesNotMatch(JSON.stringify(d), /SECRET_TOKEN_VALUE|private brief/);
});

test("captures finish reason only when provided", () => {
  assert.equal(buildDiagnostics({ result: { response: "", choices: [{ finish_reason: "length", message: { content: "" } }] } }).finishReason, "length");
  assert.equal(buildDiagnostics({ result: { response: "" } }).finishReason, null);
  assert.equal(buildDiagnostics({ result: { response: "", status: "incomplete", usage: { prompt_tokens: 12, completion_tokens: 0, total_tokens: 12, secret: "do-not-copy" }, output: [{ type: "text", text: "private draft" }] }, maxTokensRequested: 900 }).status, "incomplete");
  const d = buildDiagnostics({ result: { response: "", status: "incomplete", usage: { prompt_tokens: 12, completion_tokens: 0, total_tokens: 12, secret: "do-not-copy" }, output: [{ type: "text", text: "private draft" }] }, maxTokensRequested: 900 });
  assert.equal(d.maxTokensRequested, 900);
  assert.deepEqual(d.usage, { prompt_tokens: 12, completion_tokens: 0, total_tokens: 12 });
  assert.deepEqual(d.blocks, [{ type: "text", textLength: 13 }]);
  assert.equal(d.status, "incomplete");
  assert.doesNotMatch(JSON.stringify(d), /private draft|do-not-copy|completionStatus|maxTokens/);
});
