import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/agent-run.js";

const TOKEN = "t".repeat(40);
function request(body, options = {}) {
  const headers = new Headers({ "Content-Type": "application/json", ...(options.headers || {}) });
  if (options.token !== false) headers.set("X-Safe-Automaton-AI-Token", options.token || TOKEN);
  return new Request("https://safe-automaton.example/api/agent-run", {
    method: options.method || "POST",
    headers,
    body: options.method === "GET" ? undefined : JSON.stringify(body)
  });
}
async function call(req, env = {}) {
  const response = await onRequest({ request: req, env });
  return { response, data: await response.json() };
}
const valid = { taskType: "seo", title: "SEO provera", brief: "Pripremi kontrolisan nacrt.", evidence: "Samo početni HTML je pregledan." };
function env(run = async () => ({ response: "Nacrt za ljudski pregled." })) {
  return { SAFE_AUTOMATON_AI_ENABLED: "true", SAFE_AUTOMATON_AI_TOKEN: TOKEN, AI: { run } };
}

test("agent endpoint requires POST, same origin, valid input and valid token", async () => {
  assert.equal((await call(request(valid, { method: "GET" }), env())).response.status, 405);
  assert.equal((await call(request(valid, { headers: { Origin: "https://evil.example" } }), env())).response.status, 403);
  assert.equal((await call(request({ ...valid, taskType: "shell" }), env())).response.status, 400);
  assert.equal((await call(request(valid, { token: "" }), env())).response.status, 401);
  assert.equal((await call(request(valid), {})).response.status, 503);
});

test("three agents run sequentially and return a human-review draft without external actions", async () => {
  const calls = [];
  const { response, data } = await call(request(valid), env(async (model, input) => {
    calls.push({ model, input });
    return { response: "Izlaz " + calls.length };
  }));
  assert.equal(response.status, 200);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(x => x.model === "@cf/zai-org/glm-4.7-flash"));
  assert.match(calls[1].input.messages[1].content, /PLAN AGENTA PLANNER/);
  assert.match(calls[2].input.messages[1].content, /NACRT AGENTA SPECIALIST/);
  assert.equal(data.agents.length, 3);
  assert.equal(data.verified, false);
  assert.equal(data.sent, false);
  assert.equal(data.externalActionsTaken, false);
  assert.equal(data.finalDraft, "Izlaz 3");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("agent endpoint stops on model failure and reports completed steps without leaking provider details", async () => {
  let calls = 0;
  const { response, data } = await call(request(valid), env(async () => {
    calls++;
    if (calls === 2) throw new Error("private provider detail");
    return { response: "Plan." };
  }));
  assert.equal(response.status, 502);
  assert.equal(data.failedAgent, "specialist");
  assert.equal(data.completedAgents.length, 1);
  assert.doesNotMatch(JSON.stringify(data), /private provider detail/);
});

test("agent endpoint rejects oversized requests before inference", async () => {
  let calls = 0;
  const { response } = await call(request({ ...valid, brief: "x".repeat(13000) }), env(async () => {
    calls++; return { response: "unexpected" };
  }));
  assert.equal(response.status, 413);
  assert.equal(calls, 0);
});
