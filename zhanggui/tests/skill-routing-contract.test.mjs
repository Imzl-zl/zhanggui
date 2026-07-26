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
