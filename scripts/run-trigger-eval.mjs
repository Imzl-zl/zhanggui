#!/usr/bin/env node
// Trigger eval runner.
//
// Family 1 of the two skill eval families: does the right skill actually load?
// It runs every labelled query through a real agent with the full catalog
// installed, watches which skill loaded, and scores that against the label. No
// judge model grades the routing decision - the host's own activation event is
// the evidence, which is what makes a trigger assertion deterministic.
//
// This deliberately says nothing about whether the loaded skill produced a good
// result. That is the quality family; keep the two result sets apart.
//
// Usage:
//   node scripts/run-trigger-eval.mjs --dry-run
//   node scripts/run-trigger-eval.mjs --host claude --filter '^tdd-pos' --runs 1
//   node scripts/run-trigger-eval.mjs --host omp --split validation --out evals/results/triggers.json
//
// The host is invoked with ANTHROPIC_MODEL / the host's own model env in force;
// whatever that env names is recorded in the report as driving_model, because a
// trigger rate is a property of (catalog, host, model), not of the catalog alone.
//
// --fixture <dir> also stages a small git project before the run. Labelled
// queries like "review this diff" or "this test broke yesterday" name artifacts;
// with an empty workspace the host cannot tell whether the request is a process
// request or an unanswerable one, and the label stops being measurable. The same
// fixture is staged for every query, so it adds context without adding a hint.
//
// --descriptions <file> swaps individual descriptions into the staged catalog for
// this run only. Choosing the shipped description by validation pass rate needs
// two catalogs measured on the same split; editing skills/ back and forth by hand
// is how a comparison silently stops being a comparison.
//
// Adapters (calibrate on a small --filter before trusting a full run):
//   claude  reference   detection follows the upstream example script's idea -
//                       look for a Skill tool call naming the skill - but reads
//                       `claude -p <query> --output-format stream-json --verbose`,
//                       because the single-document `--output-format json` result
//                       no longer carries the message transcript. The transcript
//                       shape is still accepted as a fallback.
//   omp     heuristic   scans the `--mode json` event stream for a skill load
//                       naming the skill; shape taken from this repo's clean-host
//                       acceptance commands.
//   codex   heuristic   scans `codex exec --json` items for a skill activation.
//
// Every adapter reports the ordered list of skills the host actually activated,
// not just the first one: a request can legitimately load the orchestrator and
// then a leaf, and scoring has to see both or the second load is invisible.
//
// A full run costs queries x runs agent invocations (the shipped corpus is
// 144 x 3 = 432).

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { accessSync, appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(projectRoot, 'skills');
const corpusPath = path.join(projectRoot, 'evals', 'triggers', 'catalog-queries.json');

// --- arguments ---------------------------------------------------------------

// Print mode cannot answer a permission prompt, and a model that actually tries
// to do the work blocks there: on spark-x2.6 the same query exceeded a 300s
// wall with no flag. The staging directory is a throwaway temp dir per query.
const PERMISSION_MODE = process.env.ZHANGGUI_EVAL_PERMISSION_MODE ?? 'bypass';

const ADAPTERS = {
  claude: { command: 'claude', detect: detectClaude, status: 'reference' },
  omp: { command: 'omp', detect: detectOmp, status: 'heuristic' },
  codex: { command: 'codex', detect: detectCodex, status: 'heuristic' },
};

function parseArgs(argv) {
  const options = {
    host: 'claude',
    runs: null,
    filter: null,
    split: 'all',
    out: null,
    dryRun: false,
    fixture: null,
    descriptions: null,
    concurrency: 4,
    timeoutMs: 180000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === '--dry-run') options.dryRun = true;
    else if (flag === '--host') (options.host = value), (index += 1);
    else if (flag === '--runs') (options.runs = Number(value)), (index += 1);
    else if (flag === '--filter') (options.filter = value), (index += 1);
    else if (flag === '--split') (options.split = value), (index += 1);
    else if (flag === '--out') (options.out = value), (index += 1);
    else if (flag === '--fixture') (options.fixture = value), (index += 1);
    else if (flag === '--descriptions') (options.descriptions = value), (index += 1);
    else if (flag === '--concurrency') (options.concurrency = Number(value)), (index += 1);
    else if (flag === '--timeout-ms') (options.timeoutMs = Number(value)), (index += 1);
    else throw new Error(`unknown flag: ${flag}`);
  }
  assert.ok(ADAPTERS[options.host], `--host must be one of ${Object.keys(ADAPTERS).join(', ')}`);
  assert.ok(['all', 'train', 'validation'].includes(options.split), '--split must be all, train or validation');
  assert.ok(options.runs === null || Number.isInteger(options.runs) && options.runs > 0, '--runs must be a positive integer');
  assert.ok(Number.isInteger(options.concurrency) && options.concurrency > 0, '--concurrency must be a positive integer');
  return options;
}

