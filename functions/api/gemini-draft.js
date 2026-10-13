import { generateGeminiDraft } from "../_lib/gemini-key-pool.mjs";

const MAX_BODY_BYTES = 10_000;
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
  if (request.method !== "POST") return json({ ok: false, error: "Koristi POST." }, 405);
  if (!sameOrigin(request)) return json({ ok: false, error: "Cross-origin zahtev nije dozvoljen." }, 403);
  const expectedToken = env?.SAFE_AUTOMATON_GEMINI_TOKEN;
  const suppliedToken = request.headers.get("X-Safe-Automaton-Gemini-Token") || "";
  if (typeof expectedToken !== "string" || expectedToken.length < 32) {
    return json({ ok: false, code: "GEMINI_TOKEN_NOT_CONFIGURED", error: "Gemini pristup nije bezbedno konfigurisan." }, 503);
  }
  if (suppliedToken.length < 32 || suppliedToken !== expectedToken) {
    return json({ ok: false, code: "GEMINI_UNAUTHORIZED", error: "Nedostaje ili nije ispravan pristupni token." }, 401);
  }

  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_BODY_BYTES) return json({ ok: false, code: "REQUEST_TOO_LARGE", error: "Zahtev je prevelik." }, 413);
  let raw;
  try { raw = await request.text(); } catch { return json({ ok: false, code: "INVALID_BODY", error: "Ne mogu da pročitam zahtev." }, 400); }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ ok: false, code: "REQUEST_TOO_LARGE", error: "Zahtev je prevelik." }, 413);
  let input;
  try { input = JSON.parse(raw); } catch { return json({ ok: false, code: "INVALID_JSON", error: "Neispravan JSON." }, 400); }
  if (typeof input?.prompt !== "string") return json({ ok: false, code: "INVALID_PROMPT", error: "Prompt je obavezan." }, 400);

  const result = await generateGeminiDraft({ env, prompt: input.prompt });
  return result.response;
}
