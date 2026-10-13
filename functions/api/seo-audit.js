const ALLOWED_HOSTS = new Set(["savremenikoreni.com", "www.savremenikoreni.com"]);
const MAX_HTML_BYTES = 1_000_000;
const TIMEOUT_MS = 10_000;

export async function onRequest(context) {
  return createSeoAuditHandler()(context);
}

// Dependency injection keeps tests deterministic without opening a public test route.
export function createSeoAuditHandler(deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const monotonicNow = deps.monotonicNow || (() => performance.now());
  const wallNow = deps.wallNow || (() => new Date().toISOString());
  return async function handle(context) {
    const started = monotonicNow();
    const request = context.request;
    const requestUrl = new URL(request.url);
    let targetUrl = null;
    let fetchDuration = null;
    let parseDuration = null;
    let analysisDuration = null;
    let upstreamStatus = null;
    const errorResponse = (status, type, message, retryable, extra = {}) => json({
      status: "error",
      error_type: type,
      error_message: message,
      error_details: {
        http_status: upstreamStatus,
        target_url: targetUrl?.href || null,
        fetch_duration_ms: fetchDuration,
        audit_duration_ms: duration(monotonicNow() - started),
        ...extra
      },
      retryable,
      timestamp: wallNow()
    }, status);

    if (request.method !== "POST") return json({ status: "error", error_type: "INVALID_RESPONSE", error_message: "Koristi POST za SEO proveru.", error_details: { http_status: null, target_url: null, fetch_duration_ms: null, audit_duration_ms: duration(monotonicNow() - started) }, retryable: false, timestamp: wallNow() }, 405, { Allow: "POST" });
    const origin = request.headers.get("Origin");
    if (origin && origin !== requestUrl.origin) return errorResponse(403, "INVALID_RESPONSE", "Cross-origin zahtev nije dozvoljen.", false);
    if (Number(request.headers.get("Content-Length") || 0) > 8192) return errorResponse(413, "INVALID_RESPONSE", "Zahtev je prevelik.", false);

    let input;
    try { input = await request.json(); }
    catch { return errorResponse(400, "INVALID_RESPONSE", "Neispravno JSON telo zahteva.", false); }
    try { targetUrl = validateTarget(input?.url); }
    catch (error) { return errorResponse(400, "INVALID_RESPONSE", error.message, false); }

    let response, finalUrl, redirectCount;
    const fetchStarted = monotonicNow();
    try {
      ({ response, finalUrl, redirectCount } = await fetchAllowedPage(targetUrl, fetchImpl));
      upstreamStatus = response.status;
      if (response.status === 404) {
        fetchDuration = duration(monotonicNow() - fetchStarted);
        return errorResponse(404, "INVALID_RESPONSE", "Ciljna stranica je vratila HTTP 404.", false, { final_url: finalUrl, redirect_count: redirectCount });
      }
      if (response.status >= 500) {
        fetchDuration = duration(monotonicNow() - fetchStarted);
        return errorResponse(502, "FETCH_FAILED", "Ciljni server je vratio HTTP " + response.status + ".", true, { final_url: finalUrl, redirect_count: redirectCount });
      }
      if (!response.ok) {
        fetchDuration = duration(monotonicNow() - fetchStarted);
        return errorResponse(502, "FETCH_FAILED", "Ciljna stranica je vratila HTTP " + response.status + ".", response.status === 429, { final_url: finalUrl, redirect_count: redirectCount });
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("text/html")) {
        fetchDuration = duration(monotonicNow() - fetchStarted);
        return errorResponse(502, "INVALID_RESPONSE", "Izvor nije vratio HTML stranicu.", false, { final_url: finalUrl, content_type: contentType });
      }
      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > MAX_HTML_BYTES) {
        fetchDuration = duration(monotonicNow() - fetchStarted);
        return errorResponse(413, "INVALID_RESPONSE", "HTML stranica prelazi limit od 1 MB.", false);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      fetchDuration = duration(monotonicNow() - fetchStarted);
      if (bytes.byteLength > MAX_HTML_BYTES) return errorResponse(413, "INVALID_RESPONSE", "HTML stranica prelazi limit od 1 MB.", false);
      if (!bytes.byteLength) return errorResponse(500, "PARSE_ERROR", "Cilj je vratio prazan HTML odgovor.", false);
      const parseStarted = monotonicNow();
      const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const parseEnded = monotonicNow();
      parseDuration = duration(parseEnded - parseStarted);
      if (!html.trim()) return errorResponse(500, "PARSE_ERROR", "HTML sadržaj je prazan nakon dekodiranja.", false);
      let metrics;
      const analysisStarted = monotonicNow();
      try { metrics = extractMetrics(html, finalUrl, response.status); }
      catch (error) { return errorResponse(500, "ANALYSIS_ERROR", "Analiza HTML-a nije uspela.", false, { reason: safeMessage(error) }); }
      const analysisEnded = monotonicNow();
      analysisDuration = duration(analysisEnded - analysisStarted);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const contentHash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
      const sum = fetchDuration + parseDuration + analysisDuration;
      const total = duration(monotonicNow() - started);
      return json({
        status: "success",
        target_url: targetUrl.href,
        final_url: finalUrl,
        audit_timestamp: wallNow(),
        timing: {
          fetch_duration_ms: fetchDuration,
          parse_duration_ms: parseDuration,
          analysis_duration_ms: analysisDuration,
          audit_duration_ms: Math.max(total, sum)
        },
        seo_metrics: metrics,
        content_hash: contentHash,
        redirect_count: redirectCount,
        audit_scope: { evidence_source: "initial_html", javascript_executed: false, rendered_dom_checked: false, linked_pages_crawled: false }
      }, 200);
    } catch (error) {
      fetchDuration = fetchDuration ?? duration(monotonicNow() - fetchStarted);
      const message = safeMessage(error);
      const timedOut = /timeout|aborted/i.test(message) || error?.name === "TimeoutError" || error?.name === "AbortError";
      const network = /fetch failed|network|dns|enotfound|econnrefused|ssl|certificate/i.test(message) || error instanceof TypeError;
      return errorResponse(timedOut ? 504 : 502, timedOut ? "TIMEOUT" : "FETCH_FAILED", timedOut ? "Vreme za preuzimanje stranice je isteklo." : "Nije moguće preuzeti ciljnu stranicu.", timedOut || network, { reason: message.slice(0, 180) });
    }
  };
}

