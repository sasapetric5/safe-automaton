# Free AI Pool — setup and safety

This is an opt-in fallback router for the Execution Lab's three-agent draft flow. It does not publish, commit, message clients, execute arbitrary code, or make purchases.

## Billing safety

The router cannot independently verify a provider's billing settings. A model being open-weight or a key being valid does not prove that API calls are free. Before enabling a provider, verify that its account has a free allowance and cannot charge a payment method. If that cannot be guaranteed, do not enable it. The safest default is to leave all provider flags unset.

Cloudflare Workers AI uses the existing `AI` binding. Its free allocation and any account billing settings must be checked in Cloudflare before enabling it. The provider acknowledgement below is a safety gate, not a technical guarantee against charges.

## Common settings (Preview first)

Set these only in the intended Preview environment while testing:

- `SAFE_AUTOMATON_AI_ENABLED=true`
- `SAFE_AUTOMATON_FREE_POOL_ENABLED=true`
- `SAFE_AUTOMATON_AI_TOKEN`: encrypted secret of at least 32 characters; enter the same value in the Execution Lab request.
- `SAFE_AUTOMATON_AI_ORDER` is optional. Default order: `gemini_primary,gemini_secondary,gemini_tertiary,cloudflare,xai,openrouter,mistral,huggingface,deepseek`.

Each provider requires the exact acknowledgement value `YES_FREE_ONLY`. This does not verify the provider's billing state. Never enable an API provider until its free-only use has been checked.

## Provider configuration

| Provider | Secret / binding | Model variable | Required acknowledgement |
|---|---|---|---|
| Gemini API (three fallback model slots; one shared key/quota) | `GEMINI_API_KEY` | `SAFE_AUTOMATON_GEMINI_MODEL_PRIMARY`, `SAFE_AUTOMATON_GEMINI_MODEL_SECONDARY`, `SAFE_AUTOMATON_GEMINI_MODEL_TERTIARY` | `SAFE_AUTOMATON_GEMINI_FREE_ONLY=YES_FREE_ONLY` |
| Cloudflare Workers AI | existing `AI` binding | built-in `@cf/zai-org/glm-4.7-flash` | `SAFE_AUTOMATON_CLOUDFLARE_FREE_ONLY=YES_FREE_ONLY` |
| xAI / Grok | `XAI_API_KEY` | `SAFE_AUTOMATON_XAI_MODEL` | `SAFE_AUTOMATON_XAI_FREE_ONLY=YES_FREE_ONLY` |
| OpenRouter | `OPENROUTER_API_KEY` | `SAFE_AUTOMATON_OPENROUTER_MODEL` (must end in `:free`) | `SAFE_AUTOMATON_OPENROUTER_FREE_ONLY=YES_FREE_ONLY` |
| Mistral | `MISTRAL_API_KEY` | `SAFE_AUTOMATON_MISTRAL_MODEL` | `SAFE_AUTOMATON_MISTRAL_FREE_ONLY=YES_FREE_ONLY` |
| Hugging Face | `HF_TOKEN` | `SAFE_AUTOMATON_HUGGINGFACE_MODEL` | `SAFE_AUTOMATON_HUGGINGFACE_FREE_ONLY=YES_FREE_ONLY` |
| DeepSeek | `DEEPSEEK_API_KEY` | `SAFE_AUTOMATON_DEEPSEEK_MODEL` | `SAFE_AUTOMATON_DEEPSEEK_FREE_ONLY=YES_FREE_ONLY` |

Groq remains implemented as an optional provider for explicitly configured testing, but is not in the default order. It is not part of the intended seven-provider pool.

Use only model IDs confirmed available to your API account. Gemini's three slots reuse one API key and do not create extra quota. Store keys only as encrypted secrets; never place them in source code, commits, prompts, issues, or logs.

## Fallback behavior

- The router tries the next approved provider after quota/rate-limit errors, timeouts, outages, or empty responses.
- Only explicitly approved providers with required keys/models are considered.
- OpenRouter is accepted only when the model ID ends in `:free`.
- If all approved providers fail, the endpoint returns `ALL_FREE_PROVIDERS_FAILED`; it must not try a paid model.
- Each of the three agent steps may use a different provider. Response metadata may show provider/model IDs and safe failure categories, never API keys or raw upstream error bodies.
- Provider calls send task text to the selected provider. Do not send passwords, private keys, or sensitive client data.

## Limitations and required checks

- The router does not predict or reserve daily quotas and is not a quota dashboard.
- Free-tier approval flags do not independently enforce provider-side billing limits.
- There is no automatic paid fallback, publish/deploy, offer sending, or external client action.
- The owner token and explicit enable flags remain required.
- Run the focused tests and inspect the PR diff before merging or enabling providers.
