import { runSandboxCheck } from "../_lib/sandbox.mjs";

const MAX_BODY_BYTES = 22_000;
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" }
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
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_BODY_BYTES) return json({ error: "Zahtev je prevelik." }, 413);
  let raw;
  try { raw = await request.text(); } catch { return json({ error: "Ne mogu da pročitam zahtev." }, 400); }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "Zahtev je prevelik." }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "Neispravan JSON." }, 400); }
  const result = runSandboxCheck(body?.operation, body?.input);
  return json({
    ...result,
    executionEnabled: false,
    networkEnabled: false,
    fileAccessEnabled: false,
    externalActionsTaken: false,
    spendingAuthorized: false
  }, result.code === "OPERATION_NOT_ALLOWLISTED" || result.code === "INVALID_INPUT_SIZE" ? 400 : 200);
}
