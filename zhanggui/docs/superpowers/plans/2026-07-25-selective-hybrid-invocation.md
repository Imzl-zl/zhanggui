# Zhanggui Selective Hybrid Invocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release Zhanggui v0.7.0 with one stateful root that supports selective automatic and explicit manual invocation while preserving eight narrow automatic/manual leaf skills.

**Architecture:** Remove the root-only host extension and make all nine catalog entries strict Agent Skills. The root description owns high-signal lifecycle routing, leaf descriptions own narrow intents, and the existing `SkillRequest`/`SkillResult` contract remains the only Embedded handoff. Trigger data becomes a tagged v2 case matrix so explicit root, implicit root, root near-misses, and root-first conflicts have separate release gates.

**Tech Stack:** Agent Skills `SKILL.md`, Markdown/YAML, JSON, Node.js ESM tests, `node:test`, pinned `skills-ref`, OMP clean-host activation, Oh My Pi `completion` routing evaluation.

**Design Truth:** `docs/superpowers/specs/2026-07-25-selective-hybrid-invocation-design.md`

## Global Constraints

- Target release is exactly `0.7.0`.
- The complete `skills/` collection remains the only supported installation unit.
- Root auto-entry is limited to ambiguous, cross-module, multi-deliverable, checkpointed, migration, or explicitly end-to-end work.
- Explicit root invocation always wins; OMP's native manual form remains interactive `/skill:zhanggui`.
- Narrow debugging, TDD, verification, review, feedback, worktree, parallel-agent, and branch-finishing requests stay with their leaf skills.
- An implicitly loaded root announces the observable trigger reason once before its first tool call and does not ask for confirmation.
- Entry source is transient and must not become a `WorkflowState`, tracker, checkpoint, or recovery field.
- A root false positive may de-escalate to minimal route state plus an Embedded leaf, but the routing evaluation still scores it as a false positive.
- Do not add an auto-router skill, host-default hook, keyword router, silent fallback, priority field, or second state owner.
- Preserve every v0.6 leaf Direct/Embedded business contract and all internal `STAGE.md` ownership boundaries.
- Trigger gates are: explicit root `1.0`, implicit root `>= 0.80`, root false-positive `<= 0.10`, root-first conflicts `1.0`, and no fixed leaf baseline regression.
- Transport errors remain separate from routing errors; up to three transport-only retry waves are allowed with backoffs `[0, 5, 15]` seconds, valid wrong selections are never retried, and retries do not change the original denominator.
- Unsupported host probes remain recorded and excluded from supported totals.
- Official validation stays pinned to `agentskills/agentskills@38a2ff82958afee88dadf4831509e6f7e9d8ef4e`.
- Evidence-driven deviations retained as implementation truth: catalog-visible exact announcement marker `已自动进入 Zhanggui 完整工作流：`; new-vs-existing review boundary; user-stated verified integration precedence for finishing vs verification; clean-host finite cases use a separate empty temp cwd each.

## File Structure

| Path | Responsibility in v0.7 |
|---|---|
| `skills/zhanggui/SKILL.md` | Strict root metadata, explicit/implicit entry contract, root-first guard, and narrow-task de-escalation |
| `skills/zhanggui/agents/openai.yaml` | Codex host profile permitting implicit invocation |
| `skills/zhanggui-*/SKILL.md` | Eight narrow descriptions with root deferral; professional procedures remain unchanged |
| `tests/skill-discovery.test.mjs` | Plugin/catalog/profile discovery contract and v0.7 manifest contract |
| `tests/skill-routing-contract.test.mjs` | Root entry modes, root-first ownership, and root/leaf exclusion contract |
| `tests/skill-trigger-data.test.mjs` | v2 schema, exact prompt digest, coverage gates, routing summary, and host acceptance contract |
| `evals/skill-triggering.json` | 122 stable catalog cases: 108 migrated baseline cases plus 14 hybrid boundary cases |
| `evals/results/v0.7-routing-summary.json` | 366 routing slots, rates, failures, catalog/data digests, and clean-host evidence |
| `scripts/validate-agent-skills.mjs` | Direct strict validation of all nine skills |
| `.codex-plugin/plugin.json` | v0.7 package identity and hybrid usage copy |
| `README.md` | Installation, automatic/manual usage, verification, and host commands |
| `docs/skill-fusion-design.md` | v0.7 runtime authority and acceptance scenarios |

---

### Task 1: Enable the Strict Hybrid Root Contract

**Files:**
- Modify: `tests/skill-discovery.test.mjs:155-178`
- Modify: `tests/skill-routing-contract.test.mjs:97-108`
- Modify: `skills/zhanggui/SKILL.md:1-20`
- Modify: `skills/zhanggui/agents/openai.yaml:1-5`
- Modify: `scripts/validate-agent-skills.mjs:1-64`

**Interfaces:**
- Consumes: the v0.6 root catalog name `zhanggui` and existing minimal/full `WorkflowState` projection rules.
- Produces: strict root frontmatter, transient `Explicit | Implicit` entry semantics, root-first execution guard, and direct official validation of all nine skill directories.

- [ ] **Step 1: Replace the discovery test with a failing strict-Hybrid contract**

Replace the existing `root orchestrator remains explicit-only` test with:

```js
test('root orchestrator supports strict hybrid invocation', async () => {
  const rootSkill = await readFile(path.join(skillsRoot, 'zhanggui', 'SKILL.md'), 'utf8');
  const { metadata } = parseFrontmatter(rootSkill);
  assert.equal(metadata.name, 'zhanggui');
  assert.equal(metadata['disable-model-invocation'], undefined);

  const standardFrontmatterFields = new Set([
    'name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools',
  ]);
  const rootExtensions = Object.keys(metadata).filter(key => !standardFrontmatterFields.has(key));
  assert.deepEqual(rootExtensions, []);
  assert.match(metadata.description ?? '', /^Use when\b/);
  assert.match(metadata.description ?? '', /ambiguous|cross-module|multi-deliverable/i);
  assert.match(metadata.description ?? '', /end-to-end/i);
  assert.match(metadata.description ?? '', /Do not use for isolated debugging/i);
  assert.match(metadata.compatibility ?? '', /complete Zhanggui skill collection/i);
  assert.match(metadata.compatibility ?? '', /model-selected skills/i);

  const policy = await readFile(
    path.join(skillsRoot, 'zhanggui', 'agents', 'openai.yaml'),
    'utf8',
  );
  assert.match(policy, /allow_implicit_invocation:\s*true/);
});
```

- [ ] **Step 2: Replace the routing metadata test and add a failing entry-mode test**

