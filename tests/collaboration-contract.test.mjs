import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(projectRoot, 'skills');

const read = (p) => readFile(path.join(skillsRoot, p), 'utf8');

// Contract regression tests for the collaboration pair.
//
// setup-collaboration-files installs the skeleton and the repository invariants; decision-notes
// owns the note format and the lifecycle procedure. The coupling between them is
// deliberately one-way, and these predicates fail if a later edit turns either
// skill into a second source of truth for the other's rules.

function assertNoteFormatHasOneOwner(initProjectTexts) {
  for (const [file, text] of Object.entries(initProjectTexts)) {
    assert.doesNotMatch(
      text,
      /^##\s+Alternatives considered\s*$/m,
      `${file}: setup-collaboration-files must not restate the note four-section template`,
    );
    assert.doesNotMatch(
      text,
      /^##\s+Consequences\s*$/m,
      `${file}: setup-collaboration-files must not restate the note four-section template`,
    );
  }
}

function assertInitProjectPointsAtDecisionNotes(initSkill, templates) {
  assert.match(initSkill, /decision-notes/, 'setup-collaboration-files must name the decision-notes skill');
  assert.match(
    initSkill,
    /\.agents\/notes\/AGENTS\.md/,
    'setup-collaboration-files must point at the repository runtime contract',
  );
  assert.match(
    templates,
    /见 `decision-notes` 技能/,
    'the root AGENTS.md template must route note writing to decision-notes',
  );
}

