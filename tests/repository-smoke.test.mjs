import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('all existing HTML inline scripts parse without syntax errors', async () => {
  for (const file of ['index.html', 'opportunities.html', 'workbench.html', 'execution-lab.html', 'grants-diagnostic.html']) {
    const html = await source(file);
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(script => script.trim());
    assert.ok(scripts.length > 0, `${file} should contain inline JavaScript`);
    scripts.forEach((script, index) => {
      assert.doesNotThrow(() => new vm.Script(script, { filename: `${file} inline script ${index + 1}` }));
    });
  }
});

test('Opportunity Hunter keeps the known public-source integrations and deduplication', async () => {
  const html = await source('opportunities.html');
  for (const marker of [
    'https://remotive.com/api/remote-jobs',
    'https://www.arbeitnow.com/api/job-board-api',
    'api.tech.ec.europa.eu/search-api',
    "fetchJson('/api/grants'",
    'function addResults',
    'function normalizeUrl',
    'safe-automaton-opportunity-hunter-v1'
  ]) assert.ok(html.includes(marker), `Opportunity Hunter is missing expected marker: ${marker}`);
});

test('Opportunity Hunter explicitly forbids unapproved external actions and paid spend', async () => {
  const html = await source('opportunities.html');
  assert.match(html, /Ovlašćena potrošnja je 0 EUR/);
  assert.match(html, /Nema automatskih prijava/);
  assert.match(html, /lokalni Safe Automaton storage/);
  assert.match(html, /nema izmišljenih rezultata/i);
});

test('Task Workbench requires human approval and does not send offers itself', async () => {
  const html = await source('workbench.html');
  assert.match(html, /Potvrđujem — odobri za ručno slanje/);
  assert.match(html, /ne šalje ponude/);
  assert.match(html, /localStorage/);
  assert.match(html, /Nema automatskog prihvatanja ugovora/);
});

test('Execution Lab labels templates and QA as local/manual, not verified AI execution', async () => {
  const html = await source('execution-lab.html');
  assert.match(html, /nije povezana sa AI modelom/);
  assert.match(html, /Ove kućice nisu automatski dokazi/);
  assert.match(html, /ne pokreće proizvoljan kod/);
  assert.match(html, /safe-automaton-execution-lab-v1/);
});

test('Grants.gov endpoint validates method/input and does not log request body or secrets', async () => {
  const code = await source('functions/api/grants.js');
  assert.match(code, /method !== "POST"/);
  assert.match(code, /request\.json\(\)/);
  assert.match(code, /Math\.min\(50, Math\.max\(1, input\.rows\)\)/);
  assert.match(code, /Never log request bodies, API tokens/);
  assert.match(code, /"Cache-Control": "no-store"/);
  assert.match(code, /upstream_unexpected_payload/);
});

test('notification UI does not claim server push is already connected', async () => {
  const html = await source('index.html');
  const worker = await source('sw.js');
  assert.match(html, /server za udaljeni push još nije povezan/);
  assert.match(html, /udaljeni push još zahteva serversko povezivanje/);
  assert.match(worker, /addEventListener\('push'/);
  assert.match(worker, /addEventListener\('notificationclick'/);
});
