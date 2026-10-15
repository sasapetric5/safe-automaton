import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/ai-pool.js";

const TOKEN = "t".repeat(40);
const body = { taskType: "qa", title: "QA", brief: "Napravi proverljiv plan.", evidence: "Nema dodatnih dokaza." };
function request(payload = body, options = {}) {
  const headers = new Headers({ "Content-Type": "application/json", ...(options.headers || {}) });
  if (options.token !== false) headers.set("X-Safe-Automaton-AI-Token", typeof options.token === "string" ? options.token : TOKEN);
  return new Request("https://safe-automaton.example/api/ai-pool", {
    method: options.method || "POST", headers,
    body: options.method === "GET" ? undefined : JSON.stringify(payload)
  });
}
async function call(req, env = {}) {
  const response = await onRequest({ request: req, env });
  return { response, data: await response.json() };
}
function baseEnv(extra = {}) {
  return {
    SAFE_AUTOMATON_AI_ENABLED: "true",
    SAFE_AUTOMATON_AI_TOKEN: TOKEN,
    SAFE_AUTOMATON_FREE_POOL_ENABLED: "true",
    SAFE_AUTOMATON_CLOUDFLARE_FREE_ONLY: "YES_FREE_ONLY",
    AI: { run: async () => ({ response: "Nacrt za ljudski pregled." }) },
    ...extra
  };
}

test("Free AI Pool is opt-in, requires a valid owner token, and rejects invalid requests", async () => {
  assert.equal((await call(request(), {})).response.status, 503);
  assert.equal((await call(request(), baseEnv({ SAFE_AUTOMATON_FREE_POOL_ENABLED: "false" }))).data.diagnosticCode, "FREE_POOL_DISABLED");
  assert.equal((await call(request(), baseEnv())).response.status, 200);
  assert.equal((await call(request(body, { token: "" }), baseEnv())).response.status, 401);
  assert.equal((await call(request(body, { headers: { Origin: "https://evil.example" } }), baseEnv())).response.status, 403);
  assert.equal((await call(request({ ...body, taskType: "shell" }), baseEnv())).response.status, 400);
});

test("Reviewer prompt requires a bounded complete report and prevents unsupported SEO conclusions", async () => {
  const calls = [];
  const env = baseEnv({ AI: { run: async (model, input) => { calls.push(input); return { response: "Nacrt za ljudski pregled." }; } } });
  const { response, data } = await call(request({ ...body, taskType: "seo", sourceUrl: "https://savremenikoreni.com", evidence: "Početni HTML: 174278 bajtova; H1 nije pronađen; JavaScript nije izvršen; robots meta index, follow." }), env);
  assert.equal(response.status, 200);
  assert.equal(calls.length, 3);
  const reviewerSystem = calls[2].messages[0].content;
  assert.match(reviewerSystem, /najviše 250 reči/i);
  assert.match(reviewerSystem, /renderovani DOM/i);
  assert.match(reviewerSystem, /robots=index,follow nije problem samo po sebi/i);
  assert.match(reviewerSystem, /IZVEŠTAJ ZAVRŠEN/);
  assert.match(data.finalDraft, /URL prosleđen agentima/);
  assert.equal(data.verified, false);
});

test("Free AI Pool uses the approved Cloudflare provider for all three sequential agents", async () => {
  const calls = [];
  const env = baseEnv({ AI: { run: async (model, input) => { calls.push({ model, input }); return { response: "Rezultat " + calls.length }; } } });
  const { response, data } = await call(request({ sourceUrl: "https://savremenikoreni.com" }), env);
  assert.equal(response.status, 200);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(call => call.input.messages[1].content.includes("https://savremenikoreni.com")));
  assert.ok(calls.every(call => call.input.messages[1].content.includes("URL nije isto što i dokaz SEO provere")));
  assert.ok(calls.every(c => c.model === "@cf/zai-org/glm-4.7-flash"));
  assert.equal(data.engine, "free-ai-pool");
  assert.equal(data.agents.length, 3);
  assert.equal(data.verified, false);
  assert.equal(data.sent, false);
  assert.equal(data.externalActionsTaken, false);
  assert.equal(data.finalDraft, "Rezultat 3");
});