// --- catalog -----------------------------------------------------------------

function discoverSkillNames() {
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .filter(entry => {
      try {
        accessSync(path.join(skillsRoot, entry.name, 'SKILL.md'));
        return true;
      } catch {
        return false;
      }
    })
    .map(entry => entry.name)
    .sort();
}

// --- host adapters -----------------------------------------------------------

function collectSkillActivations(messages, loaded) {
  for (const message of messages ?? []) {
    for (const block of Array.isArray(message.content) ? message.content : []) {
      if (block?.type !== 'tool_use' || block?.name !== 'Skill') continue;
      const skill = block?.input?.skill;
      if (typeof skill === 'string' && !loaded.includes(skill)) loaded.push(skill);
    }
  }
  return loaded;
}

function detectClaude(stdout) {
  const loaded = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (event.type === 'assistant') collectSkillActivations([event.message], loaded);
  }
  if (loaded.length > 0) return loaded;
  try {
    // Hosts (and older bridges) that still return one document with `messages`.
    collectSkillActivations(JSON.parse(stdout).messages, loaded);
  } catch {
    // not a single-document transcript; the stream-json scan above is the answer
  }
  return loaded;
}

function detectOmp(stdout, catalog) {
  return detectSkillNamedInJsonLines(stdout, catalog, /skill:\/\/|SKILL\.md|skill_activation|activate_skill/);
}

function detectCodex(stdout, catalog) {
  return detectSkillNamedInJsonLines(stdout, catalog, /skill|Skill/);
}

function detectSkillNamedInJsonLines(stdout, catalog, marker) {
  const loaded = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const text = JSON.stringify(event);
    if (!marker.test(text)) continue;
    for (const name of catalog) {
      if (text.includes(name) && !loaded.includes(name)) loaded.push(name);
    }
  }
  return loaded;
}

function buildArgs(host, query, hostDir) {
  // Print mode cannot answer a permission prompt. A model that actually tries
  // to do the work (write the failing test, run it) blocks there: measured on
  // spark-x2.6, the same query exceeded a 300s wall with no permission flag.
  // `plan` was tried first as the smaller grant and is worse (9/10 invocations
  // failed: print mode has no plan to approve). Bypass is what terminates.
  // The staging directory is a throwaway temp dir per query.
  if (host === 'claude') {
    const args = ['-p', query, '--output-format', 'stream-json', '--verbose'];
    // `bypass` is the default because it is the only mode measured to terminate
    // reliably here. `plan` fails (print mode has no plan to approve), so the
    // other modes are opt-in for experiments rather than baked in.
    if (PERMISSION_MODE === 'bypass') args.push('--dangerously-skip-permissions');
    else args.push('--permission-mode', PERMISSION_MODE);
    return args;
  }
  if (host === 'omp') {
    return [
      '--no-session', '--no-rules', '--cwd', hostDir, '--plugin-dir', projectRoot,
      '--mode', 'json', '--max-time', '120', '-p', query,
    ];
  }
  return ['exec', '--json', query];
}

