# Zhanggui Standards-Aligned Skill Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Zhanggui v0.5 升级为 v0.6：八个严格 Agent Skills、一个明确的宿主扩展根编排器、统一 SkillRequest/SkillResult 路由、可验证的触发与宿主激活证据。

**Architecture:** `/zhanggui` 是唯一 Embedded SkillRequest 消费者和 WorkflowState 所有者；内部 stages 只返回请求，leaf 只返回结果。根优先使用宿主原生 skill activation，其次 catalog location，最后使用受控 collection fallback；Direct leaf 继续独立闭环。

**Tech Stack:** Agent Skills Markdown、Node.js 24 `node:test`、官方 `skills-ref`（通过 `uvx` 固定 revision）、OMP JSONL clean-run smoke tests。

## Global Constraints

- 八个 leaf 必须严格通过 Agent Skills reference validator。
- 根必须明确为 host-extended orchestrator，不宣称 strict Agent Skills。
- 根的唯一非标准顶层字段必须是 `disable-model-invocation`。
- 根 description 必须写明只有用户显式调用 `/zhanggui` 时使用。
- 五个 stateful stages 保持内部 `STAGE.md`，不参与 discovery。
- 所有 Embedded leaf activation 必须经过根的 SkillRequest。
- 激活优先级固定为 native activation → catalog location → collection sibling fallback。
- Stage 和 Embedded leaf 不得直接加载 sibling skill 或拥有 WorkflowState、tracker、return point、readiness。
- Direct leaf 可以本地提问、处理分支并以自身 Completion Contract 结束。
- 不改变八个 leaf 的专业流程，只迁移发现、激活、所有权和结果 envelope。
- 任意缺失、身份不匹配、模式不支持、输入不完整或越权 delta 必须显式 blocked；禁止静默 fallback 成成功。
- 新行为严格 TDD：先看到针对正确缺口的 RED，再写 Markdown/runtime contract 使其 GREEN。
- 每个任务完成后提交一次，提交前运行该任务的 focused test 和完整 Node suite。
- 所有 Node、validator、eval 和 OMP 命令从 worktree 的 `zhanggui/` 目录运行；所有 `git add` / `git commit` 命令从 worktree 根运行。

---

## File Map

| File | Responsibility |
|---|---|
| `tests/skill-routing-contract.test.mjs` | Root profile、SkillRequest/SkillResult、stage/leaf ownership、fallback registry 的静态合同测试 |
| `tests/skill-trigger-data.test.mjs` | Trigger dataset schema、覆盖数量、重复和相邻边界检查 |
| `tests/skill-discovery.test.mjs` | 保持 discovery、path、dual-mode 基础合同；补 root description/extension 精确约束 |
| `scripts/validate-agent-skills.mjs` | 固定版本调用官方 `skills-ref`，严格验证八个 leaf，并验证剥离唯一宿主扩展后的 root |
| `evals/skill-triggering.json` | 九个技能的版本化 should-trigger / near-miss 数据集 |
| `evals/results/v0.6-routing-summary.json` | 三次重复 catalog eval 与真实宿主 smoke 的结果摘要 |
| `skills/zhanggui/SKILL.md` | Host profile、SkillRequest/SkillResult、activation、merge、fallback registry、统一路由表 |
| `skills/zhanggui/stages/executing-plans/STAGE.md` | 将直接 sibling loads 改为返回 SkillRequest |
| `skills/zhanggui-systematic-debugging/SKILL.md` | Embedded SkillResult；parallel/TDD 依赖改为 next SkillRequest |
| `skills/zhanggui-test-driven-development/SKILL.md` | Embedded SkillResult envelope |
| `skills/zhanggui-verification-before-completion/SKILL.md` | Embedded SkillResult envelope |
| `skills/zhanggui-requesting-code-review/SKILL.md` | Embedded SkillResult envelope |
| `skills/zhanggui-receiving-code-review/SKILL.md` | Embedded SkillResult envelope |
| `skills/zhanggui-using-git-worktrees/SKILL.md` | Embedded SkillResult；finishing 依赖按 name 表达 |
| `skills/zhanggui-dispatching-parallel-agents/SKILL.md` | Embedded SkillResult；worktree/review 依赖按 name/next request 表达 |
| `skills/zhanggui-finishing-a-development-branch/SKILL.md` | Embedded SkillResult；verification 依赖按 name/next request 表达 |
| `.codex-plugin/plugin.json` | v0.6 metadata |
| `README.md` | strict leaves / host root、统一路由和安装说明 |
| `docs/skill-fusion-design.md` | v0.6 权威运行架构 |

---

### Task 1: Root Compliance Profile and Activation Foundation

**Files:**
- Create: `tests/skill-routing-contract.test.mjs`
- Modify: `tests/skill-discovery.test.mjs`
- Modify: `skills/zhanggui/SKILL.md`

**Interfaces:**
- Consumes: Approved design `docs/superpowers/specs/2026-07-25-skill-standardization-design.md` sections 5–9.
- Produces: Stable `SkillRequest`, `SkillResult`, root activation priority, fallback registry and merge rejection rules used by every later task.

- [ ] **Step 1: Write the failing root profile and routing tests**

Create `tests/skill-routing-contract.test.mjs` with this foundation:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(projectRoot, 'skills');
const rootPath = path.join(skillsRoot, 'zhanggui', 'SKILL.md');

const leafNames = [
  'zhanggui-systematic-debugging',
  'zhanggui-test-driven-development',
  'zhanggui-verification-before-completion',
  'zhanggui-requesting-code-review',
  'zhanggui-receiving-code-review',
  'zhanggui-using-git-worktrees',
  'zhanggui-dispatching-parallel-agents',
  'zhanggui-finishing-a-development-branch',
];

