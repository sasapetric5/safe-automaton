# Free AI Pool — setup and safety

This is an opt-in fallback router for the Execution Lab's three-agent draft flow. It does not publish, commit, message clients, execute arbitrary code, or make purchases.

## Important billing limitation

The application can require explicit opt-in and restrict OpenRouter to model IDs ending in `:free`, but it cannot independently verify an upstream provider's account billing state. A provider API key can be billable even if the model itself is open-weight. Before enabling any external provider, verify in that provider's account that use will stop at the free limit and cannot charge a payment method. Do not enable a provider if that cannot be guaranteed. The safest default is to leave all external providers disabled. Cloudflare Workers AI is included only after explicit opt-in too; its free allocation is 10,000 Neurons/day, and usage above that can be billable on a paid Workers plan.

## Required common settings

Set these in the **development/Preview environment only** for the feature branch:

- `SAFE_AUTOMATON_AI_ENABLED=true`
- `SAFE_AUTOMATON_FREE_POOL_ENABLED=true`
- `SAFE_AUTOMATON_AI_TOKEN` as a secret of at least 32 characters; enter the same value in Execution Lab when running the agent.
- `SAFE_AUTOMATON_AI_ORDER=cloudflare,groq,cerebras,openrouter,huggingface,deepseek,xai` (optional; this is the default order)

Every provider requires an explicit acknowledgement flag with the exact value `YES_FREE_ONLY`. This is a safety gate, not a technical guarantee of upstream billing.

## Provider configuration

| Provider | Secret | Model variable | Required acknowledgement |
|---|---|---|---|
| Cloudflare Workers AI | existing `AI` binding | built-in `@cf/zai-org/glm-4.7-flash` | `SAFE_AUTOMATON_CLOUDFLARE_FREE_ONLY=YES_FREE_ONLY` |
| Groq | `GROQ_API_KEY` | `SAFE_AUTOMATON_GROQ_MODEL` | `SAFE_AUTOMATON_GROQ_FREE_ONLY=YES_FREE_ONLY` |
| Cerebras | `CEREBRAS_API_KEY` | `SAFE_AUTOMATON_CEREBRAS_MODEL` | `SAFE_AUTOMATON_CEREBRAS_FREE_ONLY=YES_FREE_ONLY` |
| OpenRouter | `OPENROUTER_API_KEY` | `SAFE_AUTOMATON_OPENROUTER_MODEL` (must end in `:free`) | `SAFE_AUTOMATON_OPENROUTER_FREE_ONLY=YES_FREE_ONLY` |
| Hugging Face | `HF_TOKEN` | `SAFE_AUTOMATON_HUGGINGFACE_MODEL` | `SAFE_AUTOMATON_HUGGINGFACE_FREE_ONLY=YES_FREE_ONLY` |
| DeepSeek | `DEEPSEEK_API_KEY` | `SAFE_AUTOMATON_DEEPSEEK_MODEL` | `SAFE_AUTOMATON_DEEPSEEK_FREE_ONLY=YES_FREE_ONLY` |
| xAI | `XAI_API_KEY` | `SAFE_AUTOMATON_XAI_MODEL` | `SAFE_AUTOMATON_XAI_FREE_ONLY=YES_FREE_ONLY` |

Only providers with both a model and key (where applicable) and the exact acknowledgement are considered. For OpenRouter, the model ID must end in `:free`. Never paste keys into code, issues, prompts, or logs. Store keys only as Cloudflare encrypted secrets; store non-secret flags and model IDs as environment variables.

## Fallback behavior

- The router uses the configured order and tries the next approved provider after a quota/rate-limit response, timeout, provider outage, or empty response.
- It also moves to the next provider after authentication/permission errors, but returns a safe category only; fix the configuration before relying on that provider.
- If all approved providers fail, it returns `ALL_FREE_PROVIDERS_FAILED`; no paid model is tried.
- Each of the three agent steps can use a different provider. Response metadata shows provider/model IDs and safe failure categories, never API keys or raw upstream error bodies.
- OpenRouter is accepted only with a `:free` model ID. The router cannot prove the actual account has no paid billing path.
- Provider calls send the task text to the selected external provider. Enable only providers whose data handling is acceptable for the information supplied. Do not send passwords, private keys, or sensitive client data.

## Current limitations

- This is a first implementation of provider fallback, not a guaranteed daily-quota dashboard. It does not predict or reserve provider quotas before each call.
- There is no automatic paid fallback, no automatic publish/deploy, and no external client action.
- The current Cloudflare endpoint still requires the owner token header and explicit enable flags.
- Run the focused tests and inspect the resulting branch diff before enabling it in any shared or production environment.
