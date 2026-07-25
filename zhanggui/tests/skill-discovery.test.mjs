import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(projectRoot, 'skills');

const leafSkills = [
  { name: 'zhanggui-systematic-debugging', enabled: true },
  { name: 'zhanggui-test-driven-development', enabled: true },
  { name: 'zhanggui-verification-before-completion', enabled: true },
  { name: 'zhanggui-requesting-code-review', enabled: true },
  { name: 'zhanggui-receiving-code-review', enabled: true },
  { name: 'zhanggui-using-git-worktrees', enabled: false },
  { name: 'zhanggui-dispatching-parallel-agents', enabled: false },
  { name: 'zhanggui-finishing-a-development-branch', enabled: false },
];

const statefulStages = [
  'design-assist',
  'grilling',
  'prototype',
  'writing-plans',
  'executing-plans',
];

function parseFrontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(content);
  assert.ok(match, 'SKILL.md must contain YAML frontmatter');

  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    metadata[key] = value;
  }

  return { metadata, body: match[2] };
}

async function discoverSkillNames() {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const names = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await access(path.join(skillsRoot, entry.name, 'SKILL.md'));
      names.push(entry.name);
    } catch {
      // Supporting directories without SKILL.md are not discoverable skills.
    }
  }

  return names.sort();
}

test('plugin manifest registers the skills root', async () => {
  const manifest = JSON.parse(
    await readFile(path.join(projectRoot, '.codex-plugin', 'plugin.json'), 'utf8'),
  );
  assert.equal(manifest.skills, './skills/');
});

test('root orchestrator remains explicit-only', async () => {
  const rootSkill = await readFile(path.join(skillsRoot, 'zhanggui', 'SKILL.md'), 'utf8');
  const { metadata } = parseFrontmatter(rootSkill);
  assert.equal(metadata.name, 'zhanggui');
  assert.equal(metadata['disable-model-invocation'], 'true');

  const policy = await readFile(
    path.join(skillsRoot, 'zhanggui', 'agents', 'openai.yaml'),
    'utf8',
  );
  assert.match(policy, /allow_implicit_invocation:\s*false/);
});

for (const { name: skillName, enabled } of leafSkills) {
  if (!enabled) {
    test.todo(`${skillName} is a discoverable dual-mode leaf skill`);
    continue;
  }

  test(`${skillName} is a discoverable dual-mode leaf skill`, async () => {
    const skillPath = path.join(skillsRoot, skillName, 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    const { metadata, body } = parseFrontmatter(content);

    assert.equal(metadata.name, skillName);
    assert.match(metadata.description ?? '', /^Use when\b/);
    assert.equal(metadata['disable-model-invocation'], undefined);
    assert.match(body, /## Invocation Modes/);
    assert.match(body, /### Direct/);
    assert.match(body, /### Zhanggui Embedded/);
  });
}

test('stateful routing stages remain internal', async () => {
  for (const stageName of statefulStages) {
    const stageRoot = path.join(skillsRoot, 'zhanggui', 'stages', stageName);
    await access(path.join(stageRoot, 'STAGE.md'));
    await assert.rejects(access(path.join(stageRoot, 'SKILL.md')));
  }
});

test('catalog exposes only the root and approved leaf skills', async () => {
  const actual = await discoverSkillNames();
  const expectedLeaves = leafSkills.filter(({ enabled }) => enabled).map(({ name }) => name);
  const expected = ['zhanggui', ...expectedLeaves].sort();
  assert.deepEqual(actual, expected);
});