function frontmatterKeys(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  assert.ok(match, 'missing frontmatter');
  return match[1]
    .split(/\r?\n/)
    .filter(line => /^[a-z][a-z-]*:/.test(line))
    .map(line => line.slice(0, line.indexOf(':')));
}

function section(content, heading, nextHeading) {
  const start = content.indexOf(heading);
  assert.notEqual(start, -1, `missing ${heading}`);
  const from = start + heading.length;
  const end = nextHeading ? content.indexOf(nextHeading, from) : -1;
  return content.slice(from, end === -1 ? content.length : end);
}

test('root uses one documented host extension and an explicit-only description', async () => {
  const root = await readFile(rootPath, 'utf8');
  const keys = frontmatterKeys(root);
  const standard = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
  assert.deepEqual(keys.filter(key => !standard.has(key)), ['disable-model-invocation']);
  assert.match(root, /^description: Use only when the user explicitly invokes \/zhanggui\b/m);
  assert.match(root, /^compatibility: Requires a host profile that supports explicit-only invocation/m);
});

test('root declares the complete SkillRequest and SkillResult contracts', async () => {
  const root = await readFile(rootPath, 'utf8');
  const activation = section(root, '## Skill Activation Contract', '## WorkflowState');
  for (const field of ['request_id', 'name', 'mode', 'input', 'return_to']) {
    assert.match(activation, new RegExp(`\\b${field}:`));
  }
  for (const field of ['status', 'evidence', 'delta', 'question_request', 'next_skill_request']) {
    assert.match(activation, new RegExp(`\\b${field}:`));
  }
  assert.match(activation, /native activation[\s\S]*catalog location[\s\S]*collection fallback/i);
  assert.match(root, /skill_requests:/);
});

