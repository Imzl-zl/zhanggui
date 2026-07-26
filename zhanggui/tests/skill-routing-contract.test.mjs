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

const coreLeafStatusInDelta = {
  'zhanggui-systematic-debugging': /StageStatus:\s*resolved\s*\|\s*blocked\s*\|\s*architecture-review-required/,
  'zhanggui-test-driven-development': /ProcedureStatus:\s*tdd-complete\s*\|\s*blocked/,
  'zhanggui-verification-before-completion': /StageStatus:\s*verified\s*\|\s*not-verified/,
  'zhanggui-requesting-code-review': /StageStatus:\s*review-passed\s*\|\s*fixes-required\s*\|\s*blocked/,
  'zhanggui-receiving-code-review': /StageStatus:\s*feedback-resolved\s*\|\s*changes-required\s*\|\s*blocked/,
};

// Structural: local StageStatus/ProcedureStatus must be indented under delta, not a SkillResult peer (T3-1).
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

  const statusLine = /^( +)((?:Stage|Procedure)Status:\s*.+)$/m.exec(deltaBody);
  assert.ok(statusLine, `${label}: local status missing under delta`);
  assert.ok(
    statusLine[1].length > deltaIndent,
    `${label}: local status must be indented under delta, not a top-level/peer field`,
  );
  assert.match(statusLine[2], statusRegex, `${label}: exact local status mapping missing under delta`);

  // Reject any StageStatus/ProcedureStatus that is a column-peer of delta (same indent) or less indented.
  const peerStatus = new RegExp(`(?:^|\\n) {0,${deltaIndent}}(?:Stage|Procedure)Status:`, 'm');
  assert.doesNotMatch(
    skillSlice,
    peerStatus,
    `${label}: local status must not appear as SkillResult root-level/column-peer field`,
  );
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

test('internal stages request leaves through the root and contain no sibling skill loads', async () => {
  const stagePath = path.join(skillsRoot, 'zhanggui', 'stages', 'executing-plans', 'STAGE.md');
  const stage = await readFile(stagePath, 'utf8');
  assert.doesNotMatch(stage, /(?:\.\.\/)+zhanggui-[^`\s]+\/SKILL\.md/);
  assert.doesNotMatch(stage, /\bdebug-required\b/);
  assert.doesNotMatch(stage, /\bverification-required\b/);
  assert.match(stage, /StageStatus: skill-required/);
  assert.match(stage, /SkillRequest:/);
  assert.match(stage, /SkillRequest\.return_to/);
  assert.match(stage, /SkillRequest\.return_to[\s\S]*sole resume target|sole resume target[\s\S]*SkillRequest\.return_to|only resume channel[\s\S]*SkillRequest\.return_to|SkillRequest\.return_to[\s\S]*only resume channel/i);
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
    const sections = embeddedSections(content);
    assert.ok(sections.length >= 1, `${name} missing ### Zhanggui Embedded`);
    for (const [index, embedded] of sections.entries()) {
      for (const field of ['request_id', 'name', 'mode', 'status', 'evidence', 'delta', 'question_request', 'next_skill_request']) {
        assert.match(embedded, new RegExp(`\\b${field}:`), `${name} Embedded#${index + 1} missing ${field}`);
      }
      assert.match(embedded, new RegExp(`name: ${name}`), `${name} Embedded#${index + 1} missing exact name`);
      assert.match(embedded, /mode: zhanggui-embedded/, `${name} Embedded#${index + 1} missing mode`);
    }
    const operational = sections.find(body => /(?:StageStatus|ProcedureStatus):/.test(body)) ?? sections.at(-1);
    assertLocalStatusUnderDelta(
      operational,
      coreLeafStatusInDelta[name],
      `${name} operational Embedded`,
    );
  }
});

test('Embedded debugging requests parallel or TDD by name instead of loading sibling files', async () => {
  const content = await readFile(path.join(skillsRoot, 'zhanggui-systematic-debugging', 'SKILL.md'), 'utf8');
  assert.doesNotMatch(content, /(?:\.\.\/)+zhanggui-[^`\s]+\/SKILL\.md/);
  assert.match(
    content,
    /status[=:]\s*skill-required[\s\S]{0,240}?next_skill_request:[\s\S]{0,120}?name:\s*zhanggui-dispatching-parallel-agents/,
  );
  assert.match(
    content,
    /status[=:]\s*skill-required[\s\S]{0,240}?next_skill_request:[\s\S]{0,120}?name:\s*zhanggui-test-driven-development/,
  );
  assert.match(content, /Direct mode:[\s\S]{0,200}?zhanggui-dispatching-parallel-agents[\s\S]{0,200}?serial/i);
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
  'zhanggui-dispatching-parallel-agents',
  'zhanggui-finishing-a-development-branch',
];

const deliveryLeafStatusInDelta = {
  'zhanggui-using-git-worktrees': /StageStatus:\s*isolated\s*\|\s*in-place\s*\|\s*blocked\s*\|\s*awaiting-user/,
  'zhanggui-dispatching-parallel-agents': /StageStatus:\s*integrated\s*\|\s*conflicts-found\s*\|\s*blocked\s*\|\s*serial-fallback/,
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
    const operational = sections.find(body => /(?:StageStatus|ProcedureStatus):/.test(body)) ?? sections.at(-1);
    assertLocalStatusUnderDelta(
      operational,
      deliveryLeafStatusInDelta[name],
      `${name} operational Embedded`,
    );
  }
});

test('leaf business flow contains no hardcoded sibling SKILL paths', async () => {
  for (const name of [...coreLeafNames, ...deliveryLeafNames]) {
    const content = await readFile(path.join(skillsRoot, name, 'SKILL.md'), 'utf8');
    assert.doesNotMatch(content, /(?:\.\.\/)+zhanggui-[^`\s]+\/SKILL\.md/, name);
  }
});

