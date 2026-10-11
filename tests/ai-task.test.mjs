import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const endpointSource = await readFile(path.join(root, 'functions/api/ai-task.js'), 'utf8');
const endpointUrl = 'data:text/javascript;base64,' + Buffer.from(endpointSource).toString('base64');
const { onRequest } = await import(endpointUrl);

function request(body, options = {}) {
  return new Request('https://safe-automaton.example/api/ai-task', {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.origin ? { Origin: options.origin } : {}),
      'X-Safe-Automaton-AI-Token': options.token ?? TEST_TOKEN,
      ...(options.headers || {})
    },
    body: options.method === 'GET' ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
  });
}
const TEST_TOKEN = 'a'.repeat(40);
const valid = { taskType: 'seo', title: 'SEO provera', brief: 'Proveri dostavljene nalaze', evidence: 'Naslov postoji; indeksiranje nije provereno.' };
const enabledEnv = { SAFE_AUTOMATON_AI_ENABLED: 'true', SAFE_AUTOMATON_AI_TOKEN: TEST_TOKEN, AI: { run: async () => ({ response: '## Nacrt\n\nPotrebna je ljudska provera.' }) } };

test('AI endpoint is disabled by default and does not call model', async () => {
  let called = false;
  const response = await onRequest({ request: request(valid), env: { AI: { run: async () => { called = true; } } } });
  assert.equal(response.status, 503);
  assert.equal(called, false);
  assert.equal((await response.json()).enabled, false);
});

test('AI endpoint validates method, origin, JSON and task type', async () => {
  assert.equal((await onRequest({ request: request(null, { method: 'GET' }), env: enabledEnv })).status, 405);
  assert.equal((await onRequest({ request: request(valid, { origin: 'https://evil.example' }), env: enabledEnv })).status, 403);
  assert.equal((await onRequest({ request: request('{invalid'), env: enabledEnv })).status, 400);
  assert.equal((await onRequest({ request: request({ ...valid, taskType: 'shell' }), env: enabledEnv })).status, 400);
  assert.equal((await onRequest({ request: request({ ...valid, title: '' }), env: enabledEnv })).status, 400);
  assert.equal((await onRequest({ request: request(valid, { token: '' }), env: enabledEnv })).status, 401);
  assert.equal((await onRequest({ request: request(valid), env: { SAFE_AUTOMATON_AI_ENABLED: 'true', AI: enabledEnv.AI } })).status, 503);\n  assert.equal((await onRequest({ request: request(valid, { token: '' }), env: enabledEnv })).status, 401);\n  assert.equal((await onRequest({ request: request(valid), env: { SAFE_AUTOMATON_AI_ENABLED: 'true', AI: enabledEnv.AI } })).status, 503);
});

test('AI endpoint rejects oversized bodies before inference', async () => {
  const large = { ...valid, evidence: 'x'.repeat(20_000) };
  const response = await onRequest({ request: request(large), env: enabledEnv });
  assert.equal(response.status, 413);
});

test('AI endpoint uses fixed model, bounded output and labels result as unverified draft', async () => {
  let seenModel, seenInput;
  const env = { SAFE_AUTOMATON_AI_ENABLED: 'true', SAFE_AUTOMATON_AI_TOKEN: TEST_TOKEN, AI: { run: async (model, input) => {
    seenModel = model; seenInput = input; return { response: 'Radni nacrt.' };
  } } };
  const response = await onRequest({ request: request(valid), env });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(seenModel, '@cf/zai-org/glm-4.7-flash');
  assert.equal(seenInput.max_completion_tokens, 900);
  assert.equal(data.verified, false);
  assert.equal(data.sent, false);
  assert.equal(data.externalActionsTaken, false);
  assert.equal(data.status, 'AI_DRAFT_REQUIRES_HUMAN_REVIEW');
  assert.match(data.disclaimer, /nije nezavisno proverena/i);
});

test('AI endpoint rejects empty model output and hides provider exception details', async () => {
  const empty = await onRequest({ request: request(valid), env: { ...enabledEnv, AI: { run: async () => ({}) } } });
  assert.equal(empty.status, 502);
  const failure = await onRequest({ request: request(valid), env: { ...enabledEnv, AI: { run: async () => { throw new Error('secret internal details'); } } } });
  assert.equal(failure.status, 502);
  assert.doesNotMatch(await failure.text(), /secret internal details/);
});
