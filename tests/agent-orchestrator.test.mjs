import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/agent-orchestrator.js";

const TOKEN = "t".repeat(40);
const valid = { skill: "replica-build", mode: "code-repair", title: "Popravi grešku", brief: "Objasni i predloži najmanju bezbednu izmenu.", source: "function add(a,b){ return a-b }" };
function request(body, options = {}) {
  return new Request("https://safe-automaton.example/api/agent-orchestrator", {
    method: options.method || "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Safe-Automaton-AI-Token": options.token ?? TOKEN,
      ...(options.origin ? { Origin: options.origin } : {})
    },
    body: options.method === "GET" ? undefined : (typeof body === "string" ? body : JSON.stringify(body))
  });
}
function env(run) {
  return { SAFE_AUTOMATON_AI_ENABLED: "true", SAFE_AUTOMATON_AI_TOKEN: TOKEN, AI: { run } };
}

test("agent coordinator rejects wrong method, cross-origin, malformed JSON and unknown skill", async () => {
  assert.equal((await onRequest({ request: request(null, { method: "GET" }), env: env(async()=>({response:"x"})) })).status, 405);
  assert.equal((await onRequest({ request: request(valid, { origin: "https://evil.example" }), env: env(async()=>({response:"x"})) })).status, 403);
  assert.equal((await onRequest({ request: request("{bad"), env: env(async()=>({response:"x"})) })).status, 400);
  assert.equal((await onRequest({ request: request({ ...valid, skill: "shell" }), env: env(async()=>({response:"x"})) })).status, 400);
});

test("agent coordinator fails closed and never calls model when disabled or unauthorized", async () => {
  let calls = 0;
  const binding = { run: async()=>{ calls++; return {response:"x"}; } };
  assert.equal((await onRequest({ request: request(valid), env: { AI: binding } })).status, 503);
  assert.equal((await onRequest({ request: request(valid, { token: "wrong" }), env: env(binding.run) })).status, 401);
  assert.equal(calls, 0);
});

test("code repair runs a proposal pass and a separate review pass; it never applies code", async () => {
  const seen = [];
  const response = await onRequest({
    request: request(valid),
    env: env(async (model, input) => {
      seen.push({model, input});
      return { response: seen.length === 1 ? "## Predlog\n\n- return a + b" : "ODLUKA: WARN\nNije izvršeno." };
    })
  });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(seen.length, 2);
  assert.equal(seen[0].model, "@cf/zai-org/glm-4.7-flash");
  assert.match(seen[0].input.messages[0].content, /REŽIM POPRAVKE KODA/);
  assert.match(seen[1].input.messages[0].content, /nezavisni QA\/revizor/);
  assert.equal(data.mode, "code-repair-proposal");
  assert.equal(data.changesApplied, false);
  assert.equal(data.testsExecuted, false);
  assert.equal(data.verified, false);
  assert.equal(data.externalActionsTaken, false);
  assert.match(data.review, /WARN/);
});

test("agent coordinator stops if proposal is empty and hides provider errors", async () => {
  let calls = 0;
  const empty = await onRequest({ request: request(valid), env: env(async()=>{ calls++; return {}; }) });
  assert.equal(empty.status, 502);
  assert.equal(calls, 1);
  const failure = await onRequest({ request: request(valid), env: env(async()=>{ throw new Error("private provider detail"); }) });
  assert.equal(failure.status, 502);
  assert.doesNotMatch(await failure.text(), /private provider detail/);
});

test("agent coordinator enforces body size and required fields before inference", async () => {
  let called = false;
  const huge = request({ ...valid, source: "x".repeat(20_000) });
  assert.equal((await onRequest({ request: huge, env: env(async()=>{ called = true; return {response:"x"}; }) })).status, 413);
  assert.equal((await onRequest({ request: request({ ...valid, brief: "" }), env: env(async()=>{ called = true; return {response:"x"}; }) })).status, 400);
  assert.equal(called, false);
});
