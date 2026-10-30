import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(projectRoot, 'skills');
const corpusPath = path.join(projectRoot, 'evals', 'triggers', 'catalog-queries.json');

// The trigger corpus is the community-standard family: labelled queries run through
// a real agent, scored on whether the skill that actually loaded matches the label.
// These assertions pin the corpus design, not its results. Rates only become
// meaningful after a run, and a run against a description edit must not quietly
// change the train/validation split that was used to choose that description.

const MIN_QUERIES = 120;
const MIN_POSITIVES_PER_SKILL = 10;
const MIN_HARD_NEGATIVES_PER_SKILL = 6;
const MIN_NULL_TARGETS = 15;
const TRAIN_RATIO_BAND = [0.55, 0.7];

async function discoverSkillNames() {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const names = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await access(path.join(skillsRoot, entry.name, 'SKILL.md'));
      names.push(entry.name);
    } catch {
      // supporting directories are not discoverable skills
    }
  }
  return names.sort();
}

const catalog = await discoverSkillNames();
const corpus = JSON.parse(await readFile(corpusPath, 'utf8'));

function assertCorpusDesign(document, knownSkills) {
  assert.equal(document.runs_per_query >= 3, true, 'runs_per_query must be at least 3');
  assert.equal(document.threshold, 0.5, 'pass threshold must be the upstream default 0.5');
  for (const field of ['method', 'split_policy', 'near_miss_rule']) {
    assert.equal(typeof document[field], 'string', `corpus needs a ${field}`);
    assert.ok(document[field].length > 0, `corpus ${field} must not be empty`);
  }

  const queries = document.queries;
  assert.ok(queries.length >= MIN_QUERIES, `corpus needs >= ${MIN_QUERIES} queries, got ${queries.length}`);

  const ids = new Set();
  const known = new Set(knownSkills);
  const positives = Object.fromEntries(knownSkills.map(name => [name, { total: 0, train: 0, validation: 0 }]));
  const hardNegatives = Object.fromEntries(knownSkills.map(name => [name, 0]));
  let trainCount = 0;
  let nullTargets = 0;

  for (const entry of queries) {
    assert.ok(entry.id && !ids.has(entry.id), `query id missing or duplicated: ${entry.id}`);
    ids.add(entry.id);
    assert.ok(entry.query && entry.query.trim().length >= 4, `${entry.id}: query text too short`);
    assert.ok(['train', 'validation'].includes(entry.split), `${entry.id}: split must be train or validation`);
    assert.ok(
      entry.expected_skill === null || known.has(entry.expected_skill),
      `${entry.id}: expected_skill must be null or a catalog skill, got ${entry.expected_skill}`,
    );
    assert.ok(Array.isArray(entry.near_miss_for), `${entry.id}: near_miss_for must be an array`);
    for (const skill of entry.near_miss_for) {
      assert.ok(known.has(skill), `${entry.id}: near_miss_for names an unknown skill: ${skill}`);
      assert.notEqual(skill, entry.expected_skill, `${entry.id}: a query cannot be a near-miss for its own target`);
    }

    if (entry.split === 'train') trainCount += 1;
    if (entry.expected_skill === null) {
      nullTargets += 1;
    } else {
      positives[entry.expected_skill].total += 1;
      positives[entry.expected_skill][entry.split] += 1;
    }
    for (const skill of entry.near_miss_for) hardNegatives[skill] += 1;
  }

  for (const name of knownSkills) {
    const counts = positives[name];
    assert.ok(
      counts.total >= MIN_POSITIVES_PER_SKILL,
      `${name}: needs >= ${MIN_POSITIVES_PER_SKILL} should-trigger queries, got ${counts.total}`,
    );
    assert.ok(counts.train >= 3, `${name}: needs >= 3 train positives, got ${counts.train}`);
    assert.ok(counts.validation >= 2, `${name}: needs >= 2 validation positives, got ${counts.validation}`);
    assert.ok(
      hardNegatives[name] >= MIN_HARD_NEGATIVES_PER_SKILL,
      `${name}: needs >= ${MIN_HARD_NEGATIVES_PER_SKILL} declared hard negatives, got ${hardNegatives[name]}`,
    );
  }

  assert.ok(nullTargets >= MIN_NULL_TARGETS, `corpus needs >= ${MIN_NULL_TARGETS} should-trigger-nothing queries, got ${nullTargets}`);
  const trainRatio = trainCount / queries.length;
  assert.ok(
    trainRatio >= TRAIN_RATIO_BAND[0] && trainRatio <= TRAIN_RATIO_BAND[1],
    `train ratio must stay in [${TRAIN_RATIO_BAND.join(', ')}], got ${trainRatio.toFixed(3)}`,
  );
  return { ids, positives, hardNegatives, trainRatio, nullTargets };
}

test('trigger corpus pins an auditable catalog-wide design', () => {
  assertCorpusDesign(corpus, catalog);

  // The corpus must stay catalog-wide: a description edit shifts traffic toward
  // neighbouring skills, so every skill has to be measured against the same set.
  assert.deepEqual(
    Object.keys(corpus.queries.reduce((acc, q) => (q.expected_skill ? { ...acc, [q.expected_skill]: true } : acc), {})).sort(),
    catalog,
    'every catalog skill needs at least one should-trigger query',
  );
});

test('corpus design gate rejects thin, unbalanced or self-referential corpora', () => {
  const probe = structuredClone(corpus);
  const probes = [
    [
      'too few queries',
      document => {
        document.queries = document.queries.slice(0, 10);
        return document;
      },
    ],
    [
      'unknown expected skill',
      document => {
        document.queries[0].expected_skill = 'not-a-skill';
        return document;
      },
    ],
    [
      'self-referential near miss',
      document => {
        document.queries[0].near_miss_for = [document.queries[0].expected_skill];
        return document;
      },
    ],
    [
      'duplicate id',
      document => {
        document.queries[1].id = document.queries[0].id;
        return document;
      },
    ],
    [
      'bad split value',
      document => {
        document.queries[0].split = 'holdout';
        return document;
      },
    ],
    [
      'threshold drift',
      document => {
        document.threshold = 0.9;
        return document;
      },
    ],
  ];

  for (const [label, mutate] of probes) {
    const broken = mutate(structuredClone(probe));
    assert.throws(() => assertCorpusDesign(broken, catalog), `${label} must fail the gate`);
  }
  assert.doesNotThrow(() => assertCorpusDesign(probe, catalog));
});

test('trigger corpus stays frozen while a description edit is pending', async () => {
  // The train/validation split exists to keep description edits honest. Changing
  // the split at the same time as a description invalidates the comparison, so
  // the split assignment is pinned by digest the same way the catalog snapshot is.
  const { createHash } = await import('node:crypto');
  const splitProjection = corpus.queries.map(({ id, split }) => ({ id, split }));
  const digest = createHash('sha256').update(JSON.stringify(splitProjection)).digest('hex');
  assert.equal(
    corpus.split_sha256,
    digest,
    'split assignment changed: update split_sha256 only when the split is deliberately re-frozen, and never in the same change as a description edit',
  );
});