function stageCatalog(hostDir) {
  const skillsDir = path.join(hostDir, '.claude', 'skills');
  mkdirSync(skillsDir, { recursive: true });
  for (const name of discoverSkillNames()) {
    cpSync(path.join(skillsRoot, name), path.join(skillsDir, name), { recursive: true });
  }
}

function applyDescriptionOverrides(hostDir) {
  if (!options.descriptions) return;
  const overrides = JSON.parse(readFileSync(path.resolve(projectRoot, options.descriptions), 'utf8'));
  for (const [name, description] of Object.entries(overrides)) {
    const file = path.join(hostDir, '.claude', 'skills', name, 'SKILL.md');
    const content = readFileSync(file, 'utf8');
    const next = content.replace(/^description:[ \t]*.*$/m, `description: ${description}`);
    assert.notEqual(next, content, `description override did not apply for ${name}`);
    writeFileSync(file, next, 'utf8');
  }
}

// The fixture is a plain project tree plus a git history and one uncommitted
// change, so `git diff`, an existing failing test, and a real module layout are
// all present. `.claude/` is gitignored in the fixture, so the staged catalog
// stays out of the project the host is looking at.
function prepareWorkspace(hostDir) {
  const source = path.resolve(projectRoot, options.fixture);
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    cpSync(path.join(source, entry.name), path.join(hostDir, entry.name), { recursive: true });
  }
  const git = (...args) => execFileSync('git', args, { cwd: hostDir, stdio: 'ignore' });
  git('-c', 'init.defaultBranch=main', 'init', '-q');
  git('config', 'user.email', 'trigger-eval@example.invalid');
  git('config', 'user.name', 'Trigger Eval');
  git('add', '-A');
  git('commit', '-q', '-m', 'shop-app: cart pricing, order api, views');
  appendFileSync(
    path.join(hostDir, 'src', 'api', 'routes.js'),
    [
      '',
      'export function handleCartRecalculate(request) {',
      '  const { items = [], coupon = 0 } = request.body ?? {};',
      '  return { status: 200, body: payableTotal(items, coupon) };',
      '}',
      '',
    ].join('\n'),
  );
}

// Queries are independent - each gets its own staged catalog in its own temp
// directory - so they can overlap. A full run is 144 x 3 invocations; at one
// invocation at a time that is hours of wall clock for no extra information.
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(lanes);
  return results;
}

// Capture the child's output through files, not pipes. On Windows a killed child can lose
// piped output on kill, so an activation already printed before a timeout must be read from
// our own buffer instead of from the exit status. A run that never activated stays failed:
// an early kill cannot prove the host would not have loaded something later.
function runCaptured(command, args, { cwd, env, timeoutMs }) {
  return new Promise((resolve) => {
    // stdin stays a pipe: closing it makes the reference adapter stall before starting.
    const child = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    const finish = (code, extra = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr: `${stderr}${extra}` });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.on('error', (error) => finish(null, `\n${String(error)}`));
    child.on('close', (code) => finish(code, timedOut ? `\n[timeout after ${timeoutMs}ms]` : ''));
  });
}

