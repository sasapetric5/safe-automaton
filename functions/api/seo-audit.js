const ALLOWED_HOSTS = new Set(["savremenikoreni.com", "www.savremenikoreni.com"]);
const MAX_HTML_BYTES = 1_000_000;
const TIMEOUT_MS = 10_000;

export async function onRequest(context) {
  const request = context.request;
  if (request.method !== "POST") return json({ error: "Koristi POST za SEO proveru." }, 405, { Allow: "POST" });

  const origin = request.headers.get("Origin");
  const appOrigin = new URL(request.url).origin;
  if (origin && origin !== appOrigin) return json({ error: "Cross-origin zahtev nije dozvoljen." }, 403);

  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 8192) return json({ error: "Zahtev je prevelik." }, 413);

  let input;
  try { input = await request.json(); }
  catch { return json({ error: "Neispravno JSON telo zahteva." }, 400); }

  let target;
  try { target = validateTarget(input?.url); }
  catch (error) { return json({ error: error.message }, 400); }

  try {
    const responseInfo = await fetchAllowedPage(target);
    const { response, finalUrl, redirectCount } = responseInfo;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      return json({
        error: "Izvor nije vratio HTML stranicu.",
        requestedUrl: target.href,
        finalUrl,
        httpStatus: response.status,
        contentType: contentType || "nije naveden",
        redirectCount
      }, 422);
    }

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_HTML_BYTES) {
      return json({ error: "HTML stranica je veća od dozvoljenog limita od 1 MB.", httpStatus: response.status }, 413);
    }

    let html;
    try { html = await readTextWithLimit(response, MAX_HTML_BYTES); }
    catch (error) {
      if (error instanceof Error && error.message.includes("limit od 1 MB")) {
        return json({ error: error.message, httpStatus: response.status }, 413);
      }
      throw error;
    }

    const audit = inspectHtml(html, finalUrl, response);
    return json({
      ok: true,
      engine: "safe-automaton-seo-evidence-v1",
      checkedAt: new Date().toISOString(),
      requestedUrl: target.href,
      finalUrl,
      redirectCount,
      httpStatus: response.status,
      contentType,
      htmlCharacters: html.length,
      findings: audit.findings,
      summary: {
        total: audit.findings.length,
        pass: audit.findings.filter(x => x.status === "PASS").length,
        warn: audit.findings.filter(x => x.status === "WARN").length,
        fail: audit.findings.filter(x => x.status === "FAIL").length,
        notChecked: audit.findings.filter(x => x.status === "NOT_CHECKED").length
      },
      limitations: [
        "Proverena je samo HTML odgovora; JavaScript-renderovani sadržaj nije izvršen.",
        "Ovo je tehnička početna provera, ne potvrda indeksiranja, rangiranja ili rezultata u Google-u.",
        "Provera je ograničena na savremenikoreni.com i www.savremenikoreni.com; nisu posećeni linkovi sa stranice.",
        "Nalazi koji zahtevaju vizuelnu, semantičku ili poslovnu procenu traže ljudsku proveru."
      ]
    }, 200);
  } catch (error) {
    return json({
      error: "SEO provera nije završena; rezultat se ne sme tumačiti kao uspešan audit.",
      detail: error instanceof Error ? error.message.slice(0, 220) : "Nepoznata greška"
    }, 502);
  }
}

function validateTarget(raw) {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("Unesi URL stranice.");
  if (raw.length > 1000) throw new Error("URL je predugačak.");
  let url;
  try { url = new URL(raw.trim()); } catch { throw new Error("URL nije validan."); }
  if (url.protocol !== "https:") throw new Error("Dozvoljen je samo HTTPS.");
  if (url.username || url.password) throw new Error("URL ne sme sadržati korisničko ime ili lozinku.");
  if (url.port && url.port !== "443") throw new Error("Nestandardni portovi nisu dozvoljeni.");
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Ova razvojna verzija proverava samo savremenikoreni.com i www.savremenikoreni.com.");
  }
  url.hash = "";
  return url;
}

