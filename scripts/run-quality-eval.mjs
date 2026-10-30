#!/usr/bin/env node
// Quality eval runner.
//
// Family 2 of the two skill eval families: once the skill loads, does it produce
// a better result than no skill at all? Every case runs twice - with the skill
// installed and with it removed - and the load-bearing number is the delta
// between the two pass rates. A skill that does not beat its own baseline is not
// earning its tokens.
//
// Trigger rates belong to run-trigger-eval.mjs. Do not read routing behaviour
// out of this report or quality out of that one.
//
// Usage:
//   node scripts/run-quality-eval.mjs --skill zhanggui-systematic-debugging --dry-run
//   node scripts/run-quality-eval.mjs --skill zhanggui-systematic-debugging --host claude
//   node scripts/run-quality-eval.mjs --skill zhanggui-test-driven-development --out evals/results/quality-tdd.json
//
// Grading: mechanical first (file exists / valid JSON), LLM judge for the rest.
// The judge prompt is pinned below and its digest is recorded in the report, so
// two reports are only comparable when their judge identity matches.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { accessSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(projectRoot, 'skills');

const JUDGE_SYSTEM_PROMPT = [
  'You are grading exactly one assertion about an agent run.',
  'You receive the assertion, the agent final message, the transcript, and the produced files.',
  'Require concrete evidence for a PASS: do not give the benefit of the doubt.',
  'If the assertion expects a summary and the output has a heading with one vague sentence, that is a FAIL.',
  'Reply with JSON only: {"passed": true|false, "evidence": "<one sentence that quotes the output>"}',
].join(' ');

// The agent arm needs to run the test suite and edit the fixture; with the
// default permission mode every Bash and Write is denied, both arms collapse to
// reading the source, and the delta stops measuring the skill. The judge needs no
// tools at all, so it is invoked without the bypass.
const ADAPTERS = {
  claude: {
    command: 'claude',
    agentArgs: query => ['-p', query, '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'],
    judgeArgs: query => ['-p', query, '--output-format', 'json'],
  },
};

// Only the claude adapter is calibrated for this family. The omp stub that used
// to sit here had no argument list at all, so it could only ever spawn an
// interactive session; leaving it in place would read as a supported host.

function invokedArgs(host, kind, prompt) {
  const adapter = ADAPTERS[host];
  return kind === 'agent' ? adapter.agentArgs(prompt) : adapter.judgeArgs(prompt);
}

function parseArgs(argv) {
  const options = { skill: null, host: 'claude', out: null, dryRun: false, timeoutMs: 600000, keepWorkspace: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === '--dry-run') options.dryRun = true;
    else if (flag === '--keep-workspace') options.keepWorkspace = true;
    else if (flag === '--skill') (options.skill = value), (index += 1);
    else if (flag === '--host') (options.host = value), (index += 1);
    else if (flag === '--out') (options.out = value), (index += 1);
    else if (flag === '--timeout-ms') (options.timeoutMs = Number(value)), (index += 1);
    else throw new Error(`unknown flag: ${flag}`);
  }
  assert.ok(options.skill, '--skill is required');
  assert.ok(ADAPTERS[options.host], `--host must be one of ${Object.keys(ADAPTERS).join(', ')}`);
  assert.ok(existsSync(path.join(skillsRoot, options.skill, 'SKILL.md')), `${options.skill} is not a catalog skill`);
  return options;
}

function judgeIdentity() {
  return createHash('sha256').update(JUDGE_SYSTEM_PROMPT).digest('hex');
}

function loadCorpus(skill) {
  const corpusPath = path.join(skillsRoot, skill, 'evals', 'evals.json');
  assert.ok(existsSync(corpusPath), `${skill} has no evals/evals.json`);
  const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));
  assert.equal(corpus.skill_name, skill, 'evals.json skill_name must match its directory');
  assert.ok(Array.isArray(corpus.evals) && corpus.evals.length >= 2, `${skill} needs at least 2 eval cases`);
  for (const item of corpus.evals) {
    assert.ok(item.id !== undefined, 'eval case needs an id');
    assert.ok(typeof item.prompt === 'string' && item.prompt.length > 0, `case ${item.id} needs a prompt`);
    assert.ok(typeof item.expected_output === 'string' && item.expected_output.length > 0, `case ${item.id} needs expected_output`);
    assert.ok(Array.isArray(item.assertions) && item.assertions.length > 0, `case ${item.id} needs assertions`);
  }
  return corpus;
}

