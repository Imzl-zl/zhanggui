import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datasetPath = path.join(projectRoot, 'evals', 'skill-triggering.json');
const summaryPath = path.join(projectRoot, 'evals', 'results', 'v0.7-routing-summary.json');
const expectedSkills = [
  'zhanggui',
  'zhanggui-systematic-debugging',
  'zhanggui-test-driven-development',
  'zhanggui-verification-before-completion',
  'zhanggui-requesting-code-review',
  'zhanggui-receiving-code-review',
  'zhanggui-using-git-worktrees',
  'zhanggui-dispatching-parallel-agents',
  'zhanggui-finishing-a-development-branch',
];
const expectedThresholds = {
  explicit_root_rate: 1,
  implicit_root_rate_gte: 0.8,
  root_false_positive_rate_lte: 0.1,
  root_first_conflict_rate: 1,
};
const APPROVED_CATALOG_SOURCE_HEAD =
  'a3b6aea89aed9f2c371deb91240e298ba947cdd3';
const APPROVED_TRANSPORT_RETRY_POLICY = {
  max_waves: 3,
  backoff_seconds: [0, 5, 15],
  retry_scope: 'transport-errors-only',
  valid_wrong_selections_retryable: false,
};
const APPROVED_EVALUATOR_SYSTEM_PROMPT =
  'You are evaluating first-skill routing for an Agent Skills catalog. Based only on each catalog entry\'s name and description, the invocation source, and the user request, select the single skill that should load first. Return null when no skill applies. Do not execute any skill, solve the user\'s task, or select a later lifecycle substep. An explicit source means the user intentionally invoked the root named by the request; an implicit source contains no host command guarantee.';
const APPROVED_EVALUATOR_USER_PROMPT_TEMPLATE = [
  'Catalog: ${JSON.stringify(catalog)}',
  'Invocation source: ${item.source}',
  'User request: ${item.prompt}',
].join('\n');
const APPROVED_EVALUATOR_RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    selected_skill: {
      anyOf: [
        {
          type: 'string',
          enum: [
            'zhanggui',
            'zhanggui-systematic-debugging',
            'zhanggui-test-driven-development',
            'zhanggui-verification-before-completion',
            'zhanggui-requesting-code-review',
            'zhanggui-receiving-code-review',
            'zhanggui-using-git-worktrees',
            'zhanggui-dispatching-parallel-agents',
            'zhanggui-finishing-a-development-branch',
          ],
        },
        { type: 'null' },
      ],
    },
    reason: { type: 'string' },
  },
  required: ['selected_skill', 'reason'],
};

function evaluatorIdentityDigest() {
  return createHash('sha256')
    .update(JSON.stringify({
      system_prompt: APPROVED_EVALUATOR_SYSTEM_PROMPT,
      user_prompt_template: APPROVED_EVALUATOR_USER_PROMPT_TEMPLATE,
      result_schema: APPROVED_EVALUATOR_RESULT_SCHEMA,
    }))
    .digest('hex');
}


let data;
let loadError;
try {
  data = JSON.parse(await readFile(datasetPath, 'utf8'));
} catch (error) {
  loadError = error;
}
let summary;
let summaryLoadError;
try {
  summary = JSON.parse(await readFile(summaryPath, 'utf8'));
} catch (error) {
  summaryLoadError = error;
}


function casesWithTag(tag) {
  return data.cases.filter(item => item.tags.includes(tag));
}

function canonicalCaseProjection(cases) {
  return cases.map(item => ({
    id: item.id,
    prompt: item.prompt,
    source: item.source,
    expected_skill: item.expected_skill,
    expected_first: item.expected_first,
    forbidden_skills: item.forbidden_skills,
    tags: item.tags,
  }));
}

function hashCases(cases) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalCaseProjection(cases)))
    .digest('hex');
}

const APPROVED_TRIGGER_DATASET_SHA256 =
  '42b30e2b65a289a035b4f585f36ac053d110eaae2847e749329b347ba3eb6af5';

function assertApprovedTriggerDataset(cases, expectedDigest = APPROVED_TRIGGER_DATASET_SHA256) {
  assert.equal(hashCases(cases), expectedDigest);
}

test('trigger v2 file exists and exposes the approved schema', () => {
  assert.ifError(loadError);
  assert.equal(data.version, 2);
  assert.equal(data.runs_per_case, 3);
  assert.deepEqual(data.thresholds, expectedThresholds);
  assert.ok(Array.isArray(data.cases));
  assert.equal(data.cases.length, 122);
});

