# Safe Automaton — portable skill library

These are instruction packs for a future agent runtime. They are **not yet wired into the current static UI as an autonomous executor**; they define reusable, reviewable procedures and output contracts.

## Source and attribution

The workflows are informed by the public repository [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills), an MIT-licensed collection of marketing skills for SEO, copywriting, and research. These Safe Automaton files are independently adapted for this project’s constraints rather than being a verbatim mirror. See [LICENSE-MARKETING-SKILLS](LICENSE-MARKETING-SKILLS).

## Available skills

- `seo-audit/SKILL.md` — evidence-led technical/on-page SEO review and prioritized fixes.
- `copywriting/SKILL.md` — conversion copy based on verified product facts and audience evidence.
- `customer-research/SKILL.md` — structured synthesis of public/authorized sources without inventing interviews or customer quotes.

## Safe Automaton execution rules

- Authorized spend: **0 EUR**. Do not call paid APIs, subscribe, create accounts, or use paid hosted services.
- No fabricated data, results, metrics, source quotes, customer interviews, or claims of successful execution.
- Preserve URLs and source attribution. Distinguish observed facts, hypotheses, and unknowns.
- Use only public or user-authorized sources and respect robots, rate limits, terms, access controls, and privacy.
- No CAPTCHA bypass, login bypass, paywall bypass, scraping of private data, or platform-rule circumvention.
- Do not publish, submit forms, send messages, contact customers, or modify production systems automatically.
- Generate drafts and recommended patches only. Any external or consequential action requires explicit user approval; where platform rules require manual action, the user performs it manually.

## Integration status

The files are version-controlled assets only. A runtime still needs to load a skill by name, pass relevant task context, provide permitted read-only research tools, and validate the output. Do not describe these skills as autonomous capabilities until that integration and its tests exist.