// --- workspace ---------------------------------------------------------------

function buildWorkspace(skill, item, { withSkill }) {
  const workspace = mkdtempSync(path.join(tmpdir(), 'quality-eval-'));
  const skillsDir = path.join(workspace, '.claude', 'skills');
  mkdirSync(skillsDir, { recursive: true });
  if (withSkill) cpSync(path.join(skillsRoot, skill), path.join(skillsDir, skill), { recursive: true });

  const fixtureRoot = path.join(skillsRoot, skill, 'evals', 'files');
  for (const relative of item.files ?? []) {
    const source = path.join(fixtureRoot, relative);
    assert.ok(existsSync(source), `fixture missing: ${relative}`);
    cpSync(source, path.join(workspace, path.basename(relative)), { recursive: true });
  }
  return workspace;
}

// Fixture files are deliberately included: for a workflow skill the evidence of
// what the agent did lives in the files it edited, not only in its final message.
function collectOutputs(workspace) {
  const produced = [];
  const walk = (directory, prefix) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.claude' || entry.name === '.git') continue;
      const full = path.join(directory, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, relative);
      else if (entry.isFile() && !/node_modules|\.png$|\.jpg$/.test(relative)) {
        produced.push({ path: relative, content: readFileSync(full, 'utf8').slice(0, 8000) });
      }
    }
  };
  walk(workspace, '');
  return produced;
}

// --- grading -----------------------------------------------------------------

function mechanicalGrade(assertion, outputs) {
  const fileMatch = /^a file named ([^\s]+) exists\.?$/i.exec(assertion.trim());
  if (fileMatch) {
    const hit = outputs.find(output => output.path.endsWith(fileMatch[1]));
    return { passed: Boolean(hit), evidence: hit ? `found ${hit.path}` : `no file named ${fileMatch[1]} among ${outputs.length} produced files` };
  }
  const jsonMatch = /^([^\s]+) is valid JSON\.?$/i.exec(assertion.trim());
  if (jsonMatch) {
    const hit = outputs.find(output => output.path.endsWith(jsonMatch[1]));
    if (!hit) return { passed: false, evidence: `no file named ${jsonMatch[1]} was produced` };
    try {
      JSON.parse(hit.content);
      return { passed: true, evidence: `${hit.path} parsed as JSON` };
    } catch (error) {
      return { passed: false, evidence: `${hit.path} failed to parse: ${error.message}` };
    }
  }
  return null;
}

function textFromMessages(messages) {
  const texts = [];
  for (const message of messages ?? []) {
    for (const block of Array.isArray(message.content) ? message.content : []) {
      if (block?.type === 'text' && typeof block.text === 'string') texts.push(block.text);
    }
  }
  return texts.join('\n');
}

function parseJsonLines(stdout) {
  const events = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // not an event line
    }
  }
  return events;
}

function extractJudgeText(stdout) {
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    const events = parseJsonLines(stdout);
    if (events.length > 0) return textFromMessages(events.filter(event => event.type === 'assistant').map(event => event.message));
    return stdout;
  }
  if (typeof payload.result === 'string') return payload.result;
  return textFromMessages(payload.messages);
}

// Whether the skill actually loaded is the one thing the delta cannot tell you: a
// with_skill arm that never invoked the skill is the without_skill arm with extra
// tokens, and a delta of zero then says nothing about the skill. The agent arm
// therefore runs in stream-json and reports its activations next to its score.
function truncate(text, limit) {
  const value = String(text ?? '');
  return value.length <= limit ? value : `${value.slice(0, limit)}...[truncated]`;
}

