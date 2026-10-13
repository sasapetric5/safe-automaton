import test from "node:test";
import assert from "node:assert/strict";
import { createScheduledTask, listScheduledTasks, validateScheduledTask } from "../functions/_lib/task-scheduler.mjs";
import { onRequest } from "../functions/api/scheduler.js";

class KV {
  constructor() { this.data = new Map(); }
  async get(key) { return this.data.get(key) ?? null; }
  async put(key, value) { this.data.set(key, value); }
  async list({ prefix = "", limit = 50, cursor } = {}) {
    const keys = [...this.data.keys()].filter(k => k.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0, selected = keys.slice(start, start + limit), next = start + selected.length;
    return { keys: selected.map(name => ({ name })), list_complete: next >= keys.length, cursor: next >= keys.length ? undefined : String(next) };
  }
}
const now = Date.parse("2026-10-13T10:00:00.000Z");
const task = { taskType: "seo", title: "Pregled SEO nacrta", brief: "Samo pripremi kontrolnu listu.", dueAt: "2026-10-14T10:00:00.000Z" };
test("scheduler accepts only bounded draft task types and future dates within 30 days", () => {
  assert.equal(validateScheduledTask(task, now).ok, true);
  assert.equal(validateScheduledTask({ ...task, taskType: "payment" }, now).code, "TASK_TYPE_NOT_ALLOWED");
  assert.equal(validateScheduledTask({ ...task, dueAt: "2026-10-12T10:00:00.000Z" }, now).code, "DUE_DATE_OUT_OF_RANGE");
  assert.equal(validateScheduledTask({ ...task, dueAt: "2027-01-01T00:00:00.000Z" }, now).code, "DUE_DATE_OUT_OF_RANGE");
});
test("scheduler stores and previews due tasks without executing them", async () => {
  const store = new KV();
  const created = await createScheduledTask(store, task, now, "task-1");
  assert.equal(created.ok, true);
  assert.equal(created.task.status, "scheduled-draft-only");
  assert.equal((await listScheduledTasks(store, now, true)).tasks.length, 0);
  assert.equal((await listScheduledTasks(store, now + 25 * 60 * 60 * 1000, true)).tasks.length, 1);
});
test("scheduler endpoint fails closed without auth or KV and never enables execution", async () => {
  const token = "z".repeat(40);
  const makeRequest = (body, headers = {}) => new Request("https://safe-automaton.example/api/scheduler", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Safe-Automaton-AI-Token": token, ...headers }, body: JSON.stringify(body)
  });
  let response = await onRequest({ request: makeRequest({ action: "list" }), env: { SAFE_AUTOMATON_AI_TOKEN: token } });
  assert.equal(response.status, 503);
  const store = new KV();
  response = await onRequest({ request: makeRequest({ action: "create", ...task }), env: { SAFE_AUTOMATON_AI_TOKEN: token, AGENT_SCHEDULER_KV: store } });
  const data = await response.json();
  assert.equal(response.status, 201);
  assert.equal(data.executionEnabled, false);
  assert.equal(data.externalActionsTaken, false);
  assert.equal(data.spendingAuthorized, false);
});