Replace the existing explicit-only test with these two tests:

```js
test('root uses strict hybrid catalog metadata', async () => {
  const root = await readFile(rootPath, 'utf8');
  const keys = frontmatterKeys(root);
  const standard = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
  assert.deepEqual(keys.filter(key => !standard.has(key)), []);
  assert.match(root, /^description: Use when\b/m);
  assert.match(root, /^description:.*ambiguous.*cross-module.*multi-deliverable/im);
  assert.match(root, /^description:.*Do not use for isolated debugging/im);
  assert.match(root, /^compatibility: Requires the complete Zhanggui skill collection/m);
});

test('root distinguishes explicit and implicit entry without persisting entry source', async () => {
  const root = await readFile(rootPath, 'utf8');
  const invocation = section(root, '## Invocation Modes', '## 核心纪律优先级');
  assert.match(invocation, /### Explicit/);
  assert.match(invocation, /### Implicit/);
  assert.match(invocation, /host-provided invocation metadata/i);
  assert.match(invocation, /已自动进入 Zhanggui 完整工作流/);
  assert.match(invocation, /before the first tool call/i);
  assert.match(invocation, /do not ask.*whether.*skill/i);
  assert.match(invocation, /must not.*WorkflowState/i);
  assert.match(invocation, /minimal route state/i);
  assert.match(invocation, /SkillRequest/);
  assert.match(invocation, /Zhanggui Embedded/);
  assert.match(invocation, /root.*wins.*Direct/i);
});
```

- [ ] **Step 3: Run the focused tests and confirm RED**

Run:

```bash
node --test --test-name-pattern="root orchestrator|root uses strict hybrid|root distinguishes explicit" tests/skill-discovery.test.mjs tests/skill-routing-contract.test.mjs
```

Expected: three failures caused by `disable-model-invocation: true`, the explicit-only description, `allow_implicit_invocation: false`, and the missing `## Invocation Modes` section.

- [ ] **Step 4: Replace root frontmatter and add the entry-mode body**

Use this exact frontmatter:

```yaml
---
name: zhanggui
description: Use when a development request is ambiguous, cross-module, multi-deliverable, checkpointed, or explicitly asks for end-to-end work from discovery or design through implementation and verified delivery. Also use when invoked explicitly. Do not use for isolated debugging, TDD, verification, review, review-feedback, worktree, parallel-agent, or branch-finishing requests handled by zhanggui-* skills.
compatibility: Requires the complete Zhanggui skill collection; automatic invocation requires a host that supports model-selected skills.
---
```

Replace the explicit-only opening paragraph and insert this section before `## 核心纪律优先级`:

```markdown
# Zhanggui（掌柜）- 有状态编排器

`zhanggui` 是选择性 Hybrid 根编排器：宿主可为高信号完整生命周期请求自动加载，也可由用户通过宿主原生命令显式加载。它是整个会话唯一拥有 `WorkflowState`、decision frontier、consensus、return point 和最终 readiness 的编排 frame。有状态设计/计划/执行步骤保留为内部 `STAGE.md`；可独立闭环的过程以 sibling leaf skill 暴露，直接调用时自行结束，由本编排器加载时只按 `Zhanggui Embedded` 契约返回局部 delta。

## Invocation Modes

Determine the entry source once. Prefer real host-provided invocation metadata. When the host exposes no source metadata, treat an exact native root command or the logical `/zhanggui` alias in the current user request as explicit; otherwise treat the entry as implicit. Entry source is transient control information and must not be written to `WorkflowState`, a tracker, a checkpoint, or recovery state.

### Explicit

An explicit root invocation wins over every leaf selection boundary. Start the existing level-0 route immediately; do not emit a redundant activation notice. Explicit invocation may route a narrow request through minimal state and an Embedded leaf because the user intentionally selected the root.

### Implicit

Implicit entry is valid only when the request itself provides a high-signal reason such as ambiguity requiring decisions, cross-module scope, multiple deliverables, checkpoint recovery, a high-risk migration, or explicit end-to-end ownership through verified delivery. Before the first tool call, emit exactly one of these notices, choosing the first statement supported by observed request or repository evidence:

```text
已自动进入 Zhanggui 完整工作流：该请求需要先澄清关键决策，再贯穿实现与验证。
已自动进入 Zhanggui 完整工作流：该请求跨越多个模块，需要统一设计、实施与验证。
已自动进入 Zhanggui 完整工作流：该请求包含多个交付物，需要一套可恢复的执行真值。
已自动进入 Zhanggui 完整工作流：该请求要求从设计持续负责到验证交付。
已自动进入 Zhanggui 完整工作流：该请求需要恢复已有 checkpoint 并继续到验证交付。
已自动进入 Zhanggui 完整工作流：该高风险迁移需要统一处理设计、回滚、实施与验证。
```

Do not compose a new reason, do not ask whether to enable the skill, and do not emit a notice whose stated condition lacks evidence. If none applies, do not expand into discovery, design, or planning.

### Root-first and narrow-task de-escalation

When the root and a leaf are both loaded in the same frame, the root wins and the leaf must not execute its Direct branch. The root may activate that leaf only through a real `SkillRequest` in `Zhanggui Embedded` mode.

After implicit entry, re-run the existing level-0 intent route before expanding state. If the request is actually isolated debugging, TDD, verification, review, feedback handling, worktree setup, parallel dispatch, or branch finishing, keep only minimal route state, issue the corresponding Embedded `SkillRequest`, merge its result, and stop. This runtime de-escalation limits cost but does not turn the catalog selection into a successful root trigger for evaluation purposes.
```

- [ ] **Step 5: Enable the Codex host profile**

Replace `skills/zhanggui/agents/openai.yaml` with:

```yaml
interface:
  display_name: "Zhanggui（掌柜）"
  short_description: "Stateful end-to-end orchestrator for complex development work"
policy:
  allow_implicit_invocation: true
```

- [ ] **Step 6: Simplify official validation to validate all nine skills directly**

Replace `scripts/validate-agent-skills.mjs` with:

```js
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(projectRoot, 'skills');
const source = 'git+https://github.com/agentskills/agentskills.git@38a2ff82958afee88dadf4831509e6f7e9d8ef4e#subdirectory=skills-ref';
const uvx = process.platform === 'win32' ? 'uvx.exe' : 'uvx';
const skills = [
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

function validate(skillPath) {
  const result = spawnSync(uvx, ['--from', source, 'skills-ref', 'validate', skillPath], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  if (result.error) {
    throw new Error(`Failed to spawn ${uvx} for ${skillPath}: ${result.error.message}`);
  }
  assert.equal(result.status, 0, `${skillPath}\n${result.stdout}\n${result.stderr}`);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

for (const name of skills) validate(path.join(skillsRoot, name));

console.log('Validated 9 strict Agent Skills.');
```

