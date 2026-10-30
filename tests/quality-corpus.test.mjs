import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(projectRoot, 'skills');

// The quality corpus is the second eval family: run each case with the skill and
// without it, grade the assertions, and read the delta. These assertions pin the
// corpus shape so a case cannot quietly lose its assertions or its fixture; the
// rates themselves only exist after a real run.

const MIN_CASES = 2;
const MAX_CASES = 7;

async function skillNames() {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
}

function childEnvWithoutTestContext() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  return env;
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function assertQualityCorpus(skill, corpus) {
  assert.equal(corpus.skill_name, skill, `${skill}: evals.json skill_name must match its directory`);
  assert.ok(Array.isArray(corpus.evals), `${skill}: evals must be an array`);
  assert.ok(
    corpus.evals.length >= MIN_CASES && corpus.evals.length <= MAX_CASES,
    `${skill}: needs ${MIN_CASES}-${MAX_CASES} cases, got ${corpus.evals.length}`,
  );

  const ids = new Set();
  for (const item of corpus.evals) {
    assert.ok(item.id !== undefined && !ids.has(item.id), `${skill}: missing or duplicated case id ${item.id}`);
    ids.add(item.id);
    assert.ok(typeof item.prompt === 'string' && item.prompt.length > 0, `${skill}/${item.id}: needs a prompt`);
    assert.ok(
      typeof item.expected_output === 'string' && item.expected_output.length > 0,
      `${skill}/${item.id}: needs expected_output so a human reviewer can judge the result too`,
    );
    assert.ok(
      Array.isArray(item.assertions) && item.assertions.length > 0,
      `${skill}/${item.id}: needs at least one assertion`,
    );
    for (const assertion of item.assertions) {
      assert.ok(typeof assertion === 'string' && assertion.trim().length >= 10, `${skill}/${item.id}: assertion too thin: ${assertion}`);
    }
    assert.ok(Array.isArray(item.files ?? []), `${skill}/${item.id}: files must be an array when present`);
  }

  // A fixture with a deliberate failure is load-bearing: if it silently starts
  // passing, the case that depends on observing a failure stops measuring
  // anything. Every referenced fixture therefore has to declare its baseline.
  const baselines = corpus.fixture_baseline ?? {};
  const referenced = new Set(corpus.evals.flatMap(item => item.files ?? []));
  for (const fixture of referenced) {
    assert.ok(
      baselines[fixture] === 'passing' || baselines[fixture] === 'failing',
      `${skill}: fixture ${fixture} must declare a fixture_baseline of passing or failing`,
    );
  }
}

test('every quality corpus is well formed and its fixtures exist', async () => {
  const discovered = await skillNames();
  const withCorpus = [];

  for (const skill of discovered) {
    const evalsDir = path.join(skillsRoot, skill, 'evals');
    if (!(await exists(evalsDir))) continue;
    withCorpus.push(skill);

    const corpus = JSON.parse(await readFile(path.join(evalsDir, 'evals.json'), 'utf8'));
    assertQualityCorpus(skill, corpus);

    const usedFixtures = new Set();
    for (const item of corpus.evals) {
      for (const relative of item.files ?? []) {
        usedFixtures.add(relative);
        const fixture = path.join(evalsDir, 'files', relative);
        assert.ok(await exists(fixture), `${skill}/${item.id}: fixture missing at evals/files/${relative}`);
        const info = await stat(fixture);
        assert.ok(info.isDirectory() || info.size > 0, `${skill}/${item.id}: fixture ${relative} is empty`);
      }
    }

    for (const fixture of usedFixtures) {
      const expectation = corpus.fixture_baseline[fixture];
      const result = spawnSync('node', ['--test'], {
        cwd: path.join(evalsDir, 'files', fixture),
        encoding: 'utf8',
        timeout: 60000,
        // The parent test runner exports NODE_TEST_CONTEXT to its children, and a
        // nested `node --test` that inherits it reports into the parent instead of
        // setting its own exit code - which silently turns a failing fixture green.
        env: childEnvWithoutTestContext(),
      });
      const isFailing = result.status !== 0;
      assert.equal(
        isFailing,
        expectation === 'failing',
        `${skill}: fixture ${fixture} should be ${expectation} but its test run exited ${result.status}\n${(result.stdout ?? '').slice(-600)}`,
      );
    }
  }

  assert.ok(withCorpus.length >= 1, 'at least one skill must ship a quality corpus');
});

test('quality corpus gate rejects thin or mislabelled corpora', async () => {
  const sample = JSON.parse(
    await readFile(path.join(skillsRoot, 'zhanggui-test-driven-development', 'evals', 'evals.json'), 'utf8'),
  );
  assert.doesNotThrow(() => assertQualityCorpus('zhanggui-test-driven-development', sample));

  const probes = [
    ['wrong skill name', document => ({ ...document, skill_name: 'someone-else' })],
    ['too few cases', document => ({ ...document, evals: document.evals.slice(0, 1) })],
    ['missing assertions', document => ({ ...document, evals: [{ ...document.evals[0], assertions: [] }] })],
    ['missing expected_output', document => ({ ...document, evals: [{ ...document.evals[0], expected_output: '' }] })],
    ['duplicate ids', document => ({ ...document, evals: [document.evals[0], { ...document.evals[1], id: document.evals[0].id }] })],
    ['undeclared fixture baseline', document => ({ ...document, fixture_baseline: {} })],
  ];
  for (const [label, mutate] of probes) {
    assert.throws(
      () => assertQualityCorpus('zhanggui-test-driven-development', mutate(structuredClone(sample))),
      `${label} must fail the gate`,
    );
  }
});