test('fallback registry contains exactly the eight discovered leaves', async () => {
  const root = await readFile(rootPath, 'utf8');
  const registry = section(root, '### Fallback Registry', '## WorkflowState');
  for (const name of leafNames) assert.match(registry, new RegExp(`\\b${name}\\b`));
  assert.equal((registry.match(/\.\.\/zhanggui-[^`\s]+\/SKILL\.md/g) ?? []).length, 8);
});

test('root rejects invalid skill results instead of merging them', async () => {
  const root = await readFile(rootPath, 'utf8');
  for (const code of [
    'missing-skill',
    'skill-identity-mismatch',
    'unsupported-mode',
    'invalid-embedded-input',
    'invalid-skill-result',
    'state-ownership-violation',
  ]) assert.match(root, new RegExp(`\\b${code}\\b`));
});
```

Also extend `tests/skill-discovery.test.mjs` root test with:

```js
assert.match(metadata.description ?? '', /^Use only when the user explicitly invokes \/zhanggui\b/);
assert.match(metadata.compatibility ?? '', /explicit-only invocation/);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test tests/skill-routing-contract.test.mjs tests/skill-discovery.test.mjs
```

Expected: FAIL because the root lacks `compatibility`, explicit-only description, Skill Activation Contract, Fallback Registry and stable error codes.

- [ ] **Step 3: Replace the root frontmatter**

Use exactly:

```yaml
---
name: zhanggui
description: Use only when the user explicitly invokes /zhanggui to run the complete stateful development workflow from design through verified delivery
compatibility: Requires a host profile that supports explicit-only invocation and the installed Zhanggui skill collection
disable-model-invocation: true
---
```

- [ ] **Step 4: Replace the existing supporting-procedure loading prose with the root-owned activation contract**

Add this contract immediately before `## WorkflowState`:

```markdown
## Skill Activation Contract

Only this root frame consumes Embedded `SkillRequest` values and merges `SkillResult` values. Internal stages and Embedded leaves return requests; they do not load sibling skills themselves.

```yaml
SkillRequest:
  request_id: SR-<stable-id>
  name: <exact catalog skill name>
  mode: zhanggui-embedded
  input: <leaf-specific mapping>
  return_to: { phase: <phase>, node: <node-or-null> }

SkillResult:
  request_id: SR-<same-id>
  name: <same catalog skill name>
  mode: zhanggui-embedded
  status: completed | blocked | awaiting-user | skill-required
  evidence: <actual evidence-or-null>
  delta: <leaf-specific mapping-or-null>
  question_request: <QuestionRequest-or-null>
  next_skill_request: <SkillRequest-or-null>
```

Activation order is fixed:

1. **native activation** — use a host `Skill` / `activate_skill` capability only when it loads content into this same frame; pass only fields supported by the real tool schema and retain the SkillRequest input in this frame.
2. **catalog location** — when the catalog exposes the requested SKILL.md location, read that exact location.
3. **collection fallback** — resolve the requested name through the registry below, relative to this root skill directory.
4. If all methods fail, return `blocked: missing-skill`; never search arbitrary project or home directories and never pretend the procedure ran.

Before executing loaded content, verify its frontmatter name equals `SkillRequest.name`. After execution, reject a result whose request identity differs, whose mode is not `zhanggui-embedded`, or whose delta writes WorkflowState, tracker, return point, readiness, owner, consensus, or global phase directly.

`awaiting-user` requires `question_request`; the root updates `awaiting` and its checkpoint before real native delivery or an explicit text fallback. `skill-required` requires `next_skill_request`; the root processes the child synchronously and resumes the parent request without occupying the global detour return point.

Add one root-owned field to the full WorkflowState schema:

```yaml
skill_requests:
  - request_id: SR-<stable-id>
    name: <exact skill name>
    parent_request_id: null | SR-<parent-id>
    return_to: { phase: <phase>, node: <node-or-null> }
    status: active | awaiting-user
```

Omit an empty `skill_requests` field from Minimal state. Synchronous requests are removed immediately after their validated delta is merged. Before any Embedded `awaiting-user` yield, persist the active request chain in the same compressed/full checkpoint as `awaiting`; resume by request_id and clear entries only after the parent result merges successfully. Only the root may write this field.

Stable failures are: `missing-skill`, `skill-identity-mismatch`, `unsupported-mode`, `invalid-embedded-input`, `invalid-skill-result`, and `state-ownership-violation`.

### Fallback Registry

| Skill name | Collection fallback |
|---|---|
| `zhanggui-systematic-debugging` | `../zhanggui-systematic-debugging/SKILL.md` |
| `zhanggui-test-driven-development` | `../zhanggui-test-driven-development/SKILL.md` |
| `zhanggui-verification-before-completion` | `../zhanggui-verification-before-completion/SKILL.md` |
| `zhanggui-requesting-code-review` | `../zhanggui-requesting-code-review/SKILL.md` |
| `zhanggui-receiving-code-review` | `../zhanggui-receiving-code-review/SKILL.md` |
| `zhanggui-using-git-worktrees` | `../zhanggui-using-git-worktrees/SKILL.md` |
| `zhanggui-dispatching-parallel-agents` | `../zhanggui-dispatching-parallel-agents/SKILL.md` |
| `zhanggui-finishing-a-development-branch` | `../zhanggui-finishing-a-development-branch/SKILL.md` |
```

Delete the current arbitrary filesystem search procedure and the statement that raw paths are the only loading mechanism. Keep internal `stages/...` and `RECOVERY.md` resolution relative to the root directory.

- [ ] **Step 5: Change root routing rows from file actions to SkillRequest actions**

Every leaf row must use this form:

```text
`SkillRequest(name=<exact-name>, mode=zhanggui-embedded, input=<required fields>, return_to=<current phase/node>)`
```

Keep internal stage rows as local `stages/<name>/STAGE.md` reads. Replace all operational prose such as “读取 `../zhanggui-.../SKILL.md`” with the exact SkillRequest name; paths remain only in Fallback Registry.

- [ ] **Step 6: Run tests and verify GREEN**

Run:

```bash
node --test tests/skill-routing-contract.test.mjs tests/skill-discovery.test.mjs
node --test
```

Expected: all tests PASS; the full suite has no failure or todo.

- [ ] **Step 7: Commit**

```bash
git add zhanggui/tests/skill-routing-contract.test.mjs zhanggui/tests/skill-discovery.test.mjs zhanggui/skills/zhanggui/SKILL.md
git commit -m "feat(zhanggui): add root skill activation contract"
```

---

### Task 2: Convert Internal Stage Dispatch to SkillRequest

**Files:**
- Modify: `tests/skill-routing-contract.test.mjs`
- Modify: `skills/zhanggui/stages/executing-plans/STAGE.md`

**Interfaces:**
- Consumes: Task 1 `SkillRequest` schema and root ownership.
- Produces: `StageStatus: skill-required` + SkillRequest for all seven execution-time leaf handoffs.

- [ ] **Step 1: Add the failing stage ownership test**

Append:

```js
test('internal stages request leaves through the root and contain no sibling skill loads', async () => {
  const stagePath = path.join(skillsRoot, 'zhanggui', 'stages', 'executing-plans', 'STAGE.md');
  const stage = await readFile(stagePath, 'utf8');
  assert.doesNotMatch(stage, /(?:\.\.\/)+zhanggui-[^`\s]+\/SKILL\.md/);
  assert.match(stage, /StageStatus: skill-required/);
  assert.match(stage, /SkillRequest:/);
  for (const name of [
    'zhanggui-using-git-worktrees',
    'zhanggui-dispatching-parallel-agents',
    'zhanggui-test-driven-development',
    'zhanggui-requesting-code-review',
    'zhanggui-systematic-debugging',
    'zhanggui-verification-before-completion',
    'zhanggui-finishing-a-development-branch',
  ]) assert.match(stage, new RegExp(`\\b${name}\\b`));
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
node --test --test-name-pattern="internal stages request leaves" tests/skill-routing-contract.test.mjs
```

Expected: FAIL because `executing-plans/STAGE.md` still reads sibling paths directly and lacks `StageStatus: skill-required`.

- [ ] **Step 3: Add one dispatch contract to executing-plans**

Insert before `## 开工前检查`:

```markdown
## Embedded Skill Dispatch

When a task step needs a leaf, stop the stage at that step and return:

```yaml
StageStatus: skill-required
SkillRequest:
  request_id: SR-<task-id>-<purpose>
  name: <exact leaf name>
  mode: zhanggui-embedded
  input: <fields required by that leaf>
  return_to: { phase: execute, node: <task-id> }
```

The root activates the leaf, validates SkillResult, then resumes this same numbered step. This stage never loads a sibling SKILL.md, never asks on behalf of an Embedded leaf, and never merges the leaf delta itself.
```

Replace each direct leaf read with these exact names:

| Trigger | SkillRequest.name |
|---|---|
| isolation preflight | `zhanggui-using-git-worktrees` |
| independent Epic/write domains | `zhanggui-dispatching-parallel-agents` |
| production behavior before implementation | `zhanggui-test-driven-development` |
| task/final review | `zhanggui-requesting-code-review` |
| failed validation | `zhanggui-systematic-debugging` |
| completion evidence | `zhanggui-verification-before-completion` |
| verified branch integration | `zhanggui-finishing-a-development-branch` |

- [ ] **Step 4: Run focused and full tests**

```bash
node --test --test-name-pattern="internal stages request leaves" tests/skill-routing-contract.test.mjs
node --test
```

Expected: PASS, zero failures.

- [ ] **Step 5: Commit**

```bash
git add zhanggui/tests/skill-routing-contract.test.mjs zhanggui/skills/zhanggui/stages/executing-plans/STAGE.md
git commit -m "refactor(zhanggui): route stage leaf requests through root"
```

---

### Task 3: Normalize Core Engineering Leaf Results

**Files:**
- Modify: `tests/skill-routing-contract.test.mjs`
- Modify: `skills/zhanggui-systematic-debugging/SKILL.md`
- Modify: `skills/zhanggui-test-driven-development/SKILL.md`
- Modify: `skills/zhanggui-verification-before-completion/SKILL.md`
- Modify: `skills/zhanggui-requesting-code-review/SKILL.md`
- Modify: `skills/zhanggui-receiving-code-review/SKILL.md`

**Interfaces:**
- Consumes: Task 1 SkillResult schema.
- Produces: Identity-bearing Embedded envelopes for debug, TDD, verification and both review directions; debugging dependencies become `next_skill_request`.

- [ ] **Step 1: Add failing Embedded result tests**

Append:

```js
const coreLeafNames = [
  'zhanggui-systematic-debugging',
  'zhanggui-test-driven-development',
  'zhanggui-verification-before-completion',
  'zhanggui-requesting-code-review',
  'zhanggui-receiving-code-review',
];

test('core leaves return identity-bearing Embedded SkillResult envelopes', async () => {
  for (const name of coreLeafNames) {
    const content = await readFile(path.join(skillsRoot, name, 'SKILL.md'), 'utf8');
    const embedded = section(content, '### Zhanggui Embedded', '\n## ');
    for (const field of ['request_id', 'name', 'mode', 'status', 'evidence', 'delta', 'question_request', 'next_skill_request']) {
      assert.match(embedded, new RegExp(`\\b${field}:`), `${name} missing ${field}`);
    }
    assert.match(embedded, new RegExp(`name: ${name}`));
    assert.match(embedded, /mode: zhanggui-embedded/);
  }
});

test('Embedded debugging requests parallel or TDD by name instead of loading sibling files', async () => {
  const content = await readFile(path.join(skillsRoot, 'zhanggui-systematic-debugging', 'SKILL.md'), 'utf8');
  assert.doesNotMatch(content, /(?:\.\.\/)+zhanggui-[^`\s]+\/SKILL\.md/);
  assert.match(content, /next_skill_request:[\s\S]*zhanggui-dispatching-parallel-agents/);
  assert.match(content, /next_skill_request:[\s\S]*zhanggui-test-driven-development/);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
node --test --test-name-pattern="core leaves|Embedded debugging" tests/skill-routing-contract.test.mjs
```

Expected: FAIL because existing Embedded sections expose procedure-specific fields without the common identity envelope and debugging hardcodes sibling paths.

- [ ] **Step 3: Add the exact Embedded envelope to each core leaf**

Each `### Zhanggui Embedded` section must begin with:

```yaml
SkillResult:
  request_id: <supplied SkillRequest.request_id>
  name: <exact current leaf name>
  mode: zhanggui-embedded
  status: completed | blocked | awaiting-user | skill-required
  evidence: <actual procedure evidence-or-null>
  delta: <existing procedure-specific output fields-or-null>
  question_request: <QuestionRequest-or-null>
  next_skill_request: <SkillRequest-or-null>
```

Use these exact mappings inside `delta`:

| Leaf | Existing status moved into delta |
|---|---|
| systematic-debugging | `StageStatus: resolved | blocked | architecture-review-required` |
| test-driven-development | `ProcedureStatus: tdd-complete | blocked` |
| verification-before-completion | `StageStatus: verified | not-verified` plus supplied return fields |
| requesting-code-review | `StageStatus: review-passed | fixes-required | blocked` plus supplied return fields |
| receiving-code-review | `StageStatus: feedback-resolved | changes-required | blocked` plus supplied return fields |

Do not change the existing Direct completion blocks.

- [ ] **Step 4: Replace debugging’s cross-leaf dependencies**

For unrelated failures and production bugfix TDD:

```text
Direct mode: activate the exact leaf name through the host catalog; if the optional parallel capability is unavailable, execute serially and say so. TDD is required for production bugfix implementation and blocks if unavailable.

Embedded mode: return SkillResult.status=skill-required with next_skill_request.name set to `zhanggui-dispatching-parallel-agents` or `zhanggui-test-driven-development`; do not load sibling files directly.
```

- [ ] **Step 5: Run focused and full tests**

```bash
node --test --test-name-pattern="core leaves|Embedded debugging" tests/skill-routing-contract.test.mjs
node --test
```

Expected: PASS, zero failures.

- [ ] **Step 6: Commit**

```bash
git add zhanggui/tests/skill-routing-contract.test.mjs zhanggui/skills/zhanggui-systematic-debugging/SKILL.md zhanggui/skills/zhanggui-test-driven-development/SKILL.md zhanggui/skills/zhanggui-verification-before-completion/SKILL.md zhanggui/skills/zhanggui-requesting-code-review/SKILL.md zhanggui/skills/zhanggui-receiving-code-review/SKILL.md
git commit -m "refactor(zhanggui): normalize core leaf results"
```

---

### Task 4: Normalize Delivery Leaf Results and Composition

**Files:**
- Modify: `tests/skill-routing-contract.test.mjs`
- Modify: `skills/zhanggui-using-git-worktrees/SKILL.md`
- Modify: `skills/zhanggui-dispatching-parallel-agents/SKILL.md`
- Modify: `skills/zhanggui-finishing-a-development-branch/SKILL.md`

**Interfaces:**
- Consumes: Task 1 SkillResult schema and Task 3 dependency pattern.
- Produces: Identity-bearing results for worktree, parallel and finishing; all direct sibling references removed from leaf business flow.

- [ ] **Step 1: Add failing delivery leaf tests**

Append:

```js
const deliveryLeafNames = [
  'zhanggui-using-git-worktrees',
  'zhanggui-dispatching-parallel-agents',
  'zhanggui-finishing-a-development-branch',
];

test('delivery leaves return identity-bearing Embedded SkillResult envelopes', async () => {
  for (const name of deliveryLeafNames) {
    const content = await readFile(path.join(skillsRoot, name, 'SKILL.md'), 'utf8');
    const embedded = section(content, '### Zhanggui Embedded', '\n## ');
    for (const field of ['request_id', 'name', 'mode', 'status', 'evidence', 'delta', 'question_request', 'next_skill_request']) {
      assert.match(embedded, new RegExp(`\\b${field}:`), `${name} missing ${field}`);
    }
    assert.match(embedded, new RegExp(`name: ${name}`));
  }
});

test('leaf business flow contains no hardcoded sibling SKILL paths', async () => {
  for (const name of [...coreLeafNames, ...deliveryLeafNames]) {
    const content = await readFile(path.join(skillsRoot, name, 'SKILL.md'), 'utf8');
    assert.doesNotMatch(content, /(?:\.\.\/)+zhanggui-[^`\s]+\/SKILL\.md/, name);
  }
});
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
node --test --test-name-pattern="delivery leaves|leaf business flow" tests/skill-routing-contract.test.mjs
```

Expected: FAIL on missing envelopes and sibling paths.

- [ ] **Step 3: Add Embedded envelopes and preserve existing local statuses**

Use the Task 3 exact SkillResult field set. Map existing statuses into delta:

| Leaf | Existing status moved into delta |
|---|---|
| using-git-worktrees | `StageStatus: isolated | in-place | blocked | awaiting-user` |
| dispatching-parallel-agents | `StageStatus: integrated | conflicts-found | blocked | serial-fallback` |
| finishing-a-development-branch | `StageStatus: finished | kept | blocked` |

Existing QuestionRequest payloads move into `question_request`; they remain root-delivered in Embedded mode.

- [ ] **Step 4: Replace cross-leaf composition by exact skill name**

Use these mappings:

| Caller | Dependency | Embedded action |
|---|---|---|
| dispatching-parallel-agents | `zhanggui-using-git-worktrees` | `status: skill-required`, `next_skill_request.name` exact |
| dispatching-parallel-agents | `zhanggui-requesting-code-review` | same |
| finishing-a-development-branch | `zhanggui-verification-before-completion` | same when evidence stale/missing |
| using-git-worktrees | `zhanggui-finishing-a-development-branch` | mention exact skill name as later cleanup capability; no file path |

Direct mode activates the exact dependency name through the catalog. Optional parallel/review dependencies use their declared fallback; required verification returns blocked if unavailable.

- [ ] **Step 5: Run focused and full tests**

```bash
node --test --test-name-pattern="delivery leaves|leaf business flow" tests/skill-routing-contract.test.mjs
node --test
```

Expected: PASS, zero failures.

- [ ] **Step 6: Commit**

```bash
git add zhanggui/tests/skill-routing-contract.test.mjs zhanggui/skills/zhanggui-using-git-worktrees/SKILL.md zhanggui/skills/zhanggui-dispatching-parallel-agents/SKILL.md zhanggui/skills/zhanggui-finishing-a-development-branch/SKILL.md
git commit -m "refactor(zhanggui): normalize delivery leaf routing"
```

---

### Task 5: Automate Official Agent Skills Validation

**Files:**
- Create: `scripts/validate-agent-skills.mjs`
- Modify: `tests/skill-discovery.test.mjs`

**Interfaces:**
- Consumes: Root host profile from Task 1 and exact eight-leaf catalog.
- Produces: Reproducible official validation command pinned to `agentskills/agentskills@38a2ff82958afee88dadf4831509e6f7e9d8ef4e`.

- [ ] **Step 1: Strengthen the root exception test before writing the script**

Add:

```js
const standardFrontmatterFields = new Set([
  'name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools',
]);
const rootExtensions = Object.keys(metadata).filter(key => !standardFrontmatterFields.has(key));
assert.deepEqual(rootExtensions, ['disable-model-invocation']);
```

Run `node --test --test-name-pattern="root orchestrator" tests/skill-discovery.test.mjs` and confirm it passes only after Task 1; temporarily adding another root key must make this assertion fail, then remove the probe.

- [ ] **Step 2: Create the official validator runner**

Create `scripts/validate-agent-skills.mjs`:

```js
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(projectRoot, 'skills');
const source = 'git+https://github.com/agentskills/agentskills.git@38a2ff82958afee88dadf4831509e6f7e9d8ef4e#subdirectory=skills-ref';
const uvx = process.platform === 'win32' ? 'uvx.exe' : 'uvx';
const leaves = [
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
  assert.equal(result.status, 0, `${skillPath}\n${result.stdout}\n${result.stderr}`);
  process.stdout.write(result.stdout);
}