- [ ] **Step 7: Run GREEN checks**

Run:

```bash
node --check scripts/validate-agent-skills.mjs
node --test --test-name-pattern="root orchestrator|root uses strict hybrid|root distinguishes explicit" tests/skill-discovery.test.mjs tests/skill-routing-contract.test.mjs
node scripts/validate-agent-skills.mjs
```

Expected: focused tests pass; validator ends with `Validated 9 strict Agent Skills.`

- [ ] **Step 8: Commit Task 1**

```bash
git add tests/skill-discovery.test.mjs tests/skill-routing-contract.test.mjs skills/zhanggui/SKILL.md skills/zhanggui/agents/openai.yaml scripts/validate-agent-skills.mjs
git commit -m "feat(zhanggui): enable selective hybrid root invocation"
```

### Task 2: Make Root and Leaf Discovery Boundaries Mutually Exclusive

**Files:**
- Modify: `tests/skill-discovery.test.mjs:180-195`
- Modify: `skills/zhanggui-systematic-debugging/SKILL.md:1-4`
- Modify: `skills/zhanggui-test-driven-development/SKILL.md:1-4`
- Modify: `skills/zhanggui-verification-before-completion/SKILL.md:1-4`
- Modify: `skills/zhanggui-requesting-code-review/SKILL.md:1-4`
- Modify: `skills/zhanggui-receiving-code-review/SKILL.md:1-4`
- Modify: `skills/zhanggui-using-git-worktrees/SKILL.md:1-4`
- Modify: `skills/zhanggui-dispatching-parallel-agents/SKILL.md:1-4`
- Modify: `skills/zhanggui-finishing-a-development-branch/SKILL.md:1-4`

**Interfaces:**
- Consumes: Task 1 root description and root-first runtime guard.
- Produces: eight specific narrow descriptions that defer explicit, ambiguous, cross-module, or end-to-end work to the root without changing Direct/Embedded bodies.

- [ ] **Step 1: Strengthen the discoverable-leaf test**

Inside the enabled leaf test, after the existing `^Use when` assertion, add:

```js
    assert.match(metadata.description ?? '', /zhanggui root/i);
    assert.match(metadata.description ?? '', /explicit|end-to-end|cross-module/i);
```

- [ ] **Step 2: Run RED for the eight leaf descriptions**

Run:

```bash
node --test --test-name-pattern="discoverable dual-mode leaf skill" tests/skill-discovery.test.mjs
```

Expected: eight failures because current leaf descriptions do not state their root deferral boundary.

- [ ] **Step 3: Replace the eight description lines exactly**

```yaml
# skills/zhanggui-systematic-debugging/SKILL.md
description: Use when an isolated bug, test failure, build failure, performance problem, or unexpected behavior needs root-cause investigation; defer to the zhanggui root when the user explicitly invokes it or requests an ambiguous or end-to-end workflow

# skills/zhanggui-test-driven-development/SKILL.md
description: Use when an isolated production feature, bug fix, refactor, or behavior change needs Red-Green-Refactor before implementation; defer to the zhanggui root for explicit, ambiguous, cross-module, or end-to-end workflows

# skills/zhanggui-verification-before-completion/SKILL.md
description: Use when an isolated claim of complete, fixed, passing, or ready needs fresh evidence before commit, push, PR, or task transition; defer to the zhanggui root for explicit or end-to-end workflow ownership

# skills/zhanggui-requesting-code-review/SKILL.md
description: Use when an isolated code change needs independent review before verification, merge, delivery, or dependent work; defer to the zhanggui root for explicit, cross-module, or end-to-end workflow ownership

# skills/zhanggui-receiving-code-review/SKILL.md
description: Use when review feedback needs technical verification before acceptance, rejection, or implementation; defer to the zhanggui root when feedback belongs to an explicit or end-to-end workflow it already owns

# skills/zhanggui-using-git-worktrees/SKILL.md
description: Use when isolated feature work needs a protected checkout, separate write scope, or implementation-plan workspace; defer to the zhanggui root when worktree setup is one step in an explicit or end-to-end workflow

# skills/zhanggui-dispatching-parallel-agents/SKILL.md
description: Use when two or more independent problem domains can run concurrently without shared state or overlapping writes; defer to the zhanggui root when parallel work belongs to an explicit, cross-module, or end-to-end workflow

# skills/zhanggui-finishing-a-development-branch/SKILL.md
description: Use when verified branch or worktree work only needs the explicit choice to merge, push a PR, keep, or discard; defer to the zhanggui root when finishing is the last step of an explicit or end-to-end workflow it owns
```

Only replace frontmatter descriptions. Do not edit any leaf procedure body.

- [ ] **Step 4: Run GREEN checks**

Run:

```bash
node --test --test-name-pattern="discoverable dual-mode leaf skill" tests/skill-discovery.test.mjs
node scripts/validate-agent-skills.mjs
```

Expected: eight leaf discovery tests pass; all nine skills validate.

- [ ] **Step 5: Commit Task 2**

```bash
git add tests/skill-discovery.test.mjs skills/zhanggui-*/SKILL.md
git commit -m "feat(zhanggui): separate root and leaf auto routing"
```

### Task 3: Replace Trigger v1 with the Tagged v2 Case Matrix

**Files:**
- Modify: `tests/skill-trigger-data.test.mjs:1-141`
- Modify: `evals/skill-triggering.json:1-178`

**Interfaces:**
- Consumes: the nine final Task 2 catalog descriptions and all 108 v0.6 prompt strings.
- Produces: `TriggerCase` objects with stable IDs and a pinned ordered digest `42b30e2b65a289a035b4f585f36ac053d110eaae2847e749329b347ba3eb6af5`.

`TriggerCase` is:

```ts
type TriggerCase = {
  id: string;
  prompt: string;
  source: 'explicit' | 'implicit';
  expected_skill: string | null;
  expected_first: string | null;
  forbidden_skills: string[];
  tags: string[];
};
```

- [ ] **Step 1: Replace the trigger-data test with the v2 contract**

Use this complete target test file:

```js
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
```

- [ ] **Step 2: Run the trigger-data test and confirm RED**

Run:

```bash
node --test tests/skill-trigger-data.test.mjs
```

Expected: failures for version `1`, missing `runs_per_case`, missing `thresholds`, and missing `cases`.

