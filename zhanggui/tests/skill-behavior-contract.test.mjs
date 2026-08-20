import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(projectRoot, 'skills');

const read = (p) => readFile(path.join(skillsRoot, p), 'utf8');

// Behavior contract regression tests. These do NOT call an LLM; they pin the
// routing-critical behavior text that was previously too easy to silently
// regress into "dark code" defaults (assisted / Text-Only / no prototype).
// The real end-to-end behavior is exercised separately against a host.

test('root defaults to asking decision-mode instead of silent assisted', async () => {
  const root = await read('zhanggui/SKILL.md');
  assert.match(root, /进入 `design` 的默认动作是先确认决策分权/);
  assert.match(root, /不得用“默认 assisted”静默跳过/);
  assert.match(root, /id: decision-mode/);
});

test('root defaults to asking ui-mode instead of silent Text-Only/Direct', async () => {
  const root = await read('zhanggui/SKILL.md');
  assert.match(root, /默认把 UI mode 一并确认为开局问题/);
  assert.match(root, /不得用“默认 Text-Only\/Direct”静默跳过原型选项/);
});

test('grilling stage keeps one-question-at-a-time QuestionRequest contract', async () => {
  const grilling = await read('zhanggui/stages/grilling/STAGE.md');
  assert.match(grilling, /QuestionRequest/);
  assert.match(grilling, /一次只问当前一个|全局一次一问/);
});

test('prototype stage produces runnable HTML evidence with a smoke check', async () => {
  const prototype = await read('zhanggui/stages/prototype/STAGE.md');
  assert.match(prototype, /独立单 HTML/);
  assert.match(prototype, /smoke check/);
});

test('code reviewer classifies architecture vs detail and checks SSOT/duplication/abstraction', async () => {
  const reviewer = await read('zhanggui-requesting-code-review/code-reviewer.md');
  assert.match(reviewer, /Architecture defect/);
  assert.match(reviewer, /Detail defect/);
  assert.match(reviewer, /Single source of truth/);
  assert.match(reviewer, /Duplication/);
  assert.match(reviewer, /Abstraction/);
  assert.match(reviewer, /Design patterns/);
  assert.match(reviewer, /Reuse/);
});

test('review skill classifies findings before severity and routes architecture back to design', async () => {
  const review = await read('zhanggui-requesting-code-review/SKILL.md');
  assert.match(review, /Classify every finding as \*\*architecture\*\* or \*\*detail\*\*/);
  assert.match(review, /redesign routed\s*back to design/i);
});

test('design-assist treats architecture as an explicit decision domain', async () => {
  const assist = await read('zhanggui/stages/design-assist/STAGE.md');
  assert.match(assist, /遵循既定架构/);
  assert.match(assist, /架构结构决策/);
});

test('steelman argumentation gates fog discovery and obvious-optimum', async () => {
  const root = await read('zhanggui/SKILL.md');
  const assist = await read('zhanggui/stages/design-assist/STAGE.md');
  assert.match(root, /钢人论证前置/);
  assert.match(root, /自我压力测试/);
  assert.match(root, /只问用户一个最关键的问题/);
  assert.match(root, /与 grilling 的“用户主导访谈”是两回事/);
  assert.match(assist, /明显优解”自检（钢人论证）/);
  assert.match(assist, /先替每个被放弃的替代方案做最强辩护/);
});