test("fallback moves to an explicitly approved provider after Cloudflare quota failure without logging secrets", async () => {
  const originalFetch = globalThis.fetch;
  let externalCalls = 0;
  globalThis.fetch = async (url, options) => {
    externalCalls++;
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    assert.match(options.headers.Authorization, /^Bearer /);
    return new Response(JSON.stringify({ choices: [{ message: { content: "Groq draft " + externalCalls } }] }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  };
  try {
    const env = baseEnv({
      SAFE_AUTOMATON_AI_ORDER: "cloudflare,groq",
      SAFE_AUTOMATON_GROQ_FREE_ONLY: "YES_FREE_ONLY",
      SAFE_AUTOMATON_GROQ_MODEL: "openai/gpt-oss-20b",
      GROQ_API_KEY: "secret-test-key",
      AI: { run: async () => { const error = new Error("quota"); error.status = 429; throw error; } }
    });
    const { response, data } = await call(request(), env);
    assert.equal(response.status, 200);
    assert.equal(externalCalls, 3);
    assert.ok(data.agents.every(a => a.provider === "groq"));
    assert.ok(data.providerAttempts.some(a => a.status === "quota_or_rate_limit"));
    assert.doesNotMatch(JSON.stringify(data), /secret-test-key/);
  } finally { globalThis.fetch = originalFetch; }
});

test("unapproved providers are skipped and OpenRouter rejects models not explicitly marked :free", async () => {
  const env = baseEnv({
    SAFE_AUTOMATON_AI_ORDER: "groq,openrouter",
    SAFE_AUTOMATON_GROQ_MODEL: "openai/gpt-oss-20b",
    GROQ_API_KEY: "secret-groq",
    SAFE_AUTOMATON_GROQ_FREE_ONLY: "NO",
    SAFE_AUTOMATON_OPENROUTER_FREE_ONLY: "YES_FREE_ONLY",
    SAFE_AUTOMATON_OPENROUTER_MODEL: "provider/model",
    OPENROUTER_API_KEY: "secret-openrouter"
  });
  const { response, data } = await call(request(), env);
  assert.equal(response.status, 503);
  assert.equal(data.diagnosticCode, "NO_APPROVED_FREE_PROVIDER");
  assert.doesNotMatch(JSON.stringify(data), /secret-/);
});

test("when every provider fails, endpoint reports safe status and does not claim success", async () => {
  const env = baseEnv({
    SAFE_AUTOMATON_AI_ORDER: "cloudflare",
    AI: { run: async () => { const error = new Error("internal secret"); error.status = 429; throw error; } }
  });
  const { response, data } = await call(request(), env);
  assert.equal(response.status, 502);
  assert.equal(data.diagnosticCode, "ALL_FREE_PROVIDERS_FAILED");
  assert.equal(data.verified, false);
  assert.equal(data.sent, false);
  assert.doesNotMatch(JSON.stringify(data), /internal secret/);
});


test("Gemini model slots fall back in order before moving to another provider", async () => {
  const originalFetch = globalThis.fetch;
  const seenModels = [];
  globalThis.fetch = async (url, options) => {
    const payload = JSON.parse(options.body);
    seenModels.push(payload.model);
    if (payload.model === "gemini-3.8-flash") {
      return new Response(JSON.stringify({ error: { message: "quota", code: 429 } }), { status: 429, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: "Fallback model draft" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const env = baseEnv({
      SAFE_AUTOMATON_AI_ORDER: "gemini_primary,gemini_secondary",
      SAFE_AUTOMATON_GEMINI_FREE_ONLY: "YES_FREE_ONLY",
      SAFE_AUTOMATON_GEMINI_MODEL_PRIMARY: "gemini-3.8-flash",
      SAFE_AUTOMATON_GEMINI_MODEL_SECONDARY: "gemini-3.6-flash",
      GEMINI_API_KEY: "secret-gemini"
    });
    const { response, data } = await call(request(), env);
    assert.equal(response.status, 200);
    assert.deepEqual(seenModels, [
      "gemini-3.8-flash", "gemini-3.6-flash",
      "gemini-3.8-flash", "gemini-3.6-flash",
      "gemini-3.8-flash", "gemini-3.6-flash"
    ]);
    assert.ok(data.agents.every(a => a.provider === "gemini_secondary" && a.model === "gemini-3.6-flash"));
    assert.doesNotMatch(JSON.stringify(data), /secret-gemini/);
  } finally { globalThis.fetch = originalFetch; }
});


test("method, malformed JSON, and oversized bodies are rejected before invoking any model", async () => {
  let modelCalls = 0;
  const env = baseEnv({ AI: { run: async () => { modelCalls++; return { response: "should not run" }; } } });

  const getResponse = await onRequest({ request: request(body, { method: "GET" }), env });
  assert.equal(getResponse.status, 405);
  assert.equal(getResponse.headers.get("Allow"), "POST");

  const malformed = new Request("https://safe-automaton.example/api/ai-pool", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Safe-Automaton-AI-Token": TOKEN },
    body: "{not-json"
  });
  const malformedResult = await call(malformed, env);
  assert.equal(malformedResult.response.status, 400);

  const oversized = new Request("https://safe-automaton.example/api/ai-pool", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Safe-Automaton-AI-Token": TOKEN },
    body: JSON.stringify({ ...body, brief: "x".repeat(13_000) })
  });
  const oversizedResult = await call(oversized, env);
  assert.equal(oversizedResult.response.status, 413);
  assert.equal(modelCalls, 0);
});

test("AI disabled fails closed without invoking the model", async () => {
  let modelCalls = 0;
  const env = baseEnv({
    SAFE_AUTOMATON_AI_ENABLED: "false",
    AI: { run: async () => { modelCalls++; return { response: "should not run" }; } }
  });
  const { response, data } = await call(request(), env);
  assert.equal(response.status, 503);
  assert.equal(data.diagnosticCode, "AI_ENABLE_FLAG_NOT_TRUE");
  assert.equal(data.modelInvoked, false);
  assert.equal(modelCalls, 0);
});

test("AI enable flag accepts harmless case and whitespace normalization", async () => {
  let modelCalls = 0;
  const env = baseEnv({
    SAFE_AUTOMATON_AI_ENABLED: " TRUE ",
    AI: { run: async () => { modelCalls++; return { response: "normalized flag draft" }; } }
  });
  const { response, data } = await call(request(), env);
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(modelCalls, 3);
});

test("AI enable flag diagnostics do not expose its value and fail closed for invalid values", async () => {
  let modelCalls = 0;
  const env = baseEnv({
    SAFE_AUTOMATON_AI_ENABLED: "yes",
    AI: { run: async () => { modelCalls++; return { response: "should not run" }; } }
  });
  const { response, data } = await call(request(), env);
  assert.equal(response.status, 503);
  assert.equal(data.diagnosticCode, "AI_ENABLE_FLAG_NOT_TRUE");
  assert.equal(data.observedEnableFlag, "string_other");
  assert.equal(data.modelInvoked, false);
  assert.doesNotMatch(JSON.stringify(data), /"yes"/);
  assert.equal(modelCalls, 0);
});