- [ ] **Step 3: Convert all 108 baseline strings and append 14 exact Hybrid cases**

Use an incremental JS eval cell with the harness `read` and `write` functions. Preserve the current v1 object in memory before overwriting it. Apply this deterministic mapping:

```js
const legacy = JSON.parse(await read('evals/skill-triggering.json'));
const normalizeSkillId = name => name.replace(/^zhanggui-?/, '') || 'root';
const migrated = legacy.skills.flatMap(item => {
  const prefix = normalizeSkillId(item.name);
  const positives = item.should_trigger.map((prompt, index) => ({
    id: `${prefix}-baseline-positive-${String(index + 1).padStart(2, '0')}`,
    prompt,
    source: item.name === 'zhanggui' ? 'explicit' : 'implicit',
    expected_skill: item.name,
    expected_first: item.name,
    forbidden_skills: [],
    tags: item.name === 'zhanggui'
      ? ['baseline-positive', 'root-positive', 'explicit-root']
      : ['baseline-positive', 'leaf-positive'],
  }));
  const negatives = item.should_not_trigger.map((prompt, index) => ({
    id: `${prefix}-baseline-negative-${String(index + 1).padStart(2, '0')}`,
    prompt,
    source: 'implicit',
    expected_skill: null,
    expected_first: null,
    forbidden_skills: [item.name],
    tags: item.name === 'zhanggui'
      ? ['baseline-negative', 'root-near-miss']
      : ['baseline-negative', 'leaf-near-miss'],
  }));
  return [...positives, ...negatives];
});

const implicitRoot = [
  { id: 'root-implicit-ambiguous-01', prompt: '我只有一个模糊的库存产品想法，请先查清需求和约束，再设计、实现并验证交付', source: 'implicit', expected_skill: 'zhanggui', expected_first: 'zhanggui', forbidden_skills: [], tags: ['root-positive', 'implicit-root', 'ambiguous'] },
  { id: 'root-implicit-cross-module-01', prompt: 'Take this cross-module order, inventory, and notification change from discovery and design through implementation and verified delivery.', source: 'implicit', expected_skill: 'zhanggui', expected_first: 'zhanggui', forbidden_skills: [], tags: ['root-positive', 'implicit-root', 'cross-module'] },
  { id: 'root-implicit-multi-deliverable-01', prompt: '完成包含 API、后台任务和迁移脚本的多个交付物，从设计、实现、独立审查到验证都纳入一套可恢复流程', source: 'implicit', expected_skill: 'zhanggui', expected_first: 'zhanggui', forbidden_skills: [], tags: ['root-positive', 'implicit-root', 'multi-deliverable', 'root-first-conflict'] },
  { id: 'root-implicit-end-to-end-01', prompt: 'Own this end-to-end permissions redesign: resolve the open decisions, implement it with TDD, and carry it through final verification.', source: 'implicit', expected_skill: 'zhanggui', expected_first: 'zhanggui', forbidden_skills: [], tags: ['root-positive', 'implicit-root', 'end-to-end', 'root-first-conflict'] },
  { id: 'root-implicit-resume-01', prompt: '恢复 .tasks 中有 checkpoint 的长期支付改造，按原决策和进度继续到验证交付', source: 'implicit', expected_skill: 'zhanggui', expected_first: 'zhanggui', forbidden_skills: [], tags: ['root-positive', 'implicit-root', 'checkpoint-resume'] },
  { id: 'root-implicit-migration-01', prompt: 'A cross-service migration has a failing integration test; own the effort from root-cause analysis through rollout design and verified delivery.', source: 'implicit', expected_skill: 'zhanggui', expected_first: 'zhanggui', forbidden_skills: [], tags: ['root-positive', 'implicit-root', 'migration', 'root-first-conflict'] },
  { id: 'root-implicit-security-01', prompt: '端到端完成这项多模块安全改造：隔离工作区、设计、实现、独立审查和验证都纳入同一流程', source: 'implicit', expected_skill: 'zhanggui', expected_first: 'zhanggui', forbidden_skills: [], tags: ['root-positive', 'implicit-root', 'cross-module', 'root-first-conflict'] },
  { id: 'root-implicit-parallel-delivery-01', prompt: 'Coordinate the independent frontend and backend deliverables, but keep discovery, design decisions, integration, and verified delivery in one recoverable workflow.', source: 'implicit', expected_skill: 'zhanggui', expected_first: 'zhanggui', forbidden_skills: [], tags: ['root-positive', 'implicit-root', 'multi-deliverable', 'root-first-conflict'] },
];

const rootNearMisses = [
  { id: 'root-near-miss-tdd-01', prompt: '在这个大型项目里只用 TDD 实现已明确的单个折扣函数，不做设计或完整交付', source: 'implicit', expected_skill: 'zhanggui-test-driven-development', expected_first: 'zhanggui-test-driven-development', forbidden_skills: ['zhanggui'], tags: ['root-near-miss', 'reverse-conflict', 'tdd'] },
  { id: 'root-near-miss-debug-01', prompt: 'Complete the root-cause investigation for this one flaky test; do not design or deliver a broader project.', source: 'implicit', expected_skill: 'zhanggui-systematic-debugging', expected_first: 'zhanggui-systematic-debugging', forbidden_skills: ['zhanggui'], tags: ['root-near-miss', 'reverse-conflict', 'debugging'] },
  { id: 'root-near-miss-verify-01', prompt: '只为当前单模块修复运行完成前验证，不启动端到端工作流', source: 'implicit', expected_skill: 'zhanggui-verification-before-completion', expected_first: 'zhanggui-verification-before-completion', forbidden_skills: ['zhanggui'], tags: ['root-near-miss', 'verification'] },
  { id: 'root-near-miss-review-01', prompt: 'Review this cross-module diff only; do not implement, plan, or own end-to-end delivery.', source: 'implicit', expected_skill: 'zhanggui-requesting-code-review', expected_first: 'zhanggui-requesting-code-review', forbidden_skills: ['zhanggui'], tags: ['root-near-miss', 'reverse-conflict', 'requesting-review'] },
  { id: 'root-near-miss-parallel-01', prompt: '并行调查三个已有边界且互不相关的问题，只汇总结果，不重新设计或接管完整交付', source: 'implicit', expected_skill: 'zhanggui-dispatching-parallel-agents', expected_first: 'zhanggui-dispatching-parallel-agents', forbidden_skills: ['zhanggui'], tags: ['root-near-miss', 'parallel-agents'] },
  { id: 'root-near-miss-finishing-01', prompt: '这个复杂项目已经验证完成，只选择 merge、PR、keep 或 discard 进行分支收尾', source: 'implicit', expected_skill: 'zhanggui-finishing-a-development-branch', expected_first: 'zhanggui-finishing-a-development-branch', forbidden_skills: ['zhanggui'], tags: ['root-near-miss', 'reverse-conflict', 'branch-finishing'] },
];

const target = {
  version: 2,
  runs_per_case: 3,
  thresholds: {
    explicit_root_rate: 1,
    implicit_root_rate_gte: 0.8,
    root_false_positive_rate_lte: 0.1,
    root_first_conflict_rate: 1,
  },
  cases: [...migrated, ...implicitRoot, ...rootNearMisses],
};
await write('evals/skill-triggering.json', `${JSON.stringify(target, null, 2)}\n`);
```