// The judge has to judge ordering - did the failing run happen before the edit -
// and the raw stream-json tail buries that evidence: in a red-green run the red
// phase is early and falls outside any fixed tail window, which fails both arms
// on exactly the assertions a workflow skill exists to satisfy. Emit a compact
// chronological log of tool calls, their results, and assistant text instead, and
// keep both ends when it is too long to send whole.
function buildTranscript(stdout) {
  const lines = [];
  for (const event of parseJsonLines(stdout)) {
    if (event.type === 'assistant') {
      for (const block of Array.isArray(event.message?.content) ? event.message.content : []) {
        if (block?.type === 'tool_use') lines.push(`TOOL ${block.name} ${truncate(JSON.stringify(block.input ?? {}), 400)}`);
        else if (block?.type === 'text' && block.text) lines.push(`TEXT ${truncate(block.text, 1200)}`);
      }
    } else if (event.type === 'user') {
      for (const block of Array.isArray(event.message?.content) ? event.message.content : []) {
        if (block?.type !== 'tool_result') continue;
        const content = typeof block.content === 'string'
          ? block.content
          : (Array.isArray(block.content) ? block.content.map(part => part?.text ?? '').join(' ') : '');
        lines.push(`RESULT ${truncate(content, 1500)}`);
      }
    } else if (event.type === 'result' && typeof event.result === 'string') {
      lines.push(`FINAL_MESSAGE ${truncate(event.result, 4000)}`);
    }
  }
  const transcript = lines.join('\n');
  if (transcript.length <= 60000) return transcript;
  return `${transcript.slice(0, 30000)}\n...[middle trimmed]...\n${transcript.slice(-30000)}`;
}

function skillActivations(stdout) {
  const loaded = [];
  for (const event of parseJsonLines(stdout)) {
    if (event.type !== 'assistant') continue;
    for (const block of Array.isArray(event.message?.content) ? event.message.content : []) {
      if (block?.type !== 'tool_use' || block?.name !== 'Skill') continue;
      const skill = block?.input?.skill;
      if (typeof skill === 'string' && !loaded.includes(skill)) loaded.push(skill);
    }
  }
  return loaded;
}

