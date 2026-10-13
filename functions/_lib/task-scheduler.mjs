const ALLOWED_TASK_TYPES = new Set(["seo", "research", "qa", "scope"]);
const MAX_TITLE = 180;
const MAX_BRIEF = 4_000;
const MAX_HORIZON_MS = 30 * 24 * 60 * 60 * 1000;

export function validateScheduledTask(input, now = Date.now()) {
  const taskType = typeof input?.taskType === "string" ? input.taskType : "";
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const brief = typeof input?.brief === "string" ? input.brief.trim() : "";
  const dueAt = typeof input?.dueAt === "string" ? Date.parse(input.dueAt) : NaN;
  if (!ALLOWED_TASK_TYPES.has(taskType)) return { ok: false, code: "TASK_TYPE_NOT_ALLOWED" };
  if (!title || title.length > MAX_TITLE || !brief || brief.length > MAX_BRIEF) {
    return { ok: false, code: "INVALID_TASK_CONTENT" };
  }
  if (!Number.isFinite(dueAt) || dueAt <= now || dueAt > now + MAX_HORIZON_MS) {
    return { ok: false, code: "DUE_DATE_OUT_OF_RANGE" };
  }
  return {
    ok: true,
    task: { taskType, title, brief, dueAt: new Date(dueAt).toISOString(), status: "scheduled-draft-only" }
  };
}

export async function createScheduledTask(store, input, now = Date.now(), id = crypto.randomUUID()) {
  const result = validateScheduledTask(input, now);
  if (!result.ok) return result;
  const task = { id, ...result.task, createdAt: new Date(now).toISOString() };
  await store.put("schedule:v1:" + id, JSON.stringify(task));
  return { ok: true, task };
}

export async function listScheduledTasks(store, now = Date.now(), dueOnly = false, cursor) {
  const page = await store.list({ prefix: "schedule:v1:", limit: 50, ...(cursor ? { cursor } : {}) });
  const tasks = [];
  for (const item of page.keys || []) {
    const raw = await store.get(item.name);
    if (!raw) continue;
    try {
      const task = JSON.parse(raw);
      if (!dueOnly || Date.parse(task.dueAt) <= now) tasks.push(task);
    } catch { /* Ignore malformed records. */ }
  }
  tasks.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  return { tasks, cursor: page.list_complete === false ? page.cursor || null : null };
}
