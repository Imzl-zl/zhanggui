import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datasetPath = path.join(projectRoot, 'evals', 'skill-triggering.json');

const expected = [
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

let data;
let loadError;

try {
  data = JSON.parse(await readFile(datasetPath, 'utf8'));
} catch (error) {
  loadError = error;
}

test('trigger dataset file exists and parses as JSON object', () => {
  assert.ifError(loadError);
  assert.equal(typeof data, 'object');
  assert.notEqual(data, null);
  assert.equal(Array.isArray(data), false);
});

test('trigger dataset covers every skill with positive and near-miss cases', () => {
  assert.ifError(loadError);
  assert.equal(data.version, 1);
  assert.equal(data.runs_per_query, 3);
  assert.equal(data.trigger_threshold, 0.5);
  assert.ok(Number.isFinite(data.version));
  assert.ok(Number.isFinite(data.runs_per_query));
  assert.ok(Number.isFinite(data.trigger_threshold));
  assert.ok(Array.isArray(data.skills));
  assert.equal(data.skills.length, expected.length);
  assert.deepEqual(
    data.skills.map((item) => item.name),
    expected,
  );
  assert.deepEqual(new Set(data.skills.map((item) => item.name)), new Set(expected));

  for (const item of data.skills) {
    assert.equal(typeof item.name, 'string');
    assert.ok(Array.isArray(item.should_trigger), `${item.name} should_trigger must be array`);
    assert.ok(Array.isArray(item.should_not_trigger), `${item.name} should_not_trigger must be array`);
    assert.equal(item.should_trigger.length, 6, `${item.name} needs exactly 6 positives`);
    assert.equal(item.should_not_trigger.length, 6, `${item.name} needs exactly 6 negatives`);
    for (const prompt of item.should_trigger) {
      assert.equal(typeof prompt, 'string');
      assert.ok(prompt.length > 0, `${item.name} positive prompt must be non-empty`);
    }
    for (const prompt of item.should_not_trigger) {
      assert.equal(typeof prompt, 'string');
      assert.ok(prompt.length > 0, `${item.name} negative prompt must be non-empty`);
    }
  }
});

test('trigger prompts are unique and root positives are explicit', () => {
  assert.ifError(loadError);
  const prompts = data.skills.flatMap((item) => [...item.should_trigger, ...item.should_not_trigger]);
  assert.equal(prompts.length, 108);

  // Each skill keeps unique local positives/negatives; the brief reuses a few
  // near-miss phrasings across adjacent skills, so uniqueness is per skill.
  for (const item of data.skills) {
    const local = [...item.should_trigger, ...item.should_not_trigger];
    assert.equal(new Set(local).size, local.length, `${item.name} prompts must be unique within the skill`);
    assert.equal(new Set(item.should_trigger).size, item.should_trigger.length);
    assert.equal(new Set(item.should_not_trigger).size, item.should_not_trigger.length);
    for (const prompt of item.should_trigger) {
      assert.ok(!item.should_not_trigger.includes(prompt), `${item.name} cannot list the same prompt as positive and negative`);
    }
  }

  const root = data.skills.find((item) => item.name === 'zhanggui');
  assert.ok(root, 'root skill entry required');
  assert.ok(
    root.should_trigger.every((prompt) => /\/zhanggui|Zhanggui workflow/i.test(prompt)),
    'root positives must be explicit',
  );
  assert.ok(
    root.should_not_trigger.every((prompt) => !/\/zhanggui/i.test(prompt)),
    'root negatives must remain implicit',
  );
});
