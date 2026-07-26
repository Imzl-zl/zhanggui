import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datasetPath = path.join(projectRoot, 'evals', 'skill-triggering.json');
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

let data;
let loadError;
try {
  data = JSON.parse(await readFile(datasetPath, 'utf8'));
} catch (error) {
  loadError = error;
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
