/**
 * Safe Automaton Gemini key pool — deliberately fails closed.
 *
 * A pool of keys in one Google project shares that project's quota. Never
 * rotate on 429/RESOURCE_EXHAUSTED, 402, or billing/quota uncertainty.
 * Actual billing tier cannot be proven by an API key alone. A separately
 * configured durable budget guard is required before any provider request.
 */
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const MAX_PROMPT_CHARS = 8000;
const MAX_OUTPUT_TOKENS = 1024;

function safeJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

function getKeys(env) {
  return [env?.GEMINI_API_KEY_1, env?.GEMINI_API_KEY_2, env?.GEMINI_API_KEY_3]
    .filter((key) => typeof key === "string" && key.trim().length >= 20)
    .map((key) => key.trim());
}

async function requestBudgetPermit(guard, promptChars) {
  if (!guard || typeof guard.fetch !== "function") return null;
  try {
    const response = await guard.fetch("https://ai-budget-guard.invalid/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "gemini", maxOutputTokens: MAX_OUTPUT_TOKENS, promptChars, paidBudgetEur: 0 })
    });
    if (!response.ok) return null;
    const result = await response.json();
    // The guard must attest both the free tier and the atomic reservation.
    if (result?.allowed !== true || result?.billingStatus !== "free_verified" || result?.paidBudgetEur !== 0 || typeof result?.reservationId !== "string" || !result.reservationId) return null;
    return result;
  } catch {
    return null;
  }
}

export async function generateGeminiDraft({ env, prompt, fetchImpl = fetch }) {
  if (env?.SAFE_AUTOMATON_GEMINI_ENABLED !== "true") {
    return { response: safeJson({ ok: false, code: "GEMINI_DISABLED", error: "Gemini je isključen." }, 503), providerCalls: 0 };
  }
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > MAX_PROMPT_CHARS) {
    return { response: safeJson({ ok: false, code: "INVALID_PROMPT", error: "Prompt nedostaje ili prelazi dozvoljenu veličinu." }, 400), providerCalls: 0 };
  }

  // Do not call Google unless a durable, atomic guard can verify the free tier
  // and reserve quota. A boolean environment flag alone is not proof of billing.
  const permit = await requestBudgetPermit(env?.AI_BUDGET_GUARD, prompt.length);
  if (!permit) {
    return { response: safeJson({ ok: false, code: "BUDGET_GUARD_UNAVAILABLE", error: "AI je zaustavljen: besplatni status i budžet od 0 EUR nisu pouzdano proverljivi." }, 503), providerCalls: 0 };
  }

  const keys = getKeys(env);
  if (!keys.length) {
    return { response: safeJson({ ok: false, code: "GEMINI_KEYS_MISSING", error: "Gemini ključevi nisu bezbedno konfigurисани." }, 503), providerCalls: 0 };
  }

  // All keys are configured for one project. A 429/402 or quota/billing
  // uncertainty stops immediately; it must never trigger key rotation.
  for (let i = 0; i < keys.length; i++) {
    let response;
    try {
      response = await fetchImpl(GEMINI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": keys[i] },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt.trim() }] }],
          generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.2 }
        })
      });
    } catch {
      return { response: safeJson({ ok: false, code: "GEMINI_NETWORK_ERROR", error: "Gemini nije dostupan; zahtev je zaustavljen." }, 502), providerCalls: 1 };
    }

    if (response.status === 429 || response.status === 402) {
      return { response: safeJson({ ok: false, code: "GEMINI_QUOTA_OR_BILLING_STOP", error: "Gemini kvota ili status naplate nisu bezbedni; nema rotacije ključa." }, 503), providerCalls: 1 };
    }
    if (response.status === 401 && i < keys.length - 1) continue;
    if (!response.ok) {
      return { response: safeJson({ ok: false, code: "GEMINI_PROVIDER_STOP", error: "Gemini zahtev nije uspeo; bez automatskog plaćenog fallback-a." }, 502), providerCalls: 1 };
    }

    try {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("").trim();
      if (!text) return { response: safeJson({ ok: false, code: "GEMINI_EMPTY_OUTPUT", error: "Gemini je vratio prazan nacrt." }, 502), providerCalls: 1 };
      return { response: safeJson({ ok: true, status: "DRAFT_REQUIRES_HUMAN_REVIEW", draft: text, verified: false, sent: false, externalActionsTaken: false }), providerCalls: 1 };
    } catch {
      return { response: safeJson({ ok: false, code: "GEMINI_INVALID_RESPONSE", error: "Gemini odgovor nije moguće bezbedno obraditi." }, 502), providerCalls: 1 };
    }
  }
  return { response: safeJson({ ok: false, code: "GEMINI_KEYS_REJECTED", error: "Nijedan konfigurisani ključ nije prihvaćen." }, 503), providerCalls: keys.length };
}
