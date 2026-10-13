import { createScheduledTask, listScheduledTasks } from "../_lib/task-scheduler.mjs";

const MAX_BODY_BYTES = 5_000;
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}
function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}
export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json({ error: "Koristi POST." }, 405);
  if (!sameOrigin(request)) return json({ error: "Cross-origin zahtev nije dozvoljen." }, 403);
  const expected = env?.SAFE_AUTOMATON_AI_TOKEN;
  const provided = request.headers.get("X-Safe-Automaton-AI-Token") || "";
  if (typeof expected !== "string" || expected.length < 32) return json({ error: "Pristup nije konfigurisan.", code: "TOKEN_NOT_CONFIGURED" }, 503);
  if (provided.length < 32 || provided !== expected) return json({ error: "Neispravan pristupni token." }, 401);
  const store = env?.AGENT_SCHEDULER_KV;
  if (!store || typeof store.get !== "function" || typeof store.put !== "function" || typeof store.list !== "function") {
    return json({ error: "Scheduler nije aktiviran. Potreban je KV binding AGENT_SCHEDULER_KV.", code: "SCHEDULER_STORE_NOT_CONFIGURED", executionEnabled: false }, 503);
  }
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_BODY_BYTES) return json({ error: "Zahtev je prevelik." }, 413);
  let raw;
  try { raw = await request.text(); } catch { return json({ error: "Ne mogu da pročitam zahtev." }, 400); }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "Zahtev je prevelik." }, 413);
  let input;
  try { input = JSON.parse(raw); } catch { return json({ error: "Neispravan JSON." }, 400); }
  try {
    if (input?.action === "create") {
      const result = await createScheduledTask(store, input);
      if (!result.ok) return json({ error: "Zadatak nije zakazan.", code: result.code }, 400);
      return json({ ok: true, task: result.task, executionEnabled: false, externalActionsTaken: false, spendingAuthorized: false }, 201);
    }
    if (input?.action === "list" || input?.action === "preview") {
      const result = await listScheduledTasks(store, Date.now(), input.action === "preview", typeof input.cursor === "string" ? input.cursor : undefined);
      return json({
        ok: true, ...result,
        mode: input.action === "preview" ? "DUE_TASKS_PREVIEW_ONLY" : "SCHEDULED_DRAFT_ONLY",
        executionEnabled: false, externalActionsTaken: false, spendingAuthorized: false
      });
    }
    return json({ error: "Nepoznata akcija. Dozvoljeno: create, list, preview." }, 400);
  } catch {
    return json({ error: "Greška skladišta; izvršavanje nije pokrenuto.", code: "SCHEDULER_STORE_ERROR", executionEnabled: false }, 503);
  }
}
