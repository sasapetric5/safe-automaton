# Free AI Pool — safe setup

Target branch: `integration/main-consolidation`

The application can route the three sequential agent steps through Cloudflare Workers AI first, then try other explicitly approved providers when a provider times out, returns an error, or has no usable output. Provider routing is a fallback mechanism, not a guarantee that any provider is free or available.

## Required Cloudflare Pages configuration

Use the same environment (Preview or Production) as the URL being tested.

### Binding
- Workers AI binding name: `AI`

### Secrets
- `SAFE_AUTOMATON_AI_TOKEN` — owner-side request token, at least 32 characters.
- Add each provider API key as a Cloudflare Pages secret, never in GitHub source, HTML, localStorage, logs, or a prompt.

### Non-secret environment variables
- `SAFE_AUTOMATON_AI_ENABLED=true`
- `SAFE_AUTOMATON_FREE_POOL_ENABLED=true`
- `SAFE_AUTOMATON_CLOUDFLARE_FREE_ONLY=YES_FREE_ONLY`
- `SAFE_AUTOMATON_AI_ORDER=cloudflare,gemini_primary,gemini_secondary,gemini_tertiary,groq,mistral,openrouter,huggingface,deepseek,xai`

The order above makes Cloudflare the first choice. The Gemini primary/secondary/tertiary slots use separate secrets: `GEMINI_API_KEY_PRIMARY`, `GEMINI_API_KEY_SECONDARY`, and `GEMINI_API_KEY_TERTIARY`, alongside their respective model variables.

## External provider configuration

For every provider, add the API key as a **secret** and the model / approval values as ordinary environment variables. Set an approval flag to `YES_FREE_ONLY` only after confirming that the exact model, account, region, and current quota cannot incur charges. The flag is an owner attestation; it cannot override a provider's billing terms.

| Provider | Secret name | Free-only approval variable | Model variable |
|---|---|---|---|
| Gemini | `GEMINI_API_KEY_PRIMARY`, `GEMINI_API_KEY_SECONDARY`, `GEMINI_API_KEY_TERTIARY` | `SAFE_AUTOMATON_GEMINI_FREE_ONLY` | `SAFE_AUTOMATON_GEMINI_MODEL_PRIMARY`, `SAFE_AUTOMATON_GEMINI_MODEL_SECONDARY`, `SAFE_AUTOMATON_GEMINI_MODEL_TERTIARY` |
| Groq | `GROQ_API_KEY` | `SAFE_AUTOMATON_GROQ_FREE_ONLY` | `SAFE_AUTOMATON_GROQ_MODEL` |
| Mistral | `MISTRAL_API_KEY` | `SAFE_AUTOMATON_MISTRAL_FREE_ONLY` | `SAFE_AUTOMATON_MISTRAL_MODEL` |
| OpenRouter | `OPENROUTER_API_KEY` | `SAFE_AUTOMATON_OPENROUTER_FREE_ONLY` | `SAFE_AUTOMATON_OPENROUTER_MODEL` — must end with `:free` |
| Hugging Face | `HF_TOKEN` | `SAFE_AUTOMATON_HUGGINGFACE_FREE_ONLY` | `SAFE_AUTOMATON_HUGGINGFACE_MODEL` |
| DeepSeek | `DEEPSEEK_API_KEY` | `SAFE_AUTOMATON_DEEPSEEK_FREE_ONLY` | `SAFE_AUTOMATON_DEEPSEEK_MODEL` |
| xAI | `XAI_API_KEY` | `SAFE_AUTOMATON_XAI_FREE_ONLY` | `SAFE_AUTOMATON_XAI_MODEL` |

Do not enable an external provider merely because an API key was issued. First confirm that its selected model and usage tier are free for this account. If uncertain, leave its approval variable unset; the router will skip it.

## Runtime behavior and safety
- The pool is disabled unless `SAFE_AUTOMATON_FREE_POOL_ENABLED=true`.
- The Cloudflare provider is skipped unless its AI binding exists and `SAFE_AUTOMATON_CLOUDFLARE_FREE_ONLY=YES_FREE_ONLY`.
- Other providers are skipped unless their key, model, and `*_FREE_ONLY=YES_FREE_ONLY` approval are present.
- Provider keys are never returned in API responses. Diagnostics should report provider IDs and error categories only.
- The router has bounded execution time and per-provider timeouts; it does not retry forever.
- A report is marked structurally complete only when the Reviewer emits the required final line `IZVEŠTAJ ZAVRŠEN`. This is a completeness check, not proof that the report's facts are true.
- AI output remains an unverified draft. No offers, messages, applications, publishing, purchases, payments, or other external actions are sent.
- Never paste actual API keys into GitHub files or this chat. Enter them only in the relevant Cloudflare Pages environment's secret fields.