function judgeGrade(options, assertion, item, finalMessage, transcript, outputs) {
  const prompt = [
    JUDGE_SYSTEM_PROMPT,
    '',
    `Assertion: ${assertion}`,
    `Expected outcome: ${item.expected_output}`,
    '',
    `Agent final message:\n${finalMessage.slice(0, 6000)}`,
    '',
    `Produced files:\n${outputs.map(output => `--- ${output.path} ---\n${output.content}`).join('\n').slice(0, 12000)}`,
    '',
    `Transcript:\n${transcript}`,
  ].join('\n');

  const result = spawnSync(ADAPTERS[options.host].command, invokedArgs(options.host, 'judge', prompt), {
    cwd: projectRoot,
    encoding: 'utf8',
    env: process.env,
    timeout: options.timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    return { passed: false, evidence: `judge invocation failed: ${result.error?.message ?? `exit ${result.status}`}`, ungraded: true };
  }
  const text = extractJudgeText(result.stdout ?? '');
  const jsonMatch = /\{[\s\S]*\}/.exec(text);
  if (!jsonMatch) {
    return { passed: false, evidence: `judge reply was not JSON: ${text.slice(0, 200)}`, ungraded: true };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return { passed: parsed.passed === true, evidence: String(parsed.evidence ?? '').slice(0, 400) };
  } catch (error) {
    return { passed: false, evidence: `judge JSON unparseable: ${error.message}`, ungraded: true };
  }
}

// --- run ---------------------------------------------------------------------

function runCase(options, item) {
  const configurations = {};

  for (const withSkill of [true, false]) {
    const configuration = withSkill ? 'with_skill' : 'without_skill';
    const workspace = buildWorkspace(options.skill, item, { withSkill });
    const startedAt = Date.now();
    const result = spawnSync(ADAPTERS[options.host].command, invokedArgs(options.host, 'agent', item.prompt), {
      cwd: workspace,
      encoding: 'utf8',
      env: process.env,
      timeout: options.timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
    });
    const durationMs = Date.now() - startedAt;
    const outputs = collectOutputs(workspace);

    const grade = { assertion_results: [] };
    if (result.error || result.status !== 0) {
      for (const assertion of item.assertions) {
        grade.assertion_results.push({ text: assertion, passed: false, evidence: 'agent run failed', ungraded: true });
      }
    } else {
      const finalMessage = extractJudgeText(result.stdout ?? '');
      const transcript = buildTranscript(result.stdout ?? '');
      for (const assertion of item.assertions) {
        const mechanical = mechanicalGrade(assertion, outputs);
        grade.assertion_results.push({
          text: assertion,
          ...(mechanical ?? judgeGrade(options, assertion, item, finalMessage, transcript, outputs)),
        });
      }
    }

    const passed = grade.assertion_results.filter(entry => entry.passed).length;
    configurations[configuration] = {
      pass_rate: grade.assertion_results.length === 0 ? 0 : passed / grade.assertion_results.length,
      passed,
      total: grade.assertion_results.length,
      duration_ms: durationMs,
      exit_code: result.status,
      skill_activations: skillActivations(result.stdout ?? ''),
      outputs: outputs.map(output => output.path),
      assertion_results: grade.assertion_results,
      ...(options.keepWorkspace ? { workspace } : {}),
    };
    if (!options.keepWorkspace) rmSync(workspace, { recursive: true, force: true });
  }

  return {
    id: item.id,
    prompt: item.prompt,
    expected_output: item.expected_output,
    ...configurations,
    delta: configurations.with_skill.pass_rate - configurations.without_skill.pass_rate,
  };
}

const options = parseArgs(process.argv.slice(2));
const corpus = loadCorpus(options.skill);
console.log(`skill: ${options.skill} | host: ${options.host} | cases: ${corpus.evals.length}`);
console.log(`judge identity: ${judgeIdentity().slice(0, 16)}`);

if (options.dryRun) {
  for (const item of corpus.evals) {
    console.log(`  case ${item.id}: ${item.assertions.length} assertions, ${(item.files ?? []).length} fixture files`);
  }
  console.log('dry run: nothing was invoked.');
  process.exit(0);
}

const cases = corpus.evals.map(item => {
  const result = runCase(options, item);
  console.log(
    `case ${result.id}: with_skill=${result.with_skill.pass_rate.toFixed(2)} without_skill=${result.without_skill.pass_rate.toFixed(2)} delta=${result.delta >= 0 ? '+' : ''}${result.delta.toFixed(2)}`,
  );
  return result;
});

const mean = values => (values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length);
const withSkillMean = mean(cases.map(item => item.with_skill.pass_rate));
const withoutSkillMean = mean(cases.map(item => item.without_skill.pass_rate));
const ungraded = cases.flatMap(item => [item.with_skill, item.without_skill]).flatMap(config => config.assertion_results).filter(entry => entry.ungraded).length;

const report = {
  skill: options.skill,
  host: options.host,
  agent_permissions: 'bypassPermissions',
  driving_model: process.env.ANTHROPIC_MODEL ?? process.env.OMP_MODEL ?? process.env.PI_MODEL ?? null,
  judge_identity_sha256: judgeIdentity(),
  with_skill: { pass_rate_mean: withSkillMean },
  without_skill: { pass_rate_mean: withoutSkillMean },
  delta: { pass_rate: withSkillMean === null || withoutSkillMean === null ? null : withSkillMean - withoutSkillMean },
  ungraded_assertions: ungraded,
  cases,
};

console.log(`\nwith_skill pass_rate mean: ${withSkillMean.toFixed(3)}`);
console.log(`without_skill pass_rate mean: ${withoutSkillMean.toFixed(3)}`);
console.log(`delta: ${report.delta.pass_rate >= 0 ? '+' : ''}${report.delta.pass_rate.toFixed(3)}`);
if (ungraded > 0) console.log(`ungraded assertions (judge or run failure, counted as failures): ${ungraded}`);

if (options.out) {
  writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`report written to ${options.out}`);
} else {
  console.log('no --out given; report not persisted.');
}
