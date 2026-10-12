import test from "node:test";
import assert from "node:assert/strict";
import { createSeoAuditHandler } from "../functions/api/seo-audit.js";

const target = "https://savremenikoreni.com/";
const html = '<!doctype html><html lang="sr"><head><title>Test stranica za SEO proveru</title><meta name="description" content="Opis test stranice za proveru SEO ugovora"><link rel="canonical" href="https://savremenikoreni.com/"></head><body><h1>Glavni naslov</h1><h2>Podnaslov</h2><img src="/a.jpg" alt="Opis slike"></body></html>';

function makeContext(url = target, fetchImpl = async () => new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }), wallNow = (() => { let n = 0; return () => new Date(Date.UTC(2026, 9, 12, 10, 0, n++)).toISOString(); })()) {
  const handler = createSeoAuditHandler({ fetchImpl, wallNow });
  return { request: new Request("https://safe-automaton.test/api/seo-audit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) }), handler };
}
async function invoke(url, fetchImpl, wallNow) {
  const { request, handler } = makeContext(url, fetchImpl, wallNow);
  const response = await handler({ request });
  return { response, data: await response.json() };
}

test("1. success response has strict contract, real metrics and SHA-256 of received bytes", async () => {
  const bytes = new TextEncoder().encode(html);
  const { response, data } = await invoke(target, async () => new Response(bytes, { status: 200, headers: { "content-type": "text/html" } }));
  assert.equal(response.status, 200);
  assert.equal(data.status, "success");
  assert.equal(data.target_url, target);
  assert.ok(Number.isFinite(Date.parse(data.audit_timestamp)));
  for (const key of ["fetch_duration_ms", "parse_duration_ms", "analysis_duration_ms", "audit_duration_ms"]) {
    assert.equal(typeof data.timing[key], "number", key);
    assert.ok(Number.isFinite(data.timing[key]) && data.timing[key] >= 0, key);
  }
  assert.equal(data.content_hash, "a".repeat(64) === data.content_hash ? "a".repeat(64) : data.content_hash);
  const expected = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2, "0")).join("");
  assert.equal(data.content_hash, expected);
  assert.equal(data.seo_metrics.title, "Test stranica za SEO proveru");
  assert.equal(data.seo_metrics.total_images, 1);
  assert.equal(data.seo_metrics.images_with_alt, 1);
  assert.ok(!("error_type" in data));
});

test("2. audit timestamp is generated anew per request", async () => {
  let n = 0;
  const clock = () => new Date(Date.UTC(2026, 9, 12, 10, 0, n++)).toISOString();
  const a = await invoke(target, undefined, clock);
  const b = await invoke(target, undefined, clock);
  assert.notEqual(a.data.audit_timestamp, b.data.audit_timestamp);
});

test("3. total duration is at least the sum of measured phases", async () => {
  const { data } = await invoke(target);
  const t = data.timing;
  assert.ok(t.audit_duration_ms >= t.fetch_duration_ms + t.parse_duration_ms + t.analysis_duration_ms);
});

test("4. temporary network/DNS failure returns retryable FETCH_FAILED", async () => {
  const { response, data } = await invoke(target, async () => { throw new TypeError("fetch failed: DNS lookup failed"); });
  assert.equal(response.status, 502);
  assert.equal(data.status, "error");
  assert.equal(data.error_type, "FETCH_FAILED");
  assert.equal(data.retryable, true);
  assert.equal(typeof data.timestamp, "string");
  assert.ok("http_status" in data.error_details && "target_url" in data.error_details && "fetch_duration_ms" in data.error_details && "audit_duration_ms" in data.error_details);
});

test("5. invalid URL is rejected before fetch and is not retryable", async () => {
  let called = false;
  const { response, data } = await invoke("http://localhost:8787/", async () => { called = true; return new Response(""); });
  assert.equal(response.status, 400);
  assert.equal(data.status, "error");
  assert.equal(data.error_type, "INVALID_RESPONSE");
  assert.equal(data.retryable, false);
  assert.equal(called, false);
});

test("6. HTTP 200 with empty body returns PARSE_ERROR, never success", async () => {
  const { response, data } = await invoke(target, async () => new Response("", { status: 200, headers: { "content-type": "text/html" } }));
  assert.equal(response.status, 500);
  assert.equal(data.status, "error");
  assert.equal(data.error_type, "PARSE_ERROR");
  assert.equal(data.error_details.http_status, 200);
  assert.equal(data.retryable, false);
});

test("7. upstream 404 is an error, not a false success", async () => {
  const { response, data } = await invoke(target, async () => new Response("Not found", { status: 404, headers: { "content-type": "text/html" } }));
  assert.equal(response.status, 404);
  assert.equal(data.status, "error");
  assert.equal(data.error_type, "INVALID_RESPONSE");
  assert.equal(data.error_details.http_status, 404);
  assert.equal(data.retryable, false);
});
