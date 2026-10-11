---
name: seo-audit
description: Review a website for technical SEO, indexability, metadata, content quality, structured data, internal linking, and AI-search discoverability. Use when asked to audit or diagnose a site.
---

# SEO Audit Skill

## Goal

Produce a prioritized, evidence-led SEO audit that separates confirmed findings from hypotheses and proposes testable fixes. This is an audit workflow, not a claim that changes were deployed or rankings will improve.

## Workflow

1. **Confirm scope.** Record target URL(s), language, country/market, device context if supplied, and the user’s objective. Do not assume access to Search Console, analytics, or server logs.
2. **Inspect accessible pages.** Use only permitted public URLs and available read-only tools. Record final URL after redirects when observable, HTTP status when observable, page title, meta description, canonical, robots directives, heading structure, internal links, image alt text, and visible content.
3. **Separate evidence from inference.** Every finding must include a URL and a concise evidence excerpt, observed value, or reproducible check. Label untested items “not checked” rather than “passed”.
4. **Check technical fundamentals.** Review status/redirects, indexability signals, canonical consistency, sitemap/robots availability, mobile layout signals, broken internal links, duplicate titles, missing metadata, structured-data validity when actual markup is available, and basic accessibility issues affecting content interpretation.
5. **Review content and intent.** Identify the apparent query intent, page-topic match, missing user questions, thin/duplicated content, unsupported claims, unclear expertise, and opportunities for useful first-hand detail. Do not invent search volumes, rankings, traffic, Core Web Vitals, or competitor metrics.
6. **Review AI-search readiness.** Recommend clear entity naming, concise factual answers, descriptive headings, attributable sources, consistent organization/product facts, and valid structured data where appropriate. Do not promise inclusion in AI answers or treat `llms.txt` as a ranking guarantee.
7. **Prioritize.** Score each issue by impact (1–5), confidence (1–5), and effort (1–5). Explain the score; do not imply it is a Google metric.
8. **Draft fixes.** Supply specific proposed text/code/metadata and a validation step for each high-priority issue. Do not edit or publish production unless explicitly authorized.

## Output format

- Scope and limitations
- Executive summary (confirmed facts only)
- Findings table: priority, URL, evidence, issue, impact, confidence, proposed fix, validation
- Quick wins (low effort, high confidence)
- Items needing Search Console, analytics, server access, or a real browser/device test
- Before/after acceptance checklist

## Zero-cost and safety constraints

Use public pages and already available tools only. No paid SEO APIs, subscriptions, unauthorized account access, or unapproved crawling volume. Respect site terms, robots directives, rate limits, and privacy. Do not report a test as successful unless it was actually run. A proposed fix is not a deployed fix.
