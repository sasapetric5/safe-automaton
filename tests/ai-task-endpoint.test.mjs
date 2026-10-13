import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/ai-task.js";

const TEST_TOKEN = "a".repeat(40);
function request(body, options = {}) {
  const headers = new Headers({ 'X-Safe-Automaton-AI-Token': TEST_TOKEN, ...(options.headers || {}) });
  if (typeof body === "string") headers.set("Content-Type", "application/json");
  else if (body !== undefined) {
    body = JSON.stringify(body);
    headers.set("Content-Type", "application/json");
  }
  return new Request("https://safe-automaton.example/api/ai-task", {
    method: options.method || "POST",
    headers,
    body: options.method === "GET" ? undefined : body
  });
}
async function call(req, env = {}) {
  const response = await onRequest({ request: req, env });
  return { response, data: await response.json() };
}

test("AI task endpoint rejects methods other than POST", async () => {
  const { response } = await call(request(undefined, { method: "GET" }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});

test("AI task endpoint rejects cross-origin requests", async () => {
  const { response } = await call(request({ taskType: "seo", title: "Test", brief: "Test" }, {
    headers: { Origin: "https://attacker.example" }
  }));
  assert.equal(response.status, 403);
});

test("AI task endpoint rejects malformed JSON, unknown task types and missing required fields", async () => {
  assert.equal((await call(request("{"))).response.status, 400);
  assert.equal((await call(request({ taskType: "unknown", title: "T", brief: "B" }))).response.status, 400);
  assert.equal((await call(request({ taskType: "seo", title: "", brief: "B" }))).response.status, 400);
});

test("AI task endpoint enforces request size before model invocation", async () => {
  let called = false;
  const huge = JSON.stringify({ taskType: "seo", title: "T", brief: "x".repeat(13000) });
  const { response } = await call(request(huge), { SAFE_AUTOMATON_AI_ENABLED: "true", AI: { run: async () => { called = true; } } });
  assert.equal(response.status, 413);
  assert.equal(called, false);
});

test("AI task endpoint fails closed unless explicitly enabled and bound", async () => {
  let called = false;
  const input = { taskType: "seo", title: "Audit", brief: "Pregledaj dostavljene nalaze." };
  const disabled = await call(request(input), { AI: { run: async () => { called = true; } } });
  assert.equal(disabled.response.status, 503);
  assert.equal(called, false);
  const missingBinding = await call(request(input), { SAFE_AUTOMATON_AI_ENABLED: "true" });
  assert.equal(missingBinding.response.status, 503);
  assert.equal(called, false);
});

test("AI task endpoint uses the fixed model, bounded output and never claims verification or sends", async () => {
  let captured;
  const env = {
    SAFE_AUTOMATON_AI_ENABLED: "true",
    SAFE_AUTOMATON_AI_TOKEN: TEST_TOKEN,
    AI: { run: async (model, input) => {
      captured = { model, input };
      return { response: "## Nacrt\n\nProveri dokaz pre upotrebe." };
    } }
  };
  const { response, data } = await call(request({
    taskType: "research",
    title: "Provera prilike",
    brief: "Proceni priliku bez izmišljanja činjenica.",
    evidence: "Izvor još nije nezavisno potvrđen."
  }), env);
  assert.equal(response.status, 200);
  assert.equal(captured.model, "@cf/zai-org/glm-4.7-flash");
  assert.equal(captured.input.max_completion_tokens, 900);
  assert.equal(captured.input.temperature, 0.2);
  assert.match(captured.input.messages[0].content, /Ne izmišljaj činjenice/);
  assert.match(captured.input.messages[1].content, /Izvor još nije nezavisno potvrđen/);
  assert.equal(data.verified, false);
  assert.equal(data.sent, false);
  assert.equal(data.externalActionsTaken, false);
  assert.equal(data.status, "AI_DRAFT_REQUIRES_HUMAN_REVIEW");
  assert.match(data.draft, /Proveri dokaz/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("AI task endpoint handles empty model output and provider failure safely", async () => {
  const input = { taskType: "qa", title: "QA", brief: "Napravi plan." };
  const base = { SAFE_AUTOMATON_AI_ENABLED: "true", SAFE_AUTOMATON_AI_TOKEN: TEST_TOKEN };
  const empty = await call(request(input), { ...base, AI: { run: async () => ({ response: "  " }) } });
  assert.equal(empty.response.status, 502);
  const failed = await call(request(input), { ...base, AI: { run: async () => { throw new Error("secret provider details"); } } });
  assert.equal(failed.response.status, 502);
  assert.doesNotMatch(JSON.stringify(failed.data), /secret provider details/);
});