for (const name of leaves) validate(path.join(skillsRoot, name));

const rootPath = path.join(skillsRoot, 'zhanggui', 'SKILL.md');
const root = await readFile(rootPath, 'utf8');
const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(root)?.[1];
assert.ok(frontmatter, 'root frontmatter missing');
const keys = frontmatter
  .split(/\r?\n/)
  .filter(line => /^[a-z][a-z-]*:/.test(line))
  .map(line => line.slice(0, line.indexOf(':')));
const standard = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
assert.deepEqual(keys.filter(key => !standard.has(key)), ['disable-model-invocation']);

const temp = await mkdtemp(path.join(os.tmpdir(), 'zhanggui-skill-'));
try {
  const strictRootDir = path.join(temp, 'zhanggui');
  await mkdir(strictRootDir);
  const strictRoot = root.replace(/^disable-model-invocation:\s*true\r?\n/m, '');
  await writeFile(path.join(strictRootDir, 'SKILL.md'), strictRoot);
  validate(strictRootDir);
} finally {
  await rm(temp, { recursive: true, force: true });
}

console.log('Validated 8 strict leaves and 1 host-extended root profile.');
```

- [ ] **Step 3: Run the official validator**

```bash
node scripts/validate-agent-skills.mjs
```

Expected final line:

```text
Validated 8 strict leaves and 1 host-extended root profile.
```

Any `skills-ref` failure or second root extension must exit nonzero.

- [ ] **Step 4: Run full Node tests**

```bash
node --test
```

Expected: zero failures and zero todo.

- [ ] **Step 5: Commit**

```bash
git add zhanggui/scripts/validate-agent-skills.mjs zhanggui/tests/skill-discovery.test.mjs
git commit -m "test(zhanggui): validate Agent Skills compliance profiles"
```

---

### Task 6: Add Versioned Trigger Evals and Boundary Checks

**Files:**
- Create: `evals/skill-triggering.json`
- Create: `tests/skill-trigger-data.test.mjs`
- Create after evaluation: `evals/results/v0.6-routing-summary.json`

**Interfaces:**
- Consumes: Final v0.6 frontmatter descriptions.
- Produces: Stable positive/near-miss dataset and machine-readable results used by release verification.

- [ ] **Step 1: Create the trigger dataset with exact schema and cases**

Create `evals/skill-triggering.json` with top-level fields:

```json
{
  "version": 1,
  "runs_per_query": 3,
  "trigger_threshold": 0.5,
  "skills": []
}
```

Add these exact six positive and six near-miss prompts per skill:

```json
{
  "name": "zhanggui",
  "should_trigger": [
    "/zhanggui 帮我从需求澄清到验证交付设计一个库存系统",
    "Invoke /zhanggui and run the complete workflow for this product idea",
    "请显式启动 /zhanggui，完整处理这个跨模块功能",
    "Use /zhanggui to take this ambiguous project from design through delivery",
    "/zhanggui 恢复这个有 checkpoint 的长期任务",
    "Start the stateful Zhanggui workflow explicitly for this migration"
  ],
  "should_not_trigger": [
    "这个单元测试失败了，先调查根因",
    "用 TDD 实现这个 API 行为",
    "帮我审查当前 diff",
    "评审者建议删锁，先核实反馈",
    "创建隔离 worktree",
    "已验证的分支接下来怎么处理"
  ]
}
```

```json
{
  "name": "zhanggui-systematic-debugging",
  "should_trigger": [
    "这个测试偶发失败，先稳定复现并定位根因",
    "构建失败了，读完整错误并调查，不要先猜修复",
    "生产接口返回了意外状态，追踪数据流找到根因",
    "最近性能退化，请先建立证据和单一假设",
    "依赖升级后集成异常，系统化排查边界",
    "上次修复没有效果，重新从根因调查开始"
  ],
  "should_not_trigger": [
    "从失败测试开始实现一个新的 API 行为",
    "工作完成前运行最终验证",
    "对当前实现做独立代码审查",
    "评审者给了修改建议，判断是否接受",
    "把三个互不相关的问题派给不同 agent",
    "已验证分支应该 merge 还是开 PR"
  ]
}
```

```json
{
  "name": "zhanggui-test-driven-development",
  "should_trigger": [
    "用红绿重构实现新的订单折扣行为",
    "修复这个生产 bug，先写能正确失败的回归测试",
    "重构解析器但保持可观察行为，按 TDD 执行",
    "给公开 API 增加新的错误处理合同，测试先行",
    "实现数据库迁移后的新读取行为，先证明 RED",
    "修改权限判断逻辑，先用失败测试锁定边界"
  ],
  "should_not_trigger": [
    "测试失败但还不知道根因，先调查",
    "检查现有测试是否全部通过并证明完成",
    "只审查这个 diff，不修改文件",
    "评审者要求改实现，先核实建议",
    "这是一次性 throwaway prototype",
    "只修改没有生产行为的格式配置"
  ]
}
```

```json
{
  "name": "zhanggui-verification-before-completion",
  "should_trigger": [
    "准备声称修复完成，先运行新鲜验证",
    "提交前证明所有验收条件都满足",
    "要推送了，检查完整命令输出和失败数",
    "在进入下一任务前核对当前交付是否真的完成",
    "准备开 PR，先用实际证据验证 ready",
    "不要说应该能过，运行能证明这个 claim 的检查"
  ],
  "should_not_trigger": [
    "实现一个新的生产功能",
    "测试失败，先找根因",
    "请求独立代码审查",
    "处理评审者反馈",
    "创建隔离 worktree",
    "未验证分支现在直接合并"
  ]
}
```

```json
{
  "name": "zhanggui-requesting-code-review",
  "should_trigger": [
    "实现完成了，合并前做独立代码审查",
    "这个安全改动需要质量和规格双轴评审",
    "审查 BASE 到 HEAD 的完整变更",
    "公开 API 修改后先找 reviewer 检查",
    "Epic child 完成，继续依赖任务前做 review",
    "只报告当前 diff 的 Critical 和 Important 问题"
  ],
  "should_not_trigger": [
    "评审者已经留言，判断建议是否正确",
    "运行测试证明功能完成",
    "测试失败，调查根因",
    "解释这段代码做什么，不做 review",
    "创建 worktree 保护脏工作区",
    "选择 merge、PR、keep 或 discard"
  ]
}
```

```json
{
  "name": "zhanggui-receiving-code-review",
  "should_trigger": [
    "评审者建议删除这个锁，先技术核实再改",
    "收到六条 code review feedback，逐项判断",
    "review comment 和既定架构冲突，先找证据",
    "不要盲目接受 reviewer 的重构建议",
    "外部评审说测试没价值，验证这个意见",
    "处理 PR feedback，正确的实施，错误的说明理由"
  ],
  "should_not_trigger": [
    "实现完成，请发起新的独立审查",
    "检查当前工作是否已验证完成",
    "测试失败，找根因",
    "从失败测试开始修 bug",
    "创建隔离 worktree",
    "准备把验证后的分支开 PR"
  ]
}
```

```json
{
  "name": "zhanggui-using-git-worktrees",
  "should_trigger": [
    "当前 checkout 很脏，开始功能前创建隔离 worktree",
    "两个并行写范围需要独立工作区",
    "执行这个高风险计划前保护当前分支",
    "请明确用 worktree 开始这个功能",
    "主目录有未提交改动，不要在原地实现",
    "执行计划前检测是否已经处于 linked worktree"
  ],
  "should_not_trigger": [
    "验证后的功能分支应该 merge 还是开 PR",
    "只创建一个普通 git branch，不需要隔离目录",
    "审查当前 diff",
    "调查测试失败根因",
    "列出当前 worktree 状态，不开始工作",
    "处理评审者反馈"
  ]
}
```

```json
{
  "name": "zhanggui-dispatching-parallel-agents",
  "should_trigger": [
    "三个互不相关的问题域写范围不重叠，并行调查",
    "把独立的前端、后端和文档任务一次派发",
    "两个失败来自不同组件，可以分别找根因",
    "按明确 scope 同时派发多个只读 research agent",
    "这些 Epic children 依赖已满足且互不写同一文件",
    "并行实现这些没有共享状态的机械更新"
  ],
  "should_not_trigger": [
    "三个测试失败但看起来共享同一个根因",
    "两个任务都会修改同一个核心文件",
    "先完成 schema，后面的 API 才能开始",
    "只有一个小任务需要执行",
    "没有 subagent 能力，假装并行完成",
    "一个 bug 还没定位根因，先系统化调查"
  ]
}
```

```json
{
  "name": "zhanggui-finishing-a-development-branch",
  "should_trigger": [
    "分支已经验证，选择 merge、PR、keep 或 discard",
    "测试通过了，把 feature branch 本地合并回 main",
    "验证完成，推送并实际创建 PR",
    "工作已验证但我想保留分支稍后处理",
    "列出丢弃这个已验证 worktree 的精确影响并确认",
    "完成开发分支收尾并按选择清理 owned worktree"
  ],
  "should_not_trigger": [
    "功能还没验证，现在直接合并",
    "开始功能前创建隔离 worktree",
    "实现一个新的生产行为",
    "请求代码审查",
    "测试失败，调查根因",
    "收到 PR feedback，判断是否接受"
  ]
}
```

- [ ] **Step 2: Write the dataset contract test**

Create `tests/skill-trigger-data.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(await readFile(path.join(projectRoot, 'evals', 'skill-triggering.json'), 'utf8'));

