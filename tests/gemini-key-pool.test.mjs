import test from "node:test";
import assert from "node:assert/strict";
import { generateGeminiDraft } from "../functions/_lib/gemini-key-pool.mjs";

const prompt = "Napravi kratak SEO nacrt.";
function mockGuard(result = { allowed: true, billingStatus: "free_verified", paidBudgetEur: 0, reservationId: "reservation-test" }) {
  return { fetch: async () => new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } }) };
}
function env(extra = {}) {
  return { SAFE_AUTOMATON_GEMINI_ENABLED: "true", GEMINI_API_KEY_1: "mock-key-abcdefghijklmnop", AI_BUDGET_GUARD: mockGuard(), ...extra };
}
function okResponse(text = "Mock draft") {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
}

test("disabled by default and budget guard absence never calls provider", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return okResponse(); };
  const disabled = await generateGeminiDraft({ env: {}, prompt, fetchImpl });
  assert.equal(disabled.response.status, 503);
  assert.equal(disabled.providerCalls, 0);
  const unknown = await generateGeminiDraft({ env: env({ AI_BUDGET_GUARD: undefined }), prompt, fetchImpl });
  assert.equal(unknown.response.status, 503);
  assert.equal((await unknown.response.json()).code, "BUDGET_GUARD_UNAVAILABLE");
  assert.equal(calls, 0);
});

test("paid, unverified or malformed guard status fails closed", async () => {
  let calls = 0;
  for (const status of [
    { allowed: true, billingStatus: "paid", paidBudgetEur: 0, reservationId: "r" },
    { allowed: true, billingStatus: "unknown", paidBudgetEur: 0, reservationId: "r" },
    { allowed: true, billingStatus: "free_verified", paidBudgetEur: 1, reservationId: "r" },
    { allowed: true, billingStatus: "free_verified", paidBudgetEur: 0 }
  ]) {
    const result = await generateGeminiDraft({ env: env({ AI_BUDGET_GUARD: mockGuard(status) }), prompt, fetchImpl: async () => { calls++; return okResponse(); } });
    assert.equal(result.response.status, 503);
    assert.equal(result.providerCalls, 0);
  }
  assert.equal(calls, 0);
});

test("successful mock response returns unverified draft and never exposes key", async () => {
  const secret = "mock-key-abcdefghijklmnop";
  let seenKey = "";
  const result = await generateGeminiDraft({
    env: env({ GEMINI_API_KEY_1: secret }),
    prompt,
    fetchImpl: async (_url, options) => { seenKey = options.headers["x-goog-api-key"]; return okResponse("Safe draft"); }
  });
  const data = await result.response.json();
  assert.equal(result.response.status, 200);
  assert.equal(data.draft, "Safe draft");
  assert.equal(data.verified, false);
  assert.equal(data.sent, false);
  assert.equal(seenKey, secret);
  assert.doesNotMatch(JSON.stringify(data), /mock-key/);
});

test("429 quota response stops immediately and does not rotate to another key", async () => {
  let calls = 0;
  const result = await generateGeminiDraft({
    env: env({ GEMINI_API_KEY_2: "mock-key-qrstuvwxyzabcdef" }),
    prompt,
    fetchImpl: async () => { calls++; return new Response("quota", { status: 429 }); }
  });
  const data = await result.response.json();
  assert.equal(result.response.status, 503);
  assert.equal(data.code, "GEMINI_QUOTA_OR_BILLING_STOP");
  assert.equal(calls, 1);
  assert.equal(result.providerCalls, 1);
});

test("only an authentication rejection may move to the next same-project key", async () => {
  let calls = 0;
  const result = await generateGeminiDraft({
    env: env({ GEMINI_API_KEY_2: "mock-key-qrstuvwxyzabcdef" }),
    prompt,
    fetchImpl: async () => ++calls === 1 ? new Response("unauthorized", { status: 401 }) : okResponse("Recovered draft")
  });
  const data = await result.response.json();
  assert.equal(result.response.status, 200);
  assert.equal(data.draft, "Recovered draft");
  assert.equal(calls, 2);
});

test("invalid prompt never invokes provider", async () => {
  let calls = 0;
  const result = await generateGeminiDraft({ env: env(), prompt: "x".repeat(8001), fetchImpl: async () => { calls++; return okResponse(); } });
  assert.equal(result.response.status, 400);
  assert.equal(calls, 0);
});