function assertNoteContractIsComplete(contract) {
  assert.match(contract, /^## 1\. 与非平凡判定$/m, 'contract needs the non-trivial trigger table');
  assert.match(contract, /^## 3\. 四格$/m, 'contract needs the four-section definition');
  assert.match(contract, /^## 5\. 取代与冻结$/m, 'contract needs the supersede-and-freeze procedure');
  assert.match(contract, /严禁总索引/, 'contract must forbid a global index');
  assert.match(contract, /最强的理由/, 'alternatives must lead with the strongest case');
  assert.match(contract, /没有代价的决定/, 'consequences must require a cost');
}

function assertDecisionNotesStaysInScope(body) {
  assert.doesNotMatch(body, /≤120 行/, 'decision-notes must not restate the memory.md budget');
  assert.doesNotMatch(body, /整体覆盖更新/, 'decision-notes must not restate the memory.md lifecycle');
  assert.doesNotMatch(body, /WorkflowState/, 'decision-notes must own no orchestrator state');
  assert.doesNotMatch(body, /^## Invocation Modes$/m, 'decision-notes is standalone, not a dual-mode leaf');
}

function assertSnapshotHasNoDecisionSection(templates) {
  assert.match(templates, /^## 当前基线$/m, 'memory.md template needs the snapshot sections');
  assert.doesNotMatch(templates, /^## 关键决策/m, 'memory.md must not carry a decisions section');
  assert.doesNotMatch(templates, /\*\*Events\*\*/, 'the legacy monthly changelog template must be gone');
}

function assertSupersedeDiscipline(file, text) {
  assert.match(text, /已经发生的决定不能删/, `${file}: past decisions must never be deleted`);
  assert.match(text, /永久冻结/, `${file}: archived notes stay frozen`);
}

function assertBudgetsAreDeclared(rules) {
  assert.match(rules, /1,950 词/, 'root AGENTS.md needs a word budget');
  assert.match(rules, /750 词/, 'per-directory AGENTS.md needs a word budget');
  assert.match(rules, /2,400 词/, 'docs/architecture.md needs a word budget');
}

test('note format has exactly one owner: decision-notes', async () => {
  const [initSkill, templates] = await Promise.all([
    read('setup-collaboration-files/SKILL.md'),
    read('setup-collaboration-files/references/templates.md'),
  ]);

  assertNoteFormatHasOneOwner({
    'setup-collaboration-files/SKILL.md': initSkill,
    'setup-collaboration-files/references/templates.md': templates,
  });
  assertInitProjectPointsAtDecisionNotes(initSkill, templates);
});

test('one-owner gate rejects a restated four-section template', () => {
  const probe = '## Alternatives considered\n\n- whatever\n';
  assert.throws(() => assertNoteFormatHasOneOwner({ probe }));

  const hollow = 'Note format lives in the decision-notes skill.\n';
  assert.doesNotThrow(() => assertNoteFormatHasOneOwner({ probe: hollow }));

  assert.throws(() => assertInitProjectPointsAtDecisionNotes('no skill named here', 'plain text'));
  assert.throws(() =>
    assertInitProjectPointsAtDecisionNotes('decision-notes', 'the note format lives elsewhere'),
  );
});

test('decision-notes owns the full note contract', async () => {
  const contract = await read('decision-notes/references/notes-contract.md');
  const skill = await read('decision-notes/SKILL.md');

  assertNoteContractIsComplete(contract);
  assertDecisionNotesStaysInScope(skill);
  assert.match(skill, /references\/notes-contract\.md/, 'skill must route to the contract');
  assert.match(skill, /references\/note-template\.md/, 'skill must route to the template');

  // Mutation probes: dropping any load-bearing section must fail the gate.
  assert.throws(() => assertNoteContractIsComplete(contract.replace('## 5. 取代与冻结', '## 5. x')));
  assert.throws(() => assertNoteContractIsComplete(contract.replaceAll('最强的理由', '优点')));
  assert.throws(() => assertNoteContractIsComplete(contract.replaceAll('没有代价的决定', '决定')));
  assert.throws(() => assertNoteContractIsComplete(contract.replaceAll('严禁总索引', '建议不要索引')));
});

test('scope gate rejects decision-notes duplicating setup-collaboration-files rules or state', () => {
  assert.throws(() => assertDecisionNotesStaysInScope('目标 ≤120 行'));
  assert.throws(() => assertDecisionNotesStaysInScope('完成闭环后整体覆盖更新'));
  assert.throws(() => assertDecisionNotesStaysInScope('状态写入 WorkflowState'));
  assert.throws(() => assertDecisionNotesStaysInScope('## Invocation Modes'));
  assert.doesNotThrow(() => assertDecisionNotesStaysInScope('只管 .agents/notes/ 目录'));
});

test('setup-collaboration-files installs a decisions-free snapshot and retires the monthly changelog', async () => {
  const templates = await read('setup-collaboration-files/references/templates.md');
  assertSnapshotHasNoDecisionSection(templates);

  // Mutation probe: the old archive template and the old decisions section must fail.
  assert.throws(() =>
    assertSnapshotHasNoDecisionSection(`${templates}\n**Events**：建立协作文件\n`),
  );
  assert.throws(() => assertSnapshotHasNoDecisionSection(`${templates}\n## 关键决策（仍有效）\n`));
});

test('collaboration files declare their word budgets', async () => {
  const rules = await read('setup-collaboration-files/references/rules.md');
  assertBudgetsAreDeclared(rules);

  assert.throws(() => assertBudgetsAreDeclared(rules.replace('1,950 词', 'unlimited')));
  assert.throws(() => assertBudgetsAreDeclared(rules.replace('2,400 词', 'unlimited')));
});

test('setup-collaboration-files keeps the supersede rule and separates stale rules from past decisions', async () => {
  const [rules, initSkill] = await Promise.all([
    read('setup-collaboration-files/references/rules.md'),
    read('setup-collaboration-files/SKILL.md'),
  ]);

  for (const [file, text] of Object.entries({
    'setup-collaboration-files/references/rules.md': rules,
    'setup-collaboration-files/SKILL.md': initSkill,
  })) {
    assertSupersedeDiscipline(file, text);
  }
  assert.match(rules, /旧规则[\s\S]*已发生的决定/, 'rules must separate stale rules from past decisions');

  assert.throws(() => assertSupersedeDiscipline('probe', rules.replace('已经发生的决定不能删', '删除')));
  assert.throws(() => assertSupersedeDiscipline('probe', rules.replace('永久冻结', '可编辑')));
  assert.throws(() =>
    assertSupersedeDiscipline('probe', '只允许有一个 substantive 的**全仓**规则文件'),
  );
});
