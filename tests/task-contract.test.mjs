import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHECK_STATUS,
  TASK_SCHEMA_VERSION,
  TASK_STATUS,
  TaskContractError,
  createTask,
  transitionTask
} from '../lib/task-contract.js';

function task(overrides = {}) {
  return createTask({
    taskId: 'task-test-001',
    taskType: 'code-repair',
    goal: 'Prepare a proposed code repair and verify it without deployment.',
    acceptanceCriteria: [
      { id: 'tests', description: 'Required regression tests pass.' },
      { id: 'review', description: 'Repair diff is reviewed.' }
    ],
    createdAt: '2026-10-16T12:00:00.000Z',
    ...overrides
  });
}

const passingChecks = [
  { id: 'check-tests', criterionId: 'tests', result: CHECK_STATUS.PASS, evidenceRef: 'test-run:local' },
  { id: 'check-review', criterionId: 'review', result: CHECK_STATUS.PASS, evidenceRef: 'review:diff' }
];

test('creates a versioned task with fail-closed zero-spend permissions', () => {
  const created = task({
    permissions: { external_actions_allowed: true, spend_limit_eur: 100 },
    approval_record: { approved: true }
  });
  assert.equal(created.schema_version, TASK_SCHEMA_VERSION);
  assert.equal(created.status, TASK_STATUS.QUEUED);
  assert.equal(created.permissions.spend_limit_eur, 0);
  assert.equal(created.permissions.external_actions_allowed, false);
  assert.deepEqual(created.permissions.allowed_actions, []);
  assert.equal(created.human_approval_required, true);
  assert.equal(created.approval_record, null);
  assert.equal(created.max_attempts, 2);
});

test('requires measurable acceptance criteria and unique criterion IDs', () => {
  assert.throws(() => task({ acceptanceCriteria: [] }), { code: 'ACCEPTANCE_CRITERIA_REQUIRED' });
  assert.throws(() => task({
    acceptanceCriteria: [
      { id: 'same', description: 'First' },
      { id: 'same', description: 'Second' }
    ]
  }), { code: 'DUPLICATE_CRITERION_ID' });
  assert.throws(() => task({ maxAttempts: 3 }), { code: 'INVALID_MAX_ATTEMPTS' });
});

test('allows only defined forward transitions and does not mutate the original task', () => {
  const queued = task();
  assert.throws(
    () => transitionTask(queued, TASK_STATUS.RUNNING),
    { code: 'ILLEGAL_TASK_TRANSITION' }
  );
  const planning = transitionTask(queued, TASK_STATUS.PLANNING);
  const running = transitionTask(planning, TASK_STATUS.RUNNING);
  const verifying = transitionTask(running, TASK_STATUS.VERIFYING);
  assert.equal(queued.status, TASK_STATUS.QUEUED);
  assert.equal(planning.status, TASK_STATUS.PLANNING);
  assert.equal(running.status, TASK_STATUS.RUNNING);
  assert.equal(verifying.status, TASK_STATUS.VERIFYING);
});

test('prevents PASS when required checks are missing or NOT_RUN', () => {
  const verifying = transitionTask(
    transitionTask(
      transitionTask(task(), TASK_STATUS.PLANNING),
      TASK_STATUS.RUNNING
    ),
    TASK_STATUS.VERIFYING
  );
  assert.throws(
    () => transitionTask(verifying, TASK_STATUS.PASSED),
    { code: 'REQUIRED_CHECK_NOT_PASSED' }
  );
  assert.throws(
    () => transitionTask(verifying, TASK_STATUS.PASSED, {
      checks: [
        ...passingChecks,
        { id: 'check-not-run', criterionId: 'tests', result: CHECK_STATUS.NOT_RUN }
      ]
    }),
    { code: 'REQUIRED_CHECK_NOT_PASSED' }
  );
  assert.throws(
    () => transitionTask(verifying, TASK_STATUS.PASSED, {
      checks: [
        { id: 'check-fail', criterionId: 'tests', result: CHECK_STATUS.FAIL },
        passingChecks[1]
      ]
    }),
    { code: 'REQUIRED_CHECK_FAILED' }
  );
});

test('allows PASS only after each required criterion has a passing completed check', () => {
  const verifying = transitionTask(
    transitionTask(
      transitionTask(task(), TASK_STATUS.PLANNING),
      TASK_STATUS.RUNNING
    ),
    TASK_STATUS.VERIFYING
  );
  const passed = transitionTask(verifying, TASK_STATUS.PASSED, { checks: passingChecks });
  assert.equal(passed.status, TASK_STATUS.PASSED);
  assert.deepEqual(passed.checks.map(check => check.result), [CHECK_STATUS.PASS, CHECK_STATUS.PASS]);
  assert.throws(
    () => transitionTask(passed, TASK_STATUS.FAILED),
    { code: 'TASK_ALREADY_TERMINAL' }
  );
});

test('cannot elevate spend or external-action permissions during a transition', () => {
  const queued = task();
  const planning = transitionTask(queued, TASK_STATUS.PLANNING, {
    permissions: { spend_limit_eur: 500, external_actions_allowed: true },
    human_approval_required: false,
    approval_record: { approved: true }
  });
  assert.equal(planning.permissions.spend_limit_eur, 0);
  assert.equal(planning.permissions.external_actions_allowed, false);
  assert.equal(planning.human_approval_required, true);
  assert.equal(planning.approval_record, null);
});

test('rejects unsupported schema versions and malformed checks', () => {
  assert.throws(
    () => transitionTask({ ...task(), schema_version: 999 }, TASK_STATUS.PLANNING),
    { code: 'UNSUPPORTED_TASK_SCHEMA' }
  );
  const verifying = transitionTask(
    transitionTask(
      transitionTask(task(), TASK_STATUS.PLANNING),
      TASK_STATUS.RUNNING
    ),
    TASK_STATUS.VERIFYING
  );
  assert.throws(
    () => transitionTask(verifying, TASK_STATUS.PASSED, {
      checks: [{ id: 'bad', criterionId: 'tests', result: 'MAYBE' }]
    }),
    { code: 'INVALID_CHECK_RESULT' }
  );
  assert.ok(new TaskContractError('EXAMPLE', 'example') instanceof Error);
});