test('Embedded parallel requests worktree or review by exact name instead of loading sibling files', async () => {
  const content = await readFile(path.join(skillsRoot, 'zhanggui-dispatching-parallel-agents', 'SKILL.md'), 'utf8');
  assert.doesNotMatch(content, /(?:\.\.\/)+zhanggui-[^`\s]+\/SKILL\.md/);
  assert.match(
    content,
    /status[=:]\s*skill-required[\s\S]{0,240}?next_skill_request:[\s\S]{0,120}?name:\s*zhanggui-using-git-worktrees/,
  );
  assert.match(
    content,
    /status[=:]\s*skill-required[\s\S]{0,240}?next_skill_request:[\s\S]{0,120}?name:\s*zhanggui-requesting-code-review/,
  );
  assert.match(content, /Direct mode:[\s\S]{0,200}?zhanggui-using-git-worktrees[\s\S]{0,200}?(?:optional|fallback|unavailable)/i);
  assert.match(content, /Direct mode:[\s\S]{0,200}?zhanggui-requesting-code-review[\s\S]{0,200}?(?:optional|fallback|unavailable)/i);
});

test('Embedded finishing requests verification by exact name when evidence is stale or missing', async () => {
  const content = await readFile(path.join(skillsRoot, 'zhanggui-finishing-a-development-branch', 'SKILL.md'), 'utf8');
  assert.doesNotMatch(content, /(?:\.\.\/)+zhanggui-[^`\s]+\/SKILL\.md/);
  assert.match(
    content,
    /status[=:]\s*skill-required[\s\S]{0,240}?next_skill_request:[\s\S]{0,120}?name:\s*zhanggui-verification-before-completion/,
  );
  assert.match(
    content,
    /Direct mode:[\s\S]{0,220}?zhanggui-verification-before-completion[\s\S]{0,220}?(?:required[\s\S]{0,80}?block|block[\s\S]{0,80}?unavailable)/i,
  );
});

test('worktree names finishing as later cleanup capability without sibling path', async () => {
  const content = await readFile(path.join(skillsRoot, 'zhanggui-using-git-worktrees', 'SKILL.md'), 'utf8');
  assert.doesNotMatch(content, /(?:\.\.\/)+zhanggui-[^`\s]+\/SKILL\.md/);
  assert.match(content, /\bzhanggui-finishing-a-development-branch\b/);
  assert.doesNotMatch(content, /status[=:]\s*skill-required[\s\S]{0,240}?next_skill_request:[\s\S]{0,120}?name:\s*zhanggui-finishing-a-development-branch/);
});
