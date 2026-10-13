import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/agent-run.js";

function request(body, options = {}) {
  const headers = new Headers(options.headers || {});
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return new Request("https://safe-automaton.example/api/agent-run", {
    method: options.method || "POST",
    headers,
    body: options.method === "GET" ? undefined : body === undefined ? undefined : JSON.stringify(body)
  });
}
async function call(req, env = {}) {
  const response = await onRequest({ request: req, env });
  return { response, data: await response.json() };
}
const input = { taskType: "seo", title: "SEO provera", brief: "Pripremi proverljiv plan.", evidence: "Nema spoljne verifikacije." };
const enabled = { SAFE_AUTOMATON_AI_ENABLED: "true", SAFE_AUTOMATON_AI_TOKEN: "x".repeat(40) };
const auth = { "X-Safe-Automaton-AI-Token": "x".repeat(40) };

test("agent runtime only accepts POST and sets Allow header", async () => {
  const { response } = await call(request(undefined, { method: "GET" }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("agent runtime rejects cross-origin requests", async () => {
  const { response } = await call(request(input, { headers: { Origin: "https://attacker.example" } }));
  assert.equal(response.status, 403);
});

test("agent runtime fails closed when disabled, token missing, or binding missing", async () => {
  let calls = 0;
  const ai = { run: async () => { calls++; return { response: "ok" }; } };
  assert.equal((await call(request(input), { AI: ai })).response.status, 503);
  assert.equal((await call(request(input, { headers: auth }), { ...enabled })).response.status, 503);
  assert.equal((await call(request(input), { ...enabled, AI: ai })).response.status, 401);
  assert.equal(calls, 0);
});

test("agent pipeline runs planner, specialist and reviewer in order and labels output unverified", async () => {
  const seen = [];
  const env = { ...enabled, AI: { run: async (model, payload) => {
    seen.push({ model, payload });
    return { response: "Faza " + seen.length + ": proverljivi koraci." };
  } } };
  const { response, data } = await call(request(input, { headers: auth }), env);
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.agentCount, 3);
  assert.deepEqual(data.trace.map(item => item.agent), ["planner", "specialist", "reviewer"]);
  assert.equal(seen.length, 3);
  assert.ok(seen.every(item => item.model === "@cf/zai-org/glm-4.7-flash"));
  assert.ok(seen[1].payload.messages[1].content.includes("IZLAZ AGENTA PLANNER"));
  assert.ok(seen[2].payload.messages[1].content.includes("IZLAZ AGENTA SPECIALIST"));
  assert.equal(data.verified, false);
  assert.equal(data.sent, false);
  assert.equal(data.externalActionsTaken, false);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(data.disclaimer, /nema alata/i);
});

test("agent pipeline stops immediately on empty output and does not claim success", async () => {
  let calls = 0;
  const env = { ...enabled, AI: { run: async () => { calls++; return { response: " " }; } } };
  const { response, data } = await call(request(input, { headers: auth }), env);
  assert.equal(response.status, 502);
  assert.equal(calls, 1);
  assert.equal(data.ok, false);
  assert.equal(data.verified, false);
  assert.equal(data.sent, false);
});

test("agent pipeline stops on provider failure without leaking provider error", async () => {
  const env = { ...enabled, AI: { run: async () => { throw new Error("secret provider response"); } } };
  const { response, data } = await call(request(input, { headers: auth }), env);
  assert.equal(response.status, 502);
  assert.equal(data.code, "AGENT_PROVIDER_ERROR");
  assert.doesNotMatch(JSON.stringify(data), /secret provider response/);
});