- [ ] **Step 4: Run GREEN and confirm the exact matrix**

Run:

```bash
node --test tests/skill-trigger-data.test.mjs
```

Expected: four passing tests, 122 cases, and digest `42b30e2b65a289a035b4f585f36ac053d110eaae2847e749329b347ba3eb6af5`.

- [ ] **Step 5: Commit Task 3**

```bash
git add tests/skill-trigger-data.test.mjs evals/skill-triggering.json
git commit -m "test(zhanggui): add hybrid routing case matrix"
```

### Task 4: Run and Pin the Full Catalog Routing Evaluation

**Files:**
- Modify: `tests/skill-trigger-data.test.mjs`
- Create: `evals/results/v0.7-routing-summary.json`

**Interfaces:**
- Consumes: Task 3's 122 cases, three runs per case, and the exact nine-entry catalog snapshot.
- Produces: 366 scored slots, separate transport accounting, per-gate rates, per-leaf baseline rates, failures, and matching data/catalog SHA-256 values.

- [ ] **Step 1: Add a failing summary contract**

Add summary loading beside dataset loading:

```js
const summaryPath = path.join(projectRoot, 'evals', 'results', 'v0.7-routing-summary.json');
let summary;
let summaryLoadError;
try {
  summary = JSON.parse(await readFile(summaryPath, 'utf8'));
} catch (error) {
  summaryLoadError = error;
}
```

Add these tests:

```js
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
});
```

- [ ] **Step 2: Run RED before generating the summary**

Run:

```bash
node --test tests/skill-trigger-data.test.mjs
```

Expected: existing four dataset tests pass and the three new summary tests fail because `v0.7-routing-summary.json` does not exist.

- [ ] **Step 3: Execute 366 catalog selections with a fixed rubric**

Use the Oh My Pi eval kernel's `completion` helper with model `default`, structured output, a maximum concurrency of 24, and this exact evaluator system prompt:

```text
You are evaluating first-skill routing for an Agent Skills catalog. Based only on each catalog entry's name and description, the invocation source, and the user request, select the single skill that should load first. Return null when no skill applies. Do not execute any skill, solve the user's task, or select a later lifecycle substep. An explicit source means the user intentionally invoked the root named by the request; an implicit source contains no host command guarantee.
```

Use this result schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "selected_skill": {
      "anyOf": [
        { "type": "string", "enum": [
          "zhanggui",
          "zhanggui-systematic-debugging",
          "zhanggui-test-driven-development",
          "zhanggui-verification-before-completion",
          "zhanggui-requesting-code-review",
          "zhanggui-receiving-code-review",
          "zhanggui-using-git-worktrees",
          "zhanggui-dispatching-parallel-agents",
          "zhanggui-finishing-a-development-branch"
        ] },
        { "type": "null" }
      ]
    },
    "reason": { "type": "string" }
  },
  "required": ["selected_skill", "reason"]
}
```

Build each `completion` prompt with this exact function:

```js
const evaluatorPrompt = item => [
  `Catalog: ${JSON.stringify(catalog)}`,
  `Invocation source: ${item.source}`,
  `User request: ${item.prompt}`,
].join('\n');
```

A slot passes only when all applicable conditions hold:

```js
const passes = item =>
  (item.case.expected_skill === null || item.selected_skill === item.case.expected_skill)
  && !item.case.forbidden_skills.includes(item.selected_skill)
  && (item.case.expected_first === null || item.selected_skill === item.case.expected_first);
```

Run each `id` three times. Record all initial attempts. Retry only transport exceptions for up to three waves with backoffs `[0, 5, 15]` seconds; preserve `initial_errors`, `retry_attempts`, `retry_successes`, `retry_wave_results`, and `retry_errors_remaining_after_last_wave`. Do not retry a valid but wrong selection.

- [ ] **Step 4: Compute rates and write the observed summary**

Compute rates from the original 366-slot denominator:

```js
const rateForTag = (slots, tag, predicate) => {
  const selected = slots.filter(item => item.case.tags.includes(tag));
  return selected.filter(predicate).length / selected.length;
};

const rates = {
  explicit_root: rateForTag(slots, 'explicit-root', item => item.selected_skill === 'zhanggui'),
  implicit_root: rateForTag(slots, 'implicit-root', item => item.selected_skill === 'zhanggui'),
  root_false_positive: rateForTag(slots, 'root-near-miss', item => item.selected_skill === 'zhanggui'),
  root_first_conflict: rateForTag(slots, 'root-first-conflict', item => item.selected_skill === 'zhanggui'),
};
```

For each leaf, compute `positive_trigger_rate` from `baseline-positive` cases whose `expected_skill` is that leaf and `negative_trigger_rate` from `baseline-negative` cases whose `forbidden_skills` contains that leaf. Include every wrong valid selection in `failures` with `case_id`, `run`, `expected`, `forbidden`, and `actual`.

Construct the summary from observed variables, preserving this top-level field order:

```js
const datasetDigest = '42b30e2b65a289a035b4f585f36ac053d110eaae2847e749329b347ba3eb6af5';
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
const baselinePassed = leafBaselines.every(item =>
  item.positive_trigger_rate === 1
  && item.negative_trigger_rate <= negativeCeilings.get(item.name),
);
const passed = rates.explicit_root === data.thresholds.explicit_root_rate
  && rates.implicit_root >= data.thresholds.implicit_root_rate_gte
  && rates.root_false_positive <= data.thresholds.root_false_positive_rate_lte
  && rates.root_first_conflict === data.thresholds.root_first_conflict_rate
  && baselinePassed
  && retryErrorsRemaining === 0;