test('every trigger case has a stable identity and valid routing expectations', () => {
  assert.ifError(loadError);
  const ids = new Set();
  for (const item of data.cases) {
    assert.equal(typeof item.id, 'string');
    assert.ok(item.id.length > 0);
    assert.equal(ids.has(item.id), false, `duplicate case id: ${item.id}`);
    ids.add(item.id);
    assert.equal(typeof item.prompt, 'string');
    assert.ok(item.prompt.length > 0);
    assert.ok(['explicit', 'implicit'].includes(item.source));
    assert.ok(item.expected_skill === null || expectedSkills.includes(item.expected_skill));
    assert.ok(item.expected_first === null || expectedSkills.includes(item.expected_first));
    assert.ok(Array.isArray(item.forbidden_skills));
    assert.ok(item.forbidden_skills.every(name => expectedSkills.includes(name)));
    assert.ok(Array.isArray(item.tags));
    assert.ok(item.tags.length > 0);
    assert.equal(new Set(item.tags).size, item.tags.length);
    if (item.expected_skill !== null) {
      assert.equal(item.forbidden_skills.includes(item.expected_skill), false);
    }
  }
});

test('trigger v2 preserves every v0.6 leaf baseline and adds hybrid root coverage', () => {
  assert.ifError(loadError);
  for (const name of expectedSkills) {
    const baselinePositives = data.cases.filter(item =>
      item.tags.includes('baseline-positive') && item.expected_skill === name,
    );
    const baselineNegatives = data.cases.filter(item =>
      item.tags.includes('baseline-negative') && item.forbidden_skills.includes(name),
    );
    assert.equal(baselinePositives.length, 6, `${name} needs 6 baseline positives`);
    assert.equal(baselineNegatives.length, 6, `${name} needs 6 baseline negatives`);
  }
  assert.equal(casesWithTag('explicit-root').length, 6);
  assert.equal(casesWithTag('implicit-root').length, 8);
  assert.equal(casesWithTag('root-near-miss').length, 12);
  assert.ok(casesWithTag('root-first-conflict').length >= 4);
  assert.ok(casesWithTag('reverse-conflict').length >= 4);
  assert.ok(casesWithTag('explicit-root').every(item => item.source === 'explicit'));
  assert.ok(casesWithTag('implicit-root').every(item => item.source === 'implicit'));
  assert.ok(casesWithTag('implicit-root').every(item => item.expected_first === 'zhanggui'));
  assert.ok(casesWithTag('root-near-miss').every(item => item.forbidden_skills.includes('zhanggui')));
});

test('trigger v2 pins the complete ordered case matrix by digest', () => {
  assert.ifError(loadError);
  const mutated = structuredClone(data.cases);
  mutated[0] = { ...mutated[0], prompt: `${mutated[0].prompt} [mutation-probe]` };
  assert.notEqual(hashCases(mutated), APPROVED_TRIGGER_DATASET_SHA256);
  assert.throws(
    () => assertApprovedTriggerDataset(mutated),
    /Expected values to be strictly equal|AssertionError/,
  );
  assertApprovedTriggerDataset(data.cases);
});

test('v0.7 routing summary matches the approved dataset and release gates', () => {
  assert.ifError(summaryLoadError);
  assert.equal(summary.version, '0.7');
  assert.equal(summary.runs_per_case, 3);
  assert.equal(summary.total_cases, 122);
  assert.equal(summary.total_runs, 366);
  assert.equal(summary.dataset_snapshot.sha256, APPROVED_TRIGGER_DATASET_SHA256);
  assert.deepEqual(summary.routing_evaluation.thresholds, expectedThresholds);
  assert.equal(summary.routing_evaluation.transport_errors_scored, false);
  assert.equal(summary.rates.explicit_root, 1);
  assert.ok(summary.rates.implicit_root >= 0.8);
  assert.ok(summary.rates.root_false_positive <= 0.1);
  assert.equal(summary.rates.root_first_conflict, 1);
  assert.equal(summary.passed, true);
});

test('v0.7 routing summary preserves every leaf baseline rate', () => {
  assert.ifError(summaryLoadError);
  const negativeCeilings = new Map([
    ['zhanggui-systematic-debugging', 0],
    ['zhanggui-test-driven-development', 0],
    ['zhanggui-verification-before-completion', 0.1111111111111111],
    ['zhanggui-requesting-code-review', 0],
    ['zhanggui-receiving-code-review', 0],
    ['zhanggui-using-git-worktrees', 0],
    ['zhanggui-dispatching-parallel-agents', 0],
    ['zhanggui-finishing-a-development-branch', 0],
  ]);
  assert.deepEqual(summary.leaf_baselines.map(item => item.name), [...negativeCeilings.keys()]);
  for (const item of summary.leaf_baselines) {
    assert.equal(item.positive_trigger_rate, 1);
    assert.ok(item.negative_trigger_rate <= negativeCeilings.get(item.name));
  }
});

