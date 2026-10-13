import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/agent-memory.js";
import { listAudit, listMemory, saveMemory, validateMemoryInput } from "../functions/_lib/agent-memory.mjs";

class MemoryKV {
  constructor() { this.data = new Map(); }
  async get(key) { return this.data.get(key) ?? null; }
  async put(key, value) { this.data.set(key, value); }
  async list({ prefix = "", limit = 1000, cursor } = {}) {
    const keys = [...this.data.keys()].filter(key => key.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const selected = keys.slice(start, start + limit);
    const next = start + selected.length;
    return { keys: selected.map(name => ({ name })), list_complete: next >= keys.length, cursor: next >= keys.length ? undefined : String(next) };
  }
}
const token = "t".repeat(40);
function request(body, options = {}) {
  return new Request("https://safe-automaton.example/api/agent-memory", {
    method: options.method || "POST",
    headers: { "Content-Type": "application/json", "X-Safe-Automaton-AI-Token": token, ...(options.headers || {}) },
    body: options.method === "GET" ? undefined : JSON.stringify(body)
  });
}
async function call(req, env = {}) {
  const response = await onRequest({ request: req, env: { SAFE_AUTOMATON_AI_TOKEN: token, AGENT_MEMORY_KV: new MemoryKV(), ...env } });
  return { response, data: await response.json() };
}

test("memory validates keys, bounds content, and rejects obvious secrets", () => {
  assert.equal(validateMemoryInput({ key: "project.goal", value: "Use draft-only workflow" }).ok, true);
  assert.equal(validateMemoryInput({ key: "../secret", value: "x" }).code, "INVALID_MEMORY_KEY");
  assert.equal(validateMemoryInput({ key: "api", value: "api_key=abcdef" }).code, "POSSIBLE_SECRET_REJECTED");
  assert.equal(validateMemoryInput({ key: "long", value: "x".repeat(3001) }).code, "INVALID_MEMORY_VALUE");
});

test("memory writes versioned values and audit metadata without raw content", async () => {
  const store = new MemoryKV();
  const first = await saveMemory(store, { key: "project.goal", value: "Only safe local drafts", category: "project" }, "2026-10-13T10:00:00.000Z", "event-1");
  const second = await saveMemory(store, { key: "project.goal", value: "Draft-only, zero spend", category: "project" }, "2026-10-13T10:01:00.000Z", "event-2");
  assert.equal(first.ok, true);
  assert.equal(second.record.version, 2);
  assert.equal(second.record.createdAt, "2026-10-13T10:00:00.000Z");
  const memories = await listMemory(store);
  assert.equal(memories.records.length, 1);
  assert.equal(memories.records[0].value, "Draft-only, zero spend");
  const audit = await listAudit(store);
  assert.equal(audit.records.length, 2);
  assert.equal(audit.records[0].operation, "memory.updated");
  assert.equal("value" in audit.records[0], false);
  assert.match(audit.records[0].valueSha256, /^[a-f0-9]{64}$/);
});

test("memory endpoint requires POST, same origin, token and configured KV", async () => {
  const noStore = await call(request({ action: "list" }), { AGENT_MEMORY_KV: undefined });
  assert.equal(noStore.response.status, 503);
  const wrongToken = await call(request({ action: "list" }, { headers: { "X-Safe-Automaton-AI-Token": "bad" } }));
  assert.equal(wrongToken.response.status, 401);
  const crossOrigin = await call(request({ action: "list" }, { headers: { Origin: "https://evil.example" } }));
  assert.equal(crossOrigin.response.status, 403);
  const get = await call(request({}, { method: "GET" }));
  assert.equal(get.response.status, 405);
});

test("memory endpoint saves and lists only explicit records; audit states its limitation", async () => {
  const store = new MemoryKV();
  const env = { AGENT_MEMORY_KV: store };
  const saved = await call(request({ action: "save", key: "task.rule", value: "Never publish automatically" }), env);
  assert.equal(saved.response.status, 201);
  assert.equal(saved.data.externalActionsTaken, false);
  const listed = await call(request({ action: "list" }), env);
  assert.equal(listed.data.records.length, 1);
  const audit = await call(request({ action: "audit" }), env);
  assert.equal(audit.data.records.length, 1);
  assert.equal(audit.data.tamperEvident, false);
});