async function fetchAllowedPage(initialUrl) {
  let url = new URL(initialUrl.href);
  for (let hop = 0; hop <= 3; hop++) {
    const response = await fetch(url.href, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "text/html,application/xhtml+xml;q=0.9", "User-Agent": "SafeAutomatonSeoEvidence/1.0" },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { response, finalUrl: url.href, redirectCount: hop };
      if (hop === 3) throw new Error("Previše preusmeravanja (limit 3).");
      const next = new URL(location, url);
      validateTarget(next.href);
      url = next;
      continue;
    }
    return { response, finalUrl: url.href, redirectCount: hop };
  }
  throw new Error("Preusmeravanje nije završeno.");
}

async function readTextWithLimit(response, maxBytes) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("HTML stranica je veća od dozvoljenog limita od 1 MB.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(concat(chunks, total));
}
function concat(chunks, total) {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}

function inspectHtml(html, finalUrl, response) {
  const titleTags = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)];
  const title = titleTags.length ? cleanText(titleTags[0][1]) : "";
  const descriptions = metaValues(html, "description");
  const canonicals = [...html.matchAll(/<link\b(?=[^>]*\brel\s*=\s*["'][^"']*canonical[^"']*["'])[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gi)].map(m => decode(m[2]));
  const robots = [...metaValues(html, "robots"), ...metaValues(html, "googlebot")].join(", ");
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)].map(m => cleanText(m[1])).filter(Boolean);
  const viewport = metaValues(html, "viewport");
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  const missingAlt = images.filter(tag => !/\balt\s*=\s*(["'])[^"']*\1/i.test(tag));
  const emptyAlt = images.filter(tag => /\balt\s*=\s*(["'])\s*\1/i.test(tag));
  const links = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gi)].map(m => decode(m[2]).trim());
  const internalLinks = links.filter(href => isInternal(href, finalUrl));
  const externalLinks = links.filter(href => /^https?:\/\//i.test(href) && !isInternal(href, finalUrl));
  const jsonLd = [...html.matchAll(/<script\b(?=[^>]*\btype\s*=\s*(["'])application\/ld\+json\1)[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(m => m[2].trim()).filter(Boolean);
  const invalidJsonLd = jsonLd.filter(text => { try { JSON.parse(text); return false; } catch { return true; } });
  const xRobots = response.headers.get("x-robots-tag") || "";
  const noindex = /\bnoindex\b/i.test(robots + " " + xRobots);
  const final = new URL(finalUrl);
  const findings = [];
  const add = (id, label, status, evidence, recommendation) => findings.push({ id, label, status, evidence, recommendation });

  add("http", "HTTP odgovor", response.status >= 200 && response.status < 300 ? "PASS" : "FAIL", "HTTP " + response.status, response.status >= 200 && response.status < 300 ? "Proveri i sadržaj stranice; HTTP 2xx sam po sebi ne potvrđuje SEO kvalitet." : "Istraži statusni kod i potvrdi da URL vraća očekivanu stranicu.");
  add("title", "HTML title", title ? (title.length >= 20 && title.length <= 70 ? "PASS" : "WARN") : "FAIL", title ? title.slice(0, 220) + " (dužina: " + title.length + ")" : "Nije pronađen <title> element.", title ? "Potvrdi da naslov jedinstveno i tačno opisuje sadržaj." : "Dodaj smislen title element.");
  add("description", "Meta description", descriptions.length === 0 ? "FAIL" : descriptions.length > 1 ? "WARN" : (descriptions[0].length >= 70 && descriptions[0].length <= 170 ? "PASS" : "WARN"), descriptions.length ? descriptions.map(x => x.slice(0, 220)).join(" | ") : "Meta description nije pronađen.", descriptions.length > 1 ? "Ukloni duplikate i zadrži jednu relevantnu meta description oznaku." : "Pregledaj da li opis tačno predstavlja stranicu; dužina je samo heuristika.");
  add("h1", "H1 naslov", h1s.length === 1 ? "PASS" : h1s.length === 0 ? "FAIL" : "WARN", h1s.length ? h1s.map(x => x.slice(0, 160)).join(" | ") + " (broj: " + h1s.length + ")" : "Nije pronađen H1.", "Proveri da glavni naslov jasno opisuje sadržaj; broj H1 nije sam po sebi rangirajuća garancija.");
  add("canonical", "Canonical URL", canonicals.length === 1 ? "PASS" : canonicals.length === 0 ? "WARN" : "FAIL", canonicals.length ? canonicals.join(" | ") : "Canonical nije pronađen.", "Proveri da canonical pokazuje na željenu kanonsku verziju i da nema konflikta sa preusmeravanjem.");
  add("robots", "Robots / indeksiranje", noindex ? "FAIL" : "PASS", "Meta robots: " + (robots || "nije navedeno") + "; X-Robots-Tag: " + (xRobots || "nije naveden"), noindex ? "Pronađena je noindex direktiva; potvrdi da je namerna pre uklanjanja." : "Ovo ne proverava robots.txt, Google pristup ili stvarni status indeksiranja.");
  add("viewport", "Viewport za mobilne uređaje", viewport.length ? "PASS" : "WARN", viewport.length ? viewport.join(" | ") : "Meta viewport nije pronađen.", "Proveri stvarni mobilni prikaz i pristupačnost u pregledaču.");
  add("images", "Alt tekst slika", missingAlt.length ? "WARN" : "PASS", "Ukupno img elemenata: " + images.length + "; bez alt atributa: " + missingAlt.length + "; prazan alt: " + emptyAlt.length, "Za informativne slike napiši opisni alt; prazan alt je prikladan za dekorativne slike.");
  add("internal-links", "Interni linkovi", internalLinks.length ? "PASS" : "WARN", "Pronađeno internih linkova: " + internalLinks.length, "Ovaj audit ne otvara linkove niti proverava da li vraćaju ispravan status.");
  add("external-links", "Spoljni linkovi", "NOT_CHECKED", "Pronađeno spoljašnjih HTTP(S) linkova: " + externalLinks.length + "; nisu posećeni.", "Ručno proveri relevantne odredišne linkove.");
  add("structured-data", "JSON-LD strukturirani podaci", !jsonLd.length ? "WARN" : invalidJsonLd.length ? "FAIL" : "PASS", "JSON-LD blokova: " + jsonLd.length + "; neispravan JSON blokova: " + invalidJsonLd.length, "Proveri semantičku ispravnost i Google smernice posebnim validatorom; validan JSON ne garantuje validnu šemu.");
  add("language", "Jezik HTML dokumenta", /<html\b[^>]*\blang\s*=\s*(["'])[^"']+\1/i.test(html) ? "PASS" : "WARN", (html.match(/<html\b[^>]*\blang\s*=\s*(["'])[^"']+\1/i) || [])[0] || "lang atribut nije pronađen.", "Proveri da lang atribut odgovara glavnom jeziku sadržaja.");
  add("canonical-host", "Canonical domen", canonicals.length === 1 ? (() => { try { return new URL(canonicals[0], finalUrl).hostname === final.hostname ? "PASS" : "WARN"; } catch { return "FAIL"; } })() : "NOT_CHECKED", canonicals.length === 1 ? canonicals[0] : "Nema tačno jednog canonical URL-a za poređenje.", "Proveri da canonical pokazuje na nameravani domen i protokol.");
  return { findings };
}

function metaValues(html, name) {
  const values = [];
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const n = tag.match(/\bname\s*=\s*(["'])(.*?)\1/i);
    if (!n || n[2].trim().toLowerCase() !== name.toLowerCase()) continue;
    const c = tag.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i);
    if (c) values.push(cleanText(c[2]));
  }
  return values;
}
function isInternal(href, base) {
  try { const u = new URL(href, base); return u.hostname.toLowerCase() === new URL(base).hostname.toLowerCase(); }
  catch { return false; }
}
function cleanText(value) { return decode(String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()); }
function decode(value) {
  return String(value).replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers }
  });
}