test('v0.7 catalog snapshot exactly matches current skill descriptions', async () => {
  assert.ifError(summaryLoadError);
  const entries = await Promise.all(expectedSkills.map(async name => {
    const content = await readFile(path.join(projectRoot, 'skills', name, 'SKILL.md'), 'utf8');
    const description = /^description:\s*(.+)$/m.exec(content)?.[1];
    assert.ok(description, `${name} description missing`);
    return { name, description, implicit: true };
  }));
  const digest = createHash('sha256').update(JSON.stringify(entries)).digest('hex');
  assert.deepEqual(summary.catalog_snapshot.entries, entries);
  assert.equal(summary.catalog_snapshot.sha256, digest);
  assert.equal(summary.catalog_snapshot.source_head, APPROVED_CATALOG_SOURCE_HEAD);
});

test('v0.7 routing summary pins evaluator prompt identity', () => {
  assert.ifError(summaryLoadError);
  assert.equal(summary.routing_evaluation.system_prompt, APPROVED_EVALUATOR_SYSTEM_PROMPT);
  assert.equal(
    summary.routing_evaluation.user_prompt_template,
    APPROVED_EVALUATOR_USER_PROMPT_TEMPLATE,
  );
  assert.deepEqual(
    summary.routing_evaluation.result_schema,
    APPROVED_EVALUATOR_RESULT_SCHEMA,
  );
  const digest = evaluatorIdentityDigest();
  assert.equal(summary.routing_evaluation.evaluator_identity_sha256, digest);
});

test('v0.7 routing summary pins bounded transport retry policy', () => {
  assert.ifError(loadError);
  assert.ifError(summaryLoadError);
  assert.deepEqual(data.transport_retry_policy, APPROVED_TRANSPORT_RETRY_POLICY);
  assert.deepEqual(summary.routing_evaluation.retry_policy, APPROVED_TRANSPORT_RETRY_POLICY);
  assert.ok(summary.routing_evaluation.retry_waves <= APPROVED_TRANSPORT_RETRY_POLICY.max_waves);
  assert.equal(summary.routing_evaluation.retry_errors_remaining_after_last_wave, 0);
  assert.ok(Array.isArray(summary.routing_evaluation.retry_wave_results));
  assert.equal(
    summary.routing_evaluation.retry_wave_results.length,
    summary.routing_evaluation.retry_waves,
  );
  for (const [index, wave] of summary.routing_evaluation.retry_wave_results.entries()) {
    assert.equal(wave.wave, index + 1);
    assert.equal(wave.backoff_seconds, APPROVED_TRANSPORT_RETRY_POLICY.backoff_seconds[index]);
    assert.equal(typeof wave.attempts, 'number');
    assert.equal(typeof wave.successes, 'number');
    assert.equal(typeof wave.errors_remaining, 'number');
    assert.ok(wave.attempts >= wave.successes);
  }
  if (summary.routing_evaluation.retry_wave_results.length > 0) {
    assert.equal(
      summary.routing_evaluation.retry_wave_results.at(-1).errors_remaining,
      0,
    );
  }
});

test('v0.7 host acceptance proves hybrid root and narrow leaf behavior', () => {
  assert.ifError(summaryLoadError);
  const host = summary.host_acceptance;
  assert.equal(host.host, 'omp');
  assert.equal(host.session_persistence, false);
  assert.equal(
    host.runtime_source_head,
    '13bedd125ffe084eca535b07a4b8ecaf152b9c6c',
  );
  assert.deepEqual(
    host.cases.map(item => item.id),
    [
      'native-root-explicit',
      'native-root-implicit',
      'native-debug',
      'native-root-conflict',
      'native-review',
      'fallback-debug',
    ],
  );
  assert.ok(host.cases.every(item => item.pass === true));
  assert.equal(host.cases.find(item => item.id === 'native-root-explicit').root_first, true);
  const implicit = host.cases.find(item => item.id === 'native-root-implicit');
  assert.equal(implicit.first_skill, 'zhanggui');
  assert.equal(implicit.announcement_observed, true);
  assert.equal(implicit.announcement_marker, '已自动进入 Zhanggui 完整工作流：');
  assert.equal(implicit.runtime_source_head, '13bedd125ffe084eca535b07a4b8ecaf152b9c6c');
  assert.equal(implicit.evidence_file, 'task-5-evidence/refresh-native-root-implicit.jsonl');
  assert.match(String(implicit.notice_timing || implicit.activation_events?.find(e => e.event === 'assistant_notice')?.timing || ''), /before first non-skill tool/i);
  assert.equal(host.cases.find(item => item.id === 'native-debug').first_skill, 'zhanggui-systematic-debugging');
  assert.equal(host.cases.find(item => item.id === 'native-root-conflict').first_skill, 'zhanggui');
  assert.equal(host.cases.find(item => item.id === 'native-review').first_skill, 'zhanggui-requesting-code-review');
  assert.equal(host.summary.supported_cases_total, 6);
  assert.equal(host.summary.supported_cases_passed, 6);
  assert.equal(host.summary.supported_cases_failed, 0);
  assert.equal(host.summary.unsupported_probes_recorded, 1);
  assert.equal(host.summary.unsupported_probes_excluded_from_totals, true);
  assert.equal(host.all_passed, true);
});