async function runOnce(entry) {
  const hostDir = mkdtempSync(path.join(tmpdir(), 'trigger-eval-'));
  try {
    if (options.fixture) prepareWorkspace(hostDir);
    stageCatalog(hostDir);
    applyDescriptionOverrides(hostDir);
    const { code, stdout, stderr } = await runCaptured(
      adapter.command,
      buildArgs(options.host, entry.query, hostDir),
      { cwd: hostDir, env: process.env, timeoutMs: options.timeoutMs },
    );
    const detected = adapter.detect(stdout ?? '', catalog);
    if (code === 0) {
      return { exit_code: 0, loaded: detected };
    }
    // What this family measures is which skill the host activated, not whether the run
    // finished. The activation event is emitted within the first few lines, so a timeout
    // that arrives afterwards carries a valid observation — discarding it is what turned
    // real root activations into recorded misses. Without an activation the run stays
    // failed, because an early kill cannot prove that nothing would have loaded.
    if (detected.length) {
      return { exit_code: 0, loaded: detected, terminated_early: true };
    }
    // Keep the diagnostics for every failed invocation, not just timeouts: a
    // partial run is only interpretable if the failure reason is in the report.
    return {
      exit_code: code,
      loaded: [],
      error: `exit code ${code}${stderr ? `\n[stderr] ${stderr}` : ''}`.slice(0, 4000),
    };
  } finally {
    // A Windows file lock (a lingering child process, antivirus) can make this
    // fail; losing one temp directory must not abort a multi-hundred-invocation
    // run. The OS reaps the directory.
    try {
      rmSync(hostDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
      // best effort only
    }
  }
}

// --- scoring -----------------------------------------------------------------

// Scoring is per run, not per query: recall and precision are observation-level
// rates, so a skill that loads on 2 of 3 runs contributes 2 true positives and
// 1 false negative rather than rounding to either end.
function scoreRuns(records, skills) {
  const totals = Object.fromEntries(skills.map(name => [name, { tp: 0, fn: 0, fp: 0, tn: 0 }]));
  let nullTargetRuns = 0;
  let nullTargetClean = 0;

  for (const record of records) {
    for (const run of record.runs) {
      if (run.exit_code !== 0) continue;
      const activated = run.loaded ?? [];
      if (record.expected_skill === null) {
        nullTargetRuns += 1;
        if (activated.length === 0) nullTargetClean += 1;
      }
      for (const name of skills) {
        const expected = record.expected_skill === name;
        const loaded = activated.includes(name);
        if (expected && loaded) totals[name].tp += 1;
        else if (expected) totals[name].fn += 1;
        else if (loaded) totals[name].fp += 1;
        else totals[name].tn += 1;
      }
    }
  }

  const rates = {};
  for (const name of skills) {
    const { tp, fn, fp } = totals[name];
    rates[name] = {
      recall: tp + fn === 0 ? null : tp / (tp + fn),
      precision: tp + fp === 0 ? null : tp / (tp + fp),
      ...totals[name],
    };
  }
  return {
    rates,
    null_target_runs: nullTargetRuns,
    null_target_clean_rate: nullTargetRuns === 0 ? null : nullTargetClean / nullTargetRuns,
  };
}

// A run matches the label when it activated the expected skill, or - for a
// should-trigger-nothing query - when it activated no skill at all. The corpus
// states the pass rule as "trigger rate >= threshold for should-trigger and
// < threshold for should-not-trigger", so on a should-not-trigger query the rate
// under test is the complement of the match rate above.
function scoreQuery(entry, runs, threshold) {
  const scored = runs.filter(run => run.exit_code === 0);
  const shouldTrigger = entry.expected_skill !== null;
  const hits = scored.filter(run => {
    const activated = run.loaded ?? [];
    return shouldTrigger ? activated.includes(entry.expected_skill) : activated.length === 0;
  }).length;
  const rate = scored.length === 0 ? null : hits / scored.length;
  const passed = rate === null
    ? false
    : shouldTrigger
      ? rate >= threshold
      : 1 - rate < threshold;
  return { hits, scored: scored.length, rate, passed, observed: scored.map(run => run.loaded ?? []) };
}

// --- main --------------------------------------------------------------------

const options = parseArgs(process.argv.slice(2));
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));
const catalog = discoverSkillNames();
const adapter = ADAPTERS[options.host];

let selected = corpus.queries;
if (options.split !== 'all') selected = selected.filter(entry => entry.split === options.split);
if (options.filter) {
  const pattern = new RegExp(options.filter);
  selected = selected.filter(entry => pattern.test(entry.id));
}
const runsPerQuery = options.runs ?? corpus.runs_per_query;