const summary = {
  version: '0.7',
  runs_per_case: data.runs_per_case,
  total_cases: data.cases.length,
  total_runs: slots.length,
  rates,
  leaf_baselines: leafBaselines,
  failures,
  passed,
  dataset_snapshot: {
    sha256: datasetDigest,
    case_count: data.cases.length,
  },
  catalog_snapshot: {
    source_head: sourceHead,
    sha256: catalogDigest,
    entries,
  },
  routing_evaluation: {
    model: 'default',
    tool: 'completion',
    scored_at: new Date().toISOString(),
    scored_slots: slots.length,
    initial_attempts: initialAttempts,
    initial_successes: initialSuccesses,
    initial_errors: initialErrors,
    retry_waves: retryWaveCount,
    retry_attempts: retryAttempts,
    retry_successes: retrySuccesses,
    retry_errors_remaining_after_last_wave: retryErrorsRemaining,
    total_attempts: initialAttempts + retryAttempts,
    transport_errors_scored: false,
    retry_policy: {
      max_waves: 3,
      backoff_seconds: [0, 5, 15],
      retry_scope: 'transport-errors-only',
      valid_wrong_selections_retryable: false,
    },
    thresholds: data.thresholds,
  },
};
```

`sourceHead` is the exact commit containing the evaluated descriptions and dataset. `catalogDigest` is SHA-256 of `JSON.stringify(entries)`, where every entry is `{name, description, implicit: true}` in `expectedSkills` order. Derive all attempt counters from actual execution results; never hardcode `passed`, a rate, or an error count.

- [ ] **Step 5: Run GREEN; tune descriptions only if a gate fails**

Run:

```bash
node --test tests/skill-trigger-data.test.mjs
```

Expected: seven passing tests. If a gate fails, inspect failures, adjust only the responsible root or leaf description, rerun all 366 slots, replace the entire summary, and rerun the test. Never patch rates or remove a failing case.

- [ ] **Step 6: Commit Task 4**

```bash
git add tests/skill-trigger-data.test.mjs evals/results/v0.7-routing-summary.json skills/zhanggui/SKILL.md skills/zhanggui-*/SKILL.md
git commit -m "test(zhanggui): verify selective hybrid routing"
```

### Task 5: Prove Manual Root, Automatic Root, Narrow Leaves, and Fallback on a Clean Host

**Files:**
- Modify: `tests/skill-trigger-data.test.mjs`
- Modify: `evals/results/v0.7-routing-summary.json`

**Interfaces:**
- Consumes: the passing Task 4 catalog and summary.
- Produces: six supported OMP cases, one explicitly unsupported alias probe, event-ordered root-first evidence, and a static host-acceptance test.

- [ ] **Step 1: Add a failing host-acceptance summary test**

Append:

```js
test('v0.7 host acceptance proves hybrid root and narrow leaf behavior', () => {
  assert.ifError(summaryLoadError);
  const host = summary.host_acceptance;
  assert.equal(host.host, 'omp');
  assert.equal(host.session_persistence, false);
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
  assert.equal(host.cases.find(item => item.id === 'native-root-implicit').first_skill, 'zhanggui');
  assert.equal(host.cases.find(item => item.id === 'native-root-implicit').announcement_observed, true);
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
```

- [ ] **Step 2: Run RED before recording host evidence**

Run:

```bash
node --test tests/skill-trigger-data.test.mjs
```

Expected: seven prior tests pass; the new host test fails because `host_acceptance` is absent.

- [ ] **Step 3: Run native explicit root interactively**

Start OMP through the harness process manager, not a detached shell. Set `cwd` to the plugin root containing `.codex-plugin/plugin.json` and use:

```text
application: omp
args: --no-session --no-rules --plugin-dir . --skills zhanggui* --max-time 60
input: /skill:zhanggui 设计并验证一个最小库存功能
```

Record a pass only when the TUI shows `skill zhanggui`, the path ends in `skills/zhanggui/SKILL.md`, and injection occurs before model work. Set `root_first: true` from this event order. Stop the process after collecting evidence.

- [ ] **Step 4: Run five finite JSONL host cases**

Run each command from a distinct empty system-temp `--cwd` (not the contaminated repo cwd) in a fresh `--no-session` process:

```bash
omp --no-session --no-rules --cwd "$EMPTY_TEMP" --plugin-dir "$PLUGIN_ROOT" --skills "zhanggui*" --mode json --max-time 120 -p "我只有一个模糊的库存产品想法，请先查清需求和约束，再设计、实现并验证交付"
omp --no-session --no-rules --cwd "$EMPTY_TEMP" --plugin-dir "$PLUGIN_ROOT" --skills "zhanggui*" --mode json --max-time 120 -p "这个单元测试失败了，先系统化调查根因"
omp --no-session --no-rules --cwd "$EMPTY_TEMP" --plugin-dir "$PLUGIN_ROOT" --skills "zhanggui*" --mode json --max-time 120 -p "Own this end-to-end permissions redesign: resolve the open decisions, implement it with TDD, and carry it through final verification."
omp --no-session --no-rules --cwd "$EMPTY_TEMP" --plugin-dir "$PLUGIN_ROOT" --skills "zhanggui*" --mode json --max-time 120 -p "Review this cross-module diff only; do not implement, plan, or own end-to-end delivery."
omp --no-session --no-rules --no-skills --cwd "$EMPTY_TEMP" --append-system-prompt "$PLUGIN_ROOT/skills/zhanggui/SKILL.md" --add-dir "$PLUGIN_ROOT/skills" --mode json --max-time 120 -p "/zhanggui 调查一个测试失败；使用已安装 collection 的 fallback 加载调试流程。Installed collection root: $PLUGIN_ROOT/skills"
```

Pass requirements:

- Implicit complex prompt: first `skill://` read is `skill://zhanggui`; assistant output starts with the exact catalog-visible marker `已自动进入 Zhanggui 完整工作流：` before the first non-skill tool call.
- Narrow debug: first and only initial Direct skill is `zhanggui-systematic-debugging`; root does not precede it.
- End-to-end conflict: first `skill://` read is `skill://zhanggui`; TDD or verification may appear only later through root-owned flow.
- Narrow review: first initial Direct skill is `zhanggui-requesting-code-review`; root does not precede it.
- Fallback: root reads the exact collection file for `zhanggui-systematic-debugging`, verifies matching frontmatter name, and does not use a native skill URI.

Use JSONL `tool_execution_start`/`tool_execution_end` and TUI injection events as evidence. Assistant prose alone is not an activation event.

- [ ] **Step 5: Retain the unsupported OMP alias probe**

Run:

```bash
omp --no-session --no-rules --cwd "$EMPTY_TEMP" --plugin-dir "$PLUGIN_ROOT" --skills "zhanggui*" --mode json --max-time 120 -p "/zhanggui 设计并验证一个最小库存功能"
```

Record it under `known_host_limitations.noninteractive_alias_probe` with `supported: false` and `excluded_from_supported_totals: true`. Do not require it to select root first because OMP `-p` treats unknown slash commands as model text.

- [ ] **Step 6: Write observed host evidence into the summary**

Build `supportedCases` directly from the six observed command outputs and `unsupportedAliasProbe` from Step 5. Then use this exact construction; calculated fields must come from those records:

```js
assert.equal(supportedCases.length, 6);
assert.ok(supportedCases.every(item => item.pass === true));

const hostAcceptance = {
  recorded_at: new Date().toISOString(),
  host: 'omp',
  mode: 'interactive-explicit-root+jsonl-hybrid+collection-fallback',
  profile: 'existing authenticated profile',
  session_persistence: false,
  cases: supportedCases,
  summary: {
    supported_cases_total: supportedCases.length,
    supported_cases_passed: supportedCases.filter(item => item.pass).length,
    supported_cases_failed: supportedCases.filter(item => !item.pass).length,
    unsupported_probes_recorded: 1,
    unsupported_probes_excluded_from_totals: true,
  },
  all_passed: supportedCases.every(item => item.pass),
  known_host_limitations: {
    noninteractive_alias_probe: unsupportedAliasProbe,
  },
};

summary.host_acceptance = hostAcceptance;
await write(
  'evals/results/v0.7-routing-summary.json',
  `${JSON.stringify(summary, null, 2)}\n`,
);
```

Every case record must copy command, prompt or interactive input, expected skill, event names, activation events, observed first skill, and pass status from actual output. Do not commit the file if any supported case is false or missing evidence.

- [ ] **Step 7: Run GREEN and commit Task 5**

Run:

```bash
node --test tests/skill-trigger-data.test.mjs
```

Expected: eight passing tests and `host_acceptance.all_passed === true`.

Commit:

```bash
git add tests/skill-trigger-data.test.mjs evals/results/v0.7-routing-summary.json
git commit -m "test(zhanggui): record hybrid host acceptance"
```

### Task 6: Publish the v0.7 Package and Runtime Documentation

**Files:**
- Modify: `tests/skill-discovery.test.mjs:122-153`
- Modify: `.codex-plugin/plugin.json:1-38`
- Modify: `README.md`
- Modify: `docs/skill-fusion-design.md`
- Modify: `docs/superpowers/specs/2026-07-25-selective-hybrid-invocation-design.md:1-6`

**Interfaces:**
- Consumes: passing Task 4 routing gates and Task 5 clean-host evidence.
- Produces: one truthful v0.7 package description and usage contract; no runtime logic changes.

- [ ] **Step 1: Replace the manifest test with a failing v0.7 contract**

Rename `assertPluginManifestV06` to `assertPluginManifestV07` and replace its body with:

```js
function assertPluginManifestV07(manifest) {
  assert.equal(manifest.skills, './skills/');
  assert.equal(manifest.version, '0.7.0');
  assert.equal(
    manifest.description,
    'Nine strict Agent Skills: one selective-hybrid stateful Zhanggui orchestrator and eight dual-mode engineering leaves.',
  );
  assert.match(manifest.interface.shortDescription, /selective-hybrid root/i);
  assert.match(manifest.interface.shortDescription, /eight dual-mode leaves/i);
  assert.match(manifest.interface.longDescription, /Nine strict Agent Skills/i);
  assert.match(manifest.interface.longDescription, /automatic or manual/i);
  assert.match(manifest.interface.longDescription, /eight zhanggui-\* leaves/i);
  assert.ok(manifest.interface.defaultPrompt.some(line => /automatically match Zhanggui/i.test(line)));
  assert.ok(manifest.interface.defaultPrompt.some(line => /narrow task/i.test(line)));
}
```

Rename the test to `plugin manifest pins v0.7 hybrid packaging contract`, change its mutation probe to `0.6.0`, and call `assertPluginManifestV07` for both mutation and real manifest.

- [ ] **Step 2: Run RED for stale v0.6 package metadata**

Run:

```bash
node --test --test-name-pattern="plugin manifest" tests/skill-discovery.test.mjs
```

Expected: failure on version and explicit-only host-extended wording.

- [ ] **Step 3: Replace plugin metadata exactly**

Set:

```json
{
  "name": "zhanggui",
  "version": "0.7.0",
  "description": "Nine strict Agent Skills: one selective-hybrid stateful Zhanggui orchestrator and eight dual-mode engineering leaves.",
  "author": {
    "name": "zhanglu"
  },
  "license": "MIT",
  "keywords": [
    "planning",
    "debugging",
    "tdd",
    "verification",
    "code-review",
    "worktree",
    "workflow"
  ],
  "skills": "./skills/",
  "hooks": {},
  "interface": {
    "displayName": "Zhanggui（掌柜）",
    "shortDescription": "One selective-hybrid root and eight dual-mode leaves",
    "longDescription": "Nine strict Agent Skills: one selective-hybrid stateful Zhanggui orchestrator with automatic or manual loading, plus eight zhanggui-* leaves with Direct and Zhanggui Embedded contracts. The root owns WorkflowState and activates leaves by SkillRequest; narrow requests stay with their corresponding leaf.",
    "developerName": "zhanglu",
    "category": "Developer Tools",
    "capabilities": [
      "Interactive",
      "Read",
      "Write"
    ],
    "defaultPrompt": [
      "复杂、跨模块或端到端工作可直接描述，由宿主自动匹配 Zhanggui；也可使用宿主原生命令手动进入。",
      "Describe a complex end-to-end goal to automatically match Zhanggui, or describe a narrow task to match its engineering leaf."
    ],
    "brandColor": "#10B981",
    "screenshots": []
  }
}
```

- [ ] **Step 4: Update README runtime and verification copy**

Make these exact semantic changes without duplicating the root body:

- Title becomes `# Zhanggui（掌柜）v0.7`.
- Opening says nine strict Agent Skills: one selective-hybrid stateful root and eight dual-mode leaves.
- Quick usage presents automatic complex entry first, then OMP interactive `/skill:zhanggui` as deterministic manual entry.
- Runtime tree calls `skills/zhanggui/` a selective-hybrid strict orchestrator.
- Host invocation model removes both explicit-only claims and says all nine descriptions are catalog-visible.
- Validator expected output becomes `Validated 9 strict Agent Skills.`
- Trigger section points to `evals/results/v0.7-routing-summary.json`, 122 cases, and 366 slots.
- Clean-host section lists the six supported Task 5 cases and retains the unsupported noninteractive alias note.
- Installation still requires the complete collection and warns against enabling a second strong orchestration entry.

Use this concise usage block:

```markdown
## 快速使用

复杂、跨模块、多交付物、checkpoint 恢复或明确端到端的请求可以直接描述；支持 model-selected skills 的宿主会选择性自动加载 `zhanggui`，根在首次工具调用前说明进入原因。调试、TDD、验证、审查、反馈、worktree、并行派发和分支收尾等窄请求仍由对应 leaf 自动匹配。

需要确定性进入完整流程时，只显式调用一次根：

- **OMP 交互式**：`/skill:zhanggui`
- **提供同名 alias 的宿主**：`/zhanggui`

阶段切换和 Embedded leaf handoff 不要求继续输入命令。
```

- [ ] **Step 5: Update the runtime authority document**

In `docs/skill-fusion-design.md`:

- Change status/version references from v0.6 explicit-only root to v0.7 selective-Hybrid strict root.
- Replace goals and non-goals that require manual-only root with the Task 1 priority contract.
- Replace `Strict leaf / host root` wording with nine strict catalog entries and one stateful root owner.
- Add `Explicit`, `Implicit`, root-first, and narrow-task de-escalation subsections.
- Update trigger and host-evidence references to v0.7.
- Preserve `SkillRequest`/`SkillResult`, stage ownership, WorkflowState, owner, prototype, tracker, recovery, and leaf Direct/Embedded sections unchanged.
- Replace acceptance scenario 15 with selective Hybrid discovery.
- Append these acceptance scenarios:

```markdown
43. 无命令的模糊、跨模块或端到端请求 -> 自动加载 `zhanggui`，首次工具调用前说明真实进入原因，不额外询问是否启用。
44. 无命令的孤立 debugging/TDD/verification/review/feedback/worktree/parallel/finishing 请求 -> 对应 leaf 以 Direct 模式先执行，根不抢占。
45. 宿主原生命令显式调用根 -> root-first；窄意图也由根通过最小 state + Embedded leaf 处理。
46. 端到端请求包含 bug、TDD、review 或 worktree 子步骤 -> 根先加载；leaf 不得先以 Direct 模式产生动作。
47. 根隐式误匹配后发现窄意图 -> 可降级到最小 route state + Embedded leaf，但 trigger eval 仍计为 root false positive。
```

- [ ] **Step 6: Mark the approved spec as the implementation truth**

Change only its status line to:

```markdown
**状态：** 已确认，v0.7 实施真值  
```

Do not claim implementation is complete before final verification.

- [ ] **Step 7: Run GREEN and documentation consistency checks**

Run:

```bash
node --test --test-name-pattern="plugin manifest" tests/skill-discovery.test.mjs
node --test
node scripts/validate-agent-skills.mjs
```

Use the repository search tool to confirm no current v0.7 runtime or README statement still says `explicit-only`, `host-extended root`, `allow_implicit_invocation: false`, or `v0.6-routing-summary.json`. Historical v0.6 result artifacts and the superseded v0.6 design spec may retain their evidence.

Expected: all Node tests pass with zero failures/todos; nine strict skills validate; no stale current-runtime matches.

- [ ] **Step 8: Commit Task 6**

```bash
git add .codex-plugin/plugin.json README.md docs/skill-fusion-design.md docs/superpowers/specs/2026-07-25-selective-hybrid-invocation-design.md tests/skill-discovery.test.mjs
git commit -m "docs(zhanggui): publish v0.7 hybrid invocation contract"
```

### Task 7: Whole-Branch Review, Fresh Verification, and Branch Handoff

**Files:**
- Inspect: every file changed since the v0.6 baseline
- Modify only when a concrete review finding requires it

**Interfaces:**
- Consumes: all six completed implementation tasks and the approved design truth.
- Produces: independent spec/quality review, fresh command evidence, clean supported-host evidence, and a finishing-a-development-branch choice without automatic merge or deletion.

- [ ] **Step 1: Request independent whole-branch review**

Use `zhanggui-requesting-code-review` or `superpowers:requesting-code-review` with:

```text
Scope: v0.6 baseline through current HEAD
Contract: docs/superpowers/specs/2026-07-25-selective-hybrid-invocation-design.md
Review axes: complete spec coverage and code/skill quality
Required focus: root/leaf mutual exclusion, no hidden state field, v2 scoring correctness, digest integrity, host evidence truthfulness, stale explicit-only claims
Severity output: Critical, Important, Minor
```

Do not accept a review based only on a summary; inspect each finding against the actual files.

- [ ] **Step 2: Process findings rigorously**

Use `zhanggui-receiving-code-review` or `superpowers:receiving-code-review`. For every Critical or Important finding:

1. Restate the exact violated contract.
2. Reproduce it with the smallest relevant test or artifact check.
3. Add or adjust the failing contract test when the finding exposes an unguarded behavior.
4. Apply one root-cause fix.
5. Rerun the focused test and the affected routing or host evidence.

Commit accepted fixes with a scoped message. Reject incorrect findings with file-and-line evidence.

- [ ] **Step 3: Run final fresh verification**

Read the verification-before-completion skill, then run the full commands from a clean process:

```bash
node --check tests/skill-discovery.test.mjs
node --check tests/skill-routing-contract.test.mjs
node --check tests/skill-trigger-data.test.mjs
node --check scripts/validate-agent-skills.mjs
node --test
node scripts/validate-agent-skills.mjs
```

Then verify from `evals/results/v0.7-routing-summary.json`:

- 122 cases and 366 original slots.
- Explicit root `1.0`.
- Implicit root at least `0.80`.
- Root false-positive at most `0.10`.
- Root-first conflicts `1.0`.
- Dataset and catalog digests match current content.
- Six supported host cases pass; one unsupported alias probe is excluded.

Completion may be claimed only from these fresh outputs, not Task 4 or Task 5 memories.

- [ ] **Step 4: Commit any final review fixes**

If review produced file changes, take the exact changed paths from the accepted finding's edit responses, stage only those paths, and then run:

```bash
git commit -m "fix(zhanggui): close v0.7 review findings"
```

Do not stage unrelated work. If review produced no changes, do not create an empty commit.

- [ ] **Step 5: Use finishing-a-development-branch**

Read the finishing skill, verify tests once more if its evidence freshness rule requires it, detect the actual branch/worktree environment, and present exactly the supported merge, PR, keep, or discard choices. Do not merge, push, remove the worktree, or discard work without the user's selection.
