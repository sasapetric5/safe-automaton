import { listAudit, listMemory, saveMemory } from "../_lib/agent-memory.mjs";

const MAX_BODY_BYTES = 5_000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
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
  if (typeof expected !== "string" || expected.length < 32) {
    return json({ error: "Pristup nije bezbedno konfigurisan.", code: "TOKEN_NOT_CONFIGURED" }, 503);
  }
  if (provided.length < 32 || provided !== expected) return json({ error: "Neispravan pristupni token." }, 401);
  const store = env?.AGENT_MEMORY_KV;
  if (!store || typeof store.get !== "function" || typeof store.put !== "function" || typeof store.list !== "function") {
    return json({
      error: "Trajna memorija nije aktivirana. Potreban je Cloudflare KV binding AGENT_MEMORY_KV.",
      code: "MEMORY_STORE_NOT_CONFIGURED",
      modelInvoked: false,
      externalActionsTaken: false,
      spendingAuthorized: false
    }, 503);
  }
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_BODY_BYTES) return json({ error: "Zahtev je prevelik." }, 413);
  let raw;
  try { raw = await request.text(); } catch { return json({ error: "Ne mogu da pročitam zahtev." }, 400); }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "Zahtev je prevelik." }, 413);
  let input;
  try { input = JSON.parse(raw); } catch { return json({ error: "Neispravan JSON." }, 400); }

  try {
    if (input?.action === "save") {
      const result = await saveMemory(store, input);
      if (!result.ok) return json({ error: "Podatak nije sačuvan.", code: result.code }, 400);
      return json({
        ok: true, action: result.audit.operation, record: result.record,
        audit: result.audit, verified: false, externalActionsTaken: false, spendingAuthorized: false
      }, 201);
    }
    if (input?.action === "list") {
      const result = await listMemory(store, typeof input.cursor === "string" ? input.cursor : undefined);
      return json({ ok: true, ...result, externalActionsTaken: false, spendingAuthorized: false });
    }
    if (input?.action === "audit") {
      const result = await listAudit(store, typeof input.cursor === "string" ? input.cursor : undefined);
      return json({
        ok: true, ...result, tamperEvident: false,
        note: "Evidencija je aplikacioni audit log; nije kriptografski neizmenjiva i KV može imati kašnjenje konzistentnosti.",
        externalActionsTaken: false, spendingAuthorized: false
      });
    }
    return json({ error: "Nepoznata akcija. Dozvoljeno: save, list, audit." }, 400);
  } catch {
    return json({ error: "Greška skladišta. Nema potvrde da je operacija sačuvana.", code: "MEMORY_STORE_ERROR" }, 503);
  }
}