console.log(`host: ${options.host} (adapter: ${adapter.status})`);
console.log(`queries: ${selected.length} | runs per query: ${runsPerQuery} | invocations: ${selected.length * runsPerQuery} | concurrency: ${options.concurrency}`);
console.log(`catalog: ${catalog.length} skills | threshold: ${corpus.threshold} | split digest: ${corpus.split_sha256.slice(0, 12)}`);
console.log(`workspace fixture: ${options.fixture ?? 'none'}`);

if (selected.length === 0) {
  console.error('no query matched the given --split/--filter.');
  process.exit(1);
}

if (options.dryRun) {
  for (const entry of selected.slice(0, 10)) {
    console.log(`  ${entry.id} [${entry.split}] -> ${entry.expected_skill ?? '(nothing)'}`);
  }
  if (selected.length > 10) console.log(`  ... ${selected.length - 10} more`);
  console.log('dry run: nothing was invoked.');
  process.exit(0);
}

const records = await mapWithConcurrency(selected, options.concurrency, async entry => {
  const runs = [];
  for (let run = 0; run < runsPerQuery; run += 1) runs.push(await runOnce(entry));
  const scored = scoreQuery(entry, runs, corpus.threshold);
  console.log(
    `${scored.passed ? 'PASS' : 'FAIL'}  ${entry.id}  expected=${entry.expected_skill ?? '(nothing)'} observed=${JSON.stringify(scored.observed)}`,
  );
  return { ...entry, ...scored, runs };
});

const successfulRuns = records.flatMap(record => record.runs).filter(run => run.exit_code === 0).length;
if (successfulRuns === 0) {
  console.error('\nno invocation succeeded: the adapter is uncalibrated or the host is not authenticated. No report written.');
  process.exit(1);
}

const scoring = scoreRuns(records, catalog);
const bySplit = {};
for (const split of ['train', 'validation']) {
  const subset = records.filter(record => record.split === split);
  bySplit[split] = {
    queries: subset.length,
    passed: subset.filter(record => record.passed).length,
    pass_rate: subset.length === 0 ? null : subset.filter(record => record.passed).length / subset.length,
  };
}

console.log('\nper split:');
for (const [split, stats] of Object.entries(bySplit)) {
  console.log(`  ${split.padEnd(11)} ${stats.passed}/${stats.queries}  pass_rate=${stats.pass_rate === null ? 'n/a' : stats.pass_rate.toFixed(3)}`);
}
console.log(`\nshould-trigger-nothing runs that stayed clean: ${scoring.null_target_clean_rate === null ? 'n/a' : scoring.null_target_clean_rate.toFixed(3)} (${scoring.null_target_runs} runs)`);
console.log('\nper skill:');
for (const [name, rate] of Object.entries(scoring.rates)) {
  const recall = rate.recall === null ? 'n/a' : rate.recall.toFixed(3);
  const precision = rate.precision === null ? 'n/a' : rate.precision.toFixed(3);
  console.log(`  ${name.padEnd(40)} recall=${recall} precision=${precision} (tp=${rate.tp} fn=${rate.fn} fp=${rate.fp})`);
}

const report = {
  host: options.host,
  adapter_status: adapter.status,
  driving_model: process.env.ANTHROPIC_MODEL ?? process.env.OMP_MODEL ?? process.env.PI_MODEL ?? null,
  workspace_fixture: options.fixture,
  descriptions_override: options.descriptions ?? null,
  descriptions_override_sha256: options.descriptions
    ? createHash('sha256').update(readFileSync(path.resolve(projectRoot, options.descriptions))).digest('hex')
    : null,
  runs_per_query: runsPerQuery,
  concurrency: options.concurrency,
  threshold: corpus.threshold,
  split_sha256: corpus.split_sha256,
  queries: records.length,
  successful_runs: successfulRuns,
  total_runs: records.length * runsPerQuery,
  by_split: bySplit,
  rates: scoring.rates,
  null_target_clean_rate: scoring.null_target_clean_rate,
  records,
};

if (options.out) {
  writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`\nreport written to ${options.out}`);
} else {
  console.log('\nno --out given; report not persisted.');
}