const expected = new Set([
  'zhanggui',
  'zhanggui-systematic-debugging',
  'zhanggui-test-driven-development',
  'zhanggui-verification-before-completion',
  'zhanggui-requesting-code-review',
  'zhanggui-receiving-code-review',
  'zhanggui-using-git-worktrees',
  'zhanggui-dispatching-parallel-agents',
  'zhanggui-finishing-a-development-branch',
]);

test('trigger dataset covers every skill with positive and near-miss cases', () => {
  assert.equal(data.version, 1);
  assert.equal(data.runs_per_query, 3);
  assert.equal(data.trigger_threshold, 0.5);
  assert.deepEqual(new Set(data.skills.map(item => item.name)), expected);
  for (const item of data.skills) {
    assert.ok(item.should_trigger.length >= 6, `${item.name} needs 6 positives`);
    assert.ok(item.should_not_trigger.length >= 6, `${item.name} needs 6 negatives`);
  }
});

test('trigger prompts are unique and root positives are explicit', () => {
  const prompts = data.skills.flatMap(item => [...item.should_trigger, ...item.should_not_trigger]);
  assert.equal(new Set(prompts).size, prompts.length);
  const root = data.skills.find(item => item.name === 'zhanggui');
  assert.ok(root.should_trigger.every(prompt => /\/zhanggui|Zhanggui workflow/i.test(prompt)));
  assert.ok(root.should_not_trigger.every(prompt => !/\/zhanggui/i.test(prompt)));
});
```

- [ ] **Step 3: Run dataset tests**

```bash
node --test tests/skill-trigger-data.test.mjs
node --test
```

Expected: PASS, zero failures.

- [ ] **Step 4: Run the catalog trigger matrix through the session eval tool**

For every prompt, expose only the final nine name/description pairs, enforce root `implicit=false`, and run three independent completions. A positive run passes only when the selected skill equals that entry's `name`; a negative run passes when that target skill is not selected, whether the router correctly selects an adjacent skill or `none`. Write `evals/results/v0.6-routing-summary.json` with this exact schema:

```json
{
  "version": "0.6",
  "runs_per_query": 3,
  "total_queries": 108,
  "total_runs": 324,
  "skills": [
    {
      "name": "zhanggui",
      "positive_trigger_rate": 1.0,
      "negative_trigger_rate": 0.0,
      "failures": []
    }
  ],
  "passed": true
}
```

Populate all nine skill entries from actual results. `passed` is true only when each positive rate is greater than `0.5` and each negative rate is less than `0.5`; do not fabricate the example rates.

- [ ] **Step 5: Commit dataset and actual summary**

```bash
git add zhanggui/evals/skill-triggering.json zhanggui/evals/results/v0.6-routing-summary.json zhanggui/tests/skill-trigger-data.test.mjs
git commit -m "test(zhanggui): add skill trigger boundary evals"
```

---

### Task 7: v0.6 Documentation, Clean-Host Acceptance, and Final Review

**Files:**
- Modify: `.codex-plugin/plugin.json`
- Modify: `README.md`
- Modify: `docs/skill-fusion-design.md`
- Modify: `evals/results/v0.6-routing-summary.json` with host evidence summary if needed

**Interfaces:**
- Consumes: Tasks 1–6 completed contracts, tests and eval data.
- Produces: v0.6 release contract, real OMP activation/fallback evidence, reviewed branch.

- [ ] **Step 1: Update version and user-facing architecture**

Set `.codex-plugin/plugin.json` version to `0.6.0`. Update descriptions to state:

```text
Eight strict Agent Skills plus one explicit-only host-extended Zhanggui orchestrator.
```

README and `docs/skill-fusion-design.md` must document:

- Strict leaf / host root distinction.
- SkillRequest/SkillResult as Zhanggui’s internal protocol, not an Agent Skills standard.
- Native activation → catalog location → collection fallback.
- Internal stages never load sibling skills; they return local state/task/node deltas and, when a leaf is required, SkillRequest for root consumption.
- Trigger eval and clean-host acceptance commands.
- The full collection remains the install unit.

- [ ] **Step 2: Run all automated verification**

```bash
node --check tests/skill-discovery.test.mjs
node --check tests/skill-routing-contract.test.mjs
node --check tests/skill-trigger-data.test.mjs
node --test
node scripts/validate-agent-skills.mjs
```

Expected: zero test failures/todos; validator final line says 8 strict leaves and 1 host-extended root.

- [ ] **Step 3: Run native OMP plugin activation smoke cases**

Use the existing authenticated profile without saving sessions, restrict the catalog to Zhanggui names, and allow enough startup/model time.

**Native root (interactive, host-direct injection only):**

```bash
omp --no-session --no-rules --plugin-dir "$PWD" --skills "zhanggui*" --max-time 60
# interactive TUI input (no --mode json):
/skill:zhanggui 设计并验证一个最小库存功能
```

Expected evidence before model work: TUI host-direct injection of `skills/zhanggui/SKILL.md` (e.g. `✦ skill zhanggui ...` with exact path). This is the only supported OMP native-root case. `session_id` may be null under `--no-session` TUI.

**Unsupported noninteractive alias probe (do not count as native root):**

```bash
omp --no-session --no-rules --plugin-dir "$PWD" --skills "zhanggui*" --mode json --max-time 120 -p "/zhanggui 设计并验证一个最小库存功能"
```

Expected: OMP treats `/zhanggui` as plain model text under `-p`; may leaf-first. Record as known unsupported probe only.

**Leaf JSONL cases (noninteractive):**

```bash
omp --no-session --no-rules --plugin-dir "$PWD" --skills "zhanggui*" --mode json --max-time 120 -p "这个单元测试失败了，先系统化调查根因"
omp --no-session --no-rules --plugin-dir "$PWD" --skills "zhanggui*" --mode json --max-time 120 -p "用 TDD 实现新的 API 行为"
omp --no-session --no-rules --plugin-dir "$PWD" --skills "zhanggui*" --mode json --max-time 120 -p "评审者建议删除这个锁，先核实反馈"
```

Read the JSONL tool/skill events. Expected:

- Interactive `/skill:zhanggui` injects root `zhanggui` host-direct.
- Bug prompt loads only `zhanggui-systematic-debugging`.
- Implementation prompt loads only `zhanggui-test-driven-development`.
- Feedback prompt loads only `zhanggui-receiving-code-review`.
- `-p /zhanggui` remains an unsupported probe, not a required green root case.

Record actual event names, session ids and pass/fail in `evals/results/v0.6-routing-summary.json`. If current OMP cannot expose activation events, mark host acceptance blocked with the exact output; do not substitute assistant text claims.

- [ ] **Step 4: Run file-read fallback smoke**

Disable native skill discovery and inject only the root instructions while allowing the collection directory:

```bash
omp --no-session --no-rules --no-skills --append-system-prompt skills/zhanggui/SKILL.md --add-dir skills --mode json --max-time 120 -p "/zhanggui 调查一个测试失败；使用已安装 collection 的 fallback 加载调试流程。Installed collection root: $PWD/skills"
```

Expected evidence:

- Root loads from the appended file.
- Native skill activation is unavailable.
- Root resolves `zhanggui-systematic-debugging` through the controlled collection fallback.
- Loaded frontmatter identity matches the requested name.
- Missing/identity errors are surfaced as stable blocked codes.

- [ ] **Step 5: Request whole-branch review and fix all Critical/Important findings**

Review range from the parent of Task 1 through current HEAD. Reviewer must check spec fidelity, root/leaf ownership, silent fallbacks, trigger data quality, and whether tests can pass with a hollow contract. Apply one fix at a time, rerun focused validation, and request scoped re-review until approved.

- [ ] **Step 6: Run final verification after the last review fix**

```bash
node --test
node scripts/validate-agent-skills.mjs
```

Re-run the four native smoke cases and the fallback case after any routing/frontmatter change. Expected: all automated checks pass, all host cases have actual activation/file-read evidence, and review is approved.

- [ ] **Step 7: Commit final release contract**

```bash
git add zhanggui/.codex-plugin/plugin.json zhanggui/README.md zhanggui/docs/skill-fusion-design.md zhanggui/evals/results/v0.6-routing-summary.json
git commit -m "docs(zhanggui): publish v0.6 routing contract"
```

Do not merge, push, create a PR, or clean the worktree unless the user explicitly selects that finishing action.
