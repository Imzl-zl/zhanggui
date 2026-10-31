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
  'zhanggui-using-git-worktrees',
  'zhanggui-finishing-a-development-branch',
];

// Leaves that still carry their own procedure. Four were retired into
// stages/executing-plans/references/ (review, feedback, verification,
// parallel dispatch).
const coreLeafNames = [
  'zhanggui-systematic-debugging',
  'zhanggui-test-driven-development',
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

function embeddedSections(content) {
  const heading = '### Zhanggui Embedded';
  const bodies = [];
  let from = 0;
  while (true) {
    const start = content.indexOf(heading, from);
    if (start === -1) break;
    const bodyStart = start + heading.length;
    const rest = content.slice(bodyStart);
    const next = rest.search(/\n#{2,3} /);
    const bodyEnd = next === -1 ? content.length : bodyStart + next;
    bodies.push(content.slice(bodyStart, bodyEnd));
    from = bodyStart;
  }
  return bodies;
}

// One local status field name across the collection: delta.StageStatus. The retired
// review/verification leaves used to carry their own entries here.
const coreLeafStatusInDelta = {
  'zhanggui-systematic-debugging': /StageStatus:\s*resolved\s*\|\s*blocked\s*\|\s*architecture-review-required/,
  'zhanggui-test-driven-development': /StageStatus:\s*tdd-complete\s*\|\s*blocked/,
};

// Structural: local StageStatus must be indented under delta, not a SkillResult peer (T3-1).
function assertLocalStatusUnderDelta(embedded, statusRegex, label = 'Embedded') {
  const fenceMatch = /```(?:text|yaml)?\r?\n([\s\S]*?)```/.exec(embedded);
  const block = fenceMatch ? fenceMatch[1] : embedded;
  const skillResultIdx = block.search(/^\s*SkillResult:\s*$/m);
  const searchFrom = skillResultIdx === -1 ? 0 : skillResultIdx;
  const skillSlice = block.slice(searchFrom);

  const deltaLine = /^( *)delta:\s*(.*)$/m.exec(skillSlice);
  assert.ok(deltaLine, `${label}: missing delta: inside SkillResult block`);
  const deltaIndent = deltaLine[1].length;
  const afterDeltaHeader = skillSlice.slice(deltaLine.index + deltaLine[0].length);
  // Next top-level SkillResult field at the same indent as delta (e.g. question_request / next_skill_request).
  const peerField = new RegExp(`\\n {${deltaIndent}}[a-z_][a-z0-9_]*:`, 'm').exec(afterDeltaHeader);
  const deltaBody = peerField ? afterDeltaHeader.slice(0, peerField.index) : afterDeltaHeader;

  const statusLine = /^( +)(StageStatus:\s*.+)$/m.exec(deltaBody);
  assert.ok(statusLine, `${label}: local status missing under delta`);
  assert.ok(
    statusLine[1].length > deltaIndent,
    `${label}: local status must be indented under delta, not a top-level/peer field`,
  );
  assert.match(statusLine[2], statusRegex, `${label}: exact local status mapping missing under delta`);

  // Reject any StageStatus that is a column-peer of delta (same indent) or less indented.
  const peerStatus = new RegExp(`(?:^|\\n) {0,${deltaIndent}}StageStatus:`, 'm');
  assert.doesNotMatch(
    skillSlice,
    peerStatus,
    `${label}: local status must not appear as SkillResult root-level/column-peer field`,
  );
}

test('root uses strict hybrid catalog metadata', async () => {
  const root = await readFile(rootPath, 'utf8');
  const keys = frontmatterKeys(root);
  const standard = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
  assert.deepEqual(keys.filter(key => !standard.has(key)), []);
  assert.match(root, /^description: [A-Z]/m, 'root description must lead with what the skill does');
  assert.match(root, /^description:.*\bUse when\b/m, 'root description must carry a "Use when" trigger clause');
  assert.doesNotMatch(root, /^description:.*\bdo not use\b/im);
  assert.doesNotMatch(root, /^description:.*\bdefer to\b/im);
  assert.doesNotMatch(root, /^description:.*已自动进入/m);
  assert.match(root, /^compatibility: Requires the complete Zhanggui skill collection/m);
});

test('root distinguishes explicit and implicit entry without persisting entry source', async () => {
  const root = await readFile(rootPath, 'utf8');
  const invocation = section(root, '## Invocation Modes', '## 核心纪律优先级');
  const implicit = section(root, '### Implicit', '### Root-first and narrow-task de-escalation');
  const marker = '已自动进入 Zhanggui 完整工作流：';
  const markerOccurrences = implicit.split(marker).length - 1;
  assert.match(invocation, /### Explicit/);
  assert.match(invocation, /### Implicit/);
  assert.match(invocation, /host-provided invocation metadata/i);
  assert.equal(markerOccurrences, 1, 'Implicit body must contain the exact marker once');
  assert.match(implicit, /freeform|concise freeform|observed high-signal reason/i);
  assert.match(implicit, /grounded|request or repository evidence|request\/repository evidence/i);
  assert.match(
    implicit,
    /skill activation read may precede|activation read may precede|skill:\/\/.*may precede|may precede (the )?notice/i,
  );
  assert.match(implicit, /before (the )?first non-skill tool/i);
  assert.doesNotMatch(implicit, /before the first tool call/i);
  assert.doesNotMatch(implicit, /Do not compose a new reason/);
  assert.doesNotMatch(
    implicit,
    /emit exactly one of these notices|choosing the first statement supported/i,
  );
  assert.doesNotMatch(
    implicit,
    /该请求需要先澄清关键决策，再贯穿实现与验证|该请求跨越多个模块，需要统一设计、实施与验证|该请求包含多个交付物，需要一套可恢复的执行真值|该请求要求从设计持续负责到验证交付|该请求需要恢复已有 checkpoint 并继续到验证交付|该高风险迁移需要统一处理设计、回滚、实施与验证/,
  );
  assert.match(invocation, /do not ask.*whether.*skill|no.*enablement question|does not ask whether to enable/i);
  assert.match(invocation, /must not.*WorkflowState/i);
  assert.match(invocation, /minimal route state/i);
  assert.match(invocation, /SkillRequest/);
  assert.match(invocation, /Zhanggui Embedded/);
  assert.match(invocation, /root.*wins.*Direct/i);
});

// 这两个 leaf 已按"补模型缺的、省模型会的"原则退役，纪律原文并入
// stages/executing-plans/references/；原先钉住两份 description 边界的那条断言随之移除。
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

test('fallback registry contains exactly the discovered leaves', async () => {
  const root = await readFile(rootPath, 'utf8');
  const registry = section(root, '### Fallback Registry', '## WorkflowState');
  for (const name of leafNames) assert.match(registry, new RegExp(`\\b${name}\\b`));
  assert.equal((registry.match(/\.\.\/zhanggui-[^`\s]+\/SKILL\.md/g) ?? []).length, 4);
});

function assertRootFailureAndQuestionCodes(rootText) {
  for (const code of [
    'missing-skill',
    'skill-identity-mismatch',
    'unsupported-mode',
    'invalid-embedded-input',
    'invalid-skill-result',
    'state-ownership-violation',
    'no-native-question-tool',
    'unsupported-question-shape',
  ]) assert.match(rootText, new RegExp(`\\b${code}\\b`));
}

function assertOperationalSkillRequestRows(rootText) {
  // Operational routing rows use the compact SkillRequest(...) form.
  // Sibling path loads remain confined to the Fallback Registry section.
  const operational = rootText
    .replace(section(rootText, '### Fallback Registry', '## WorkflowState'), '')
    .replace(section(rootText, '## Skill Activation Contract', '## WorkflowState'), '');
  assert.doesNotMatch(operational, /\.\.\/zhanggui-[^`\s]+\/SKILL\.md/);

  for (const name of leafNames) {
    assert.match(
      rootText,
      new RegExp(
        `SkillRequest\\(name=${name}, mode=zhanggui-embedded(?:, [a-z_]+=[^)]*)*\\)`,
      ),
      `operational SkillRequest row missing for ${name}`,
    );
  }
}

test('root rejects invalid skill results instead of merging them', async () => {
  const root = await readFile(rootPath, 'utf8');

  // Mutation probes: missing question-fallback codes or operational rows must fail.
  const withoutQuestionCodes = root
    .replaceAll('no-native-question-tool', 'missing-native-question-tool')
    .replaceAll('unsupported-question-shape', 'unsupported-question-form');
  assert.throws(
    () => assertRootFailureAndQuestionCodes(withoutQuestionCodes),
    /AssertionError|does not match/,
  );

  const withoutOperationalRows = root.replaceAll(
    /SkillRequest\(name=zhanggui-[^,]+, mode=zhanggui-embedded[^)]*\)/g,
    'activate-leaf-by-name',
  );
  assert.throws(
    () => assertOperationalSkillRequestRows(withoutOperationalRows),
    /AssertionError|does not match|operational SkillRequest/,
  );

  assertRootFailureAndQuestionCodes(root);
  assertOperationalSkillRequestRows(root);
});

test('internal stages carry the review and verification disciplines locally', async () => {
  const stage = await readFile(path.join(skillsRoot, 'zhanggui/stages/executing-plans/STAGE.md'), 'utf8');
  assert.match(stage, /references\/code-review\.md/);
  assert.match(stage, /references\/verification\.md/);
  // These three leaves were retired; a stage that still dispatches them by name
  // would fail at activation time with missing-skill.
  for (const name of [
    'zhanggui-requesting-code-review',
    'zhanggui-receiving-code-review',
    'zhanggui-verification-before-completion',
  ]) {
    assert.doesNotMatch(stage, new RegExp('name: ' + name), name + ' is retired but still dispatched by name');
  }
});
test('core leaves return identity-bearing Embedded SkillResult envelopes', async () => {
  for (const name of coreLeafNames) {
    const content = await readFile(path.join(skillsRoot, name, 'SKILL.md'), 'utf8');
    const sections = embeddedSections(content);
    assert.ok(sections.length >= 1, `${name} missing ### Zhanggui Embedded`);
    for (const [index, embedded] of sections.entries()) {
      for (const field of ['request_id', 'name', 'mode', 'status', 'evidence', 'delta', 'question_request', 'next_skill_request']) {
        assert.match(embedded, new RegExp(`\\b${field}:`), `${name} Embedded#${index + 1} missing ${field}`);
      }
      assert.match(embedded, new RegExp(`name: ${name}`), `${name} Embedded#${index + 1} missing exact name`);
      assert.match(embedded, /mode: zhanggui-embedded/, `${name} Embedded#${index + 1} missing mode`);
    }
    const operational = sections.find(body => /StageStatus:/.test(body)) ?? sections.at(-1);
    assertLocalStatusUnderDelta(
      operational,
      coreLeafStatusInDelta[name],
      `${name} operational Embedded`,
    );
  }
});

test('Embedded debugging requests TDD by name and reads parallel dispatch as a reference', async () => {
  const content = await readFile(path.join(skillsRoot, 'zhanggui-systematic-debugging', 'SKILL.md'), 'utf8');
  assert.match(
    content,
    /status[=:]\s*skill-required[\s\S]{0,240}?next_skill_request:[\s\S]{0,120}?name:\s*zhanggui-test-driven-development/,
  );
  // Parallel dispatch is no longer a catalog leaf; the procedure points at the reference.
  assert.doesNotMatch(content, /name:\s*zhanggui-dispatching-parallel-agents/);
  assert.match(content, /executing-plans\/references\/parallel-dispatch\.md/);
  assert.match(content, /Direct mode:[\s\S]{0,200}?zhanggui-test-driven-development[\s\S]{0,200}?(?:required[\s\S]{0,80}?block|block[\s\S]{0,80}?unavailable)/i);
});

test('local status mapping must live under delta, not as SkillResult peer (T3-1)', () => {
  const hoisted = `
\`\`\`text
SkillResult:
  request_id: SR-mutation
  name: zhanggui-using-git-worktrees
  mode: zhanggui-embedded
  status: completed | blocked | awaiting-user | skill-required
  evidence: <Workspace/Baseline/SetupChange 实际证据-or-null>
  delta:
    Workspace: 路径与分支
    Baseline: 测试命令与结果
    SetupChange: none
  StageStatus: isolated | in-place | blocked | awaiting-user
  question_request: null
  next_skill_request: null
\`\`\`
`;
  const statusRegex = /StageStatus:\s*isolated\s*\|\s*in-place\s*\|\s*blocked\s*\|\s*awaiting-user/;
  assert.throws(
    () => assertLocalStatusUnderDelta(hoisted, statusRegex, 'hoisted-status mutation'),
    /delta|peer|top-level|under delta/i,
    'validator must reject a valid local status hoisted out of delta',
  );
});

const deliveryLeafNames = [
  'zhanggui-using-git-worktrees',
  'zhanggui-finishing-a-development-branch',
];

const deliveryLeafStatusInDelta = {
  'zhanggui-using-git-worktrees': /StageStatus:\s*isolated\s*\|\s*in-place\s*\|\s*blocked\s*\|\s*awaiting-user/,
  'zhanggui-finishing-a-development-branch': /StageStatus:\s*finished\s*\|\s*kept\s*\|\s*blocked/,
};

test('delivery leaves return identity-bearing Embedded SkillResult envelopes', async () => {
  for (const name of deliveryLeafNames) {
    const content = await readFile(path.join(skillsRoot, name, 'SKILL.md'), 'utf8');
    const sections = embeddedSections(content);
    assert.ok(sections.length >= 1, `${name} missing ### Zhanggui Embedded`);
    for (const [index, embedded] of sections.entries()) {
      for (const field of ['request_id', 'name', 'mode', 'status', 'evidence', 'delta', 'question_request', 'next_skill_request']) {
        assert.match(embedded, new RegExp(`\\b${field}:`), `${name} Embedded#${index + 1} missing ${field}`);
      }
      assert.match(embedded, new RegExp(`name: ${name}`), `${name} Embedded#${index + 1} missing exact name`);
      assert.match(embedded, /mode: zhanggui-embedded/, `${name} Embedded#${index + 1} missing mode`);
    }
    const operational = sections.find(body => /StageStatus:/.test(body)) ?? sections.at(-1);
    assertLocalStatusUnderDelta(
      operational,
      deliveryLeafStatusInDelta[name],
      `${name} operational Embedded`,
    );
  }
});

const statusProducingDocs = [
  'zhanggui-systematic-debugging/SKILL.md',
  'zhanggui-test-driven-development/SKILL.md',
  'zhanggui-using-git-worktrees/SKILL.md',
  'zhanggui-finishing-a-development-branch/SKILL.md',
  'zhanggui/stages/design-assist/STAGE.md',
  'zhanggui/stages/grilling/STAGE.md',
  'zhanggui/stages/prototype/STAGE.md',
  'zhanggui/stages/writing-plans/STAGE.md',
  'zhanggui/stages/executing-plans/STAGE.md',
  'zhanggui/stages/executing-plans/references/verification.md',
];

// Every status a producer can emit needs a deterministic consumer rule. The root is the
// only consumer, so a status it never names is silently resolved by improvisation — which
// is how architecture-review-required previously ended with no route back to design.
test('root consumes every status a leaf or stage can return', async () => {
  const root = await readFile(rootPath, 'utf8');
  const start = root.indexOf('### 返回状态消费');
  assert.ok(start !== -1, 'root must declare a status consumption section');
  const end = root.indexOf('### Fallback Registry', start);
  const table = root.slice(start, end === -1 ? undefined : end);

  const statuses = new Set();
  for (const rel of statusProducingDocs) {
    const text = await readFile(path.join(skillsRoot, rel), 'utf8');
    for (const match of text.matchAll(/(?:StageStatus|Outcome):\s*([a-z][a-z| -]*)/g)) {
      for (const raw of match[1].split('|')) {
        const value = raw.trim();
        if (/^[a-z][a-z-]*$/.test(value)) statuses.add(value);
      }
    }
  }

  assert.ok(statuses.size >= 20, `expected a full status set, parsed ${statuses.size}`);
  const uncovered = [...statuses].filter(value => !table.includes(`\`${value}\``)).sort();
  assert.deepEqual(uncovered, [], `root consumption table must cover: ${uncovered.join(', ')}`);
});

test('leaf business flow contains no hardcoded sibling SKILL paths', async () => {
  for (const name of [...coreLeafNames, ...deliveryLeafNames]) {
    const content = await readFile(path.join(skillsRoot, name, 'SKILL.md'), 'utf8');
    assert.doesNotMatch(content, /(?:\.\.\/)+zhanggui-[^`\s]+\/SKILL\.md/, name);
  }
});

test('parallel dispatch lives in the execute stage and reads the review discipline locally', async () => {
  const content = await readFile(
    path.join(skillsRoot, 'zhanggui', 'stages', 'executing-plans', 'references', 'parallel-dispatch.md'),
    'utf8',
  );
  assert.match(content, /references\/code-review\.md|\[code-review\.md\]\(code-review\.md\)/);
  assert.doesNotMatch(content, /name: zhanggui-requesting-code-review/);
  assert.match(content, /zhanggui-using-git-worktrees/);
  // The retired leaf must not come back as a discovered skill.
  await assert.rejects(
    readFile(path.join(skillsRoot, 'zhanggui-dispatching-parallel-agents', 'SKILL.md'), 'utf8'),
  );
});
test('finishing applies the verification discipline itself when evidence is stale', async () => {
  const content = await readFile(
    path.join(skillsRoot, 'zhanggui-finishing-a-development-branch', 'SKILL.md'),
    'utf8',
  );
  assert.match(content, /references\/verification\.md/);
  assert.doesNotMatch(content, /name: zhanggui-verification-before-completion/);
  assert.match(content, /Verified: verified \| not-verified/);
});
test('worktree isolation triggers on readiness instead of a subjective risk self-assessment', async () => {
  const root = await readFile(rootPath, 'utf8');
  const stage = await readFile(
    path.join(skillsRoot, 'zhanggui', 'stages', 'executing-plans', 'STAGE.md'),
    'utf8',
  );
  const splitLines = (text) => text.split(/\r?\n/);
  const forbiddenSelfAssessment = /\u9ad8\u98ce\u9669/;

  const routingRow = splitLines(root)
    .find(line => line.includes('zhanggui-using-git-worktrees') && line.includes('phase = execute'));
  assert.ok(routingRow, 'routing table must map execute-entry isolation to the worktree leaf');
  assert.match(routingRow, /durable-plan/);
  assert.match(routingRow, /epic-plan/);
  assert.doesNotMatch(routingRow, forbiddenSelfAssessment);

  const stageRow = splitLines(stage)
    .find(line => line.includes('zhanggui-using-git-worktrees'));
  assert.ok(stageRow, 'executing-plans must request the worktree leaf before implementation');
  assert.match(stageRow, /durable-plan/);
  assert.match(stageRow, /epic-plan/);
  assert.doesNotMatch(stageRow, forbiddenSelfAssessment);
});

test('worktree names finishing as later cleanup capability without sibling path', async () => {
  const content = await readFile(path.join(skillsRoot, 'zhanggui-using-git-worktrees', 'SKILL.md'), 'utf8');
  assert.doesNotMatch(content, /(?:\.\.\/)+zhanggui-[^`\s]+\/SKILL\.md/);
  assert.match(content, /\bzhanggui-finishing-a-development-branch\b/);
  assert.doesNotMatch(content, /status[=:]\s*skill-required[\s\S]{0,240}?next_skill_request:[\s\S]{0,120}?name:\s*zhanggui-finishing-a-development-branch/);
});
