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

// The review, feedback and verification disciplines live once, in the executing
// stage's references. The leaves keep only their invocation contract, so these
// pins moved with the rules instead of staying on a leaf that no longer carries
// them.
test('code reviewer classifies architecture vs detail and checks SSOT/duplication/abstraction', async () => {
  const reviewer = await read('zhanggui/stages/executing-plans/references/code-reviewer.md');
  assert.match(reviewer, /Architecture defect/);
  assert.match(reviewer, /Detail defect/);
  assert.match(reviewer, /Single source of truth/);
  assert.match(reviewer, /Duplication/);
  assert.match(reviewer, /Abstraction/);
  assert.match(reviewer, /Design patterns/);
  assert.match(reviewer, /Reuse/);
});

test('review discipline classifies findings before severity and routes architecture back to design', async () => {
  const review = await read('zhanggui/stages/executing-plans/references/code-review.md');
  assert.match(review, /每条发现先定性质再定级别/);
  assert.match(review, /\*\*Architecture\*\*[\s\S]*路由回 design/);
  assert.match(review, /不等于\s*\*\*?完成验证|不等于\*\*完成验证|不等于\*\* 完成验证/);
});

test('design-assist treats architecture as an explicit decision domain', async () => {
  const assist = await read('zhanggui/stages/design-assist/STAGE.md');
  assert.match(assist, /遵循既定架构/);
  assert.match(assist, /架构结构决策/);
});

test('debug architecture finding carries payload and re-enters design without rewriting the return point', async () => {
  const debug = await read('zhanggui-systematic-debugging/SKILL.md');
  const root = await read('zhanggui/SKILL.md');

  // A bare status enum is not a finding: both delivery contracts must carry the payload,
  // otherwise the caller receives architecture-review-required with nothing to design from.
  const payloadFields = debug.match(/ArchitectureFinding: none \|/g) ?? [];
  assert.equal(payloadFields.length, 2, 'Direct and Embedded contracts both need ArchitectureFinding');

  assert.match(root, /debug `blocked` -> 保留 return point，不得伪装继续/);
  assert.match(root, /architecture-review-required` -> [\s\S]*?`domain: architecture`/);
  assert.match(root, /architecture-review-required` 是同一路径的第二个入口/);
  assert.match(root, /不重写 `return_point`/);
  assert.match(root, /不得就地打补丁/);
});

test('question batching is gated mechanically and stays out of serial decision flows', async () => {
  const root = await read('zhanggui/SKILL.md');
  const questioning = await read('zhanggui/references/questioning.md');
  const grilling = await read('zhanggui/stages/grilling/STAGE.md');

  assert.match(questioning, /每轮等待最多一次用户交互/);
  assert.match(questioning, /### 成批资格/);
  assert.match(questioning, /\*\*彼此无依赖\*\*/);
  assert.match(questioning, /\*\*不混批\*\*/);
  assert.match(questioning, /\*\*不处于串行场景\*\*/);
  assert.match(questioning, /只答其中一部分/);

  // The opening double question must cite the batch rule instead of the old wording that
  // demanded two dimensions in one interaction while claiming one question per round.
  assert.match(root, /满足 `references\/questioning\.md` 的成批资格/);
  assert.doesNotMatch(root, /仍遵守“每轮最多一问”/);
  assert.match(root, /每轮等待最多一次用户交互/);

  // A user-owned decision domain still takes one node at a time.
  assert.match(grilling, /一次只问当前一个 decision node/);
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