function validateTarget(raw) {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("URL mora biti neprazan tekst.");
  if (raw.length > 1000) throw new Error("URL je predugačak.");
  let url;
  try { url = new URL(raw.trim()); } catch { throw new Error("URL format nije validan."); }
  if (url.protocol !== "https:") throw new Error("Dozvoljen je samo HTTPS.");
  if (url.username || url.password) throw new Error("URL ne sme sadržati korisničko ime ili lozinku.");
  if (url.port && url.port !== "443") throw new Error("Nestandardni portovi nisu dozvoljeni.");
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) throw new Error("Domen nije na dozvoljenoj listi.");
  url.hash = "";
  return url;
}

async function fetchAllowedPage(initialUrl, fetchImpl) {
  let url = new URL(initialUrl.href);
  for (let hop = 0; hop <= 3; hop++) {
    const response = await fetchImpl(url.href, {
      method: "GET", redirect: "manual",
      headers: { Accept: "text/html,application/xhtml+xml;q=0.9", "User-Agent": "SafeAutomatonSeoEvidence/2.0" },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { response, finalUrl: url.href, redirectCount: hop };
      if (hop === 3) throw new Error("Previše preusmeravanja.");
      const next = new URL(location, url);
      validateTarget(next.href);
      url = next;
      continue;
    }
    return { response, finalUrl: url.href, redirectCount: hop };
  }
  throw new Error("Preusmeravanje nije završeno.");
}

function extractMetrics(html, finalUrl, httpStatus) {
  const title = cleanText((html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i) || [])[1] || "");
  const descriptions = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]).filter(t => /\bname\s*=\s*["']description["']/i.test(t)).map(t => (t.match(/\bcontent\s*=\s*(["'])(.*?)\1/i) || [])[2] || "");
  const h1Tags = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)].map(m => cleanText(m[1])).filter(Boolean);
  const h2Count = [...html.matchAll(/<h2\b/gi)].length;
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  const imagesWithAlt = images.filter(t => /\balt\s*=\s*(["']).*?\1/i.test(t)).length;
  const canon = (html.match(/<link\b[^>]*\brel\s*=\s*["'][^"']*canonical[^"']*["'][^>]*>/i) || [])[0] || "";
  const canonicalUrl = (canon.match(/\bhref\s*=\s*(["'])(.*?)\1/i) || [])[2] || null;
  const robotsTag = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]).find(t => /\bname\s*=\s*["']robots["']/i.test(t));
  const robotsMeta = robotsTag ? ((robotsTag.match(/\bcontent\s*=\s*(["'])(.*?)\1/i) || [])[2] || null) : null;
  const metrics = { http_status: httpStatus, title, title_length: title.length, meta_description: descriptions[0] || null, meta_description_count: descriptions.length, h1_tags: h1Tags, h2_count: h2Count, total_images: images.length, images_with_alt: imagesWithAlt, images_missing_alt: images.length - imagesWithAlt, canonical_url: canonicalUrl ? new URL(canonicalUrl, finalUrl).href : null, robots_meta: robotsMeta, html_characters: html.length };
  if (!Object.values(metrics).some(v => v !== null && v !== "" && !(Array.isArray(v) && !v.length))) throw new Error("Nema izdvojivih SEO metrika.");
  return metrics;
}
function cleanText(value) { return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;|&apos;/gi, "'"); }
function duration(ms) { return Math.max(0, Math.ceil(ms)); }
function safeMessage(error) { return error instanceof Error ? error.message : String(error || "Nepoznata greška"); }
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
}
