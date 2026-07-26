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
  { name: 'zhanggui-using-git-worktrees', enabled: true },
  { name: 'zhanggui-dispatching-parallel-agents', enabled: true },
  { name: 'zhanggui-finishing-a-development-branch', enabled: true },
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

function extractSection(content, startHeading, endHeading) {
  const start = content.indexOf(startHeading);
  assert.notEqual(start, -1, `missing ${startHeading}`);
  const sectionStart = start + startHeading.length;
  const end = endHeading ? content.indexOf(endHeading, sectionStart) : -1;
  return content.slice(sectionStart, end === -1 ? content.length : end);
}

function assertDualModeContract(body) {
  assert.match(body, /## Invocation Modes/);
  const direct = extractSection(body, '### Direct', '### Zhanggui Embedded');
  const embedded = extractSection(body, '### Zhanggui Embedded', '\n## ');

  assert.match(direct, /\b(?:do not|does not|never|without|owns no)\b/i);
  assert.match(direct, /(?:WorkflowState|tracker|return point|ReturnPhase|readiness)/i);
  assert.match(embedded, /\/zhanggui/);
  assert.match(embedded, /\b(?:return|returns|delta|preserve|preserves)\b/i);
  assert.match(embedded, /(?:readiness|state|tracker|return point|return fields?)/i);

  if (body.includes('## Completion Contracts')) {
    const completion = extractSection(body, '## Completion Contracts');
    assert.match(extractSection(completion, '### Direct', '### Zhanggui Embedded'), /```text/);
    assert.match(extractSection(completion, '### Zhanggui Embedded'), /```text/);
  } else {
    assert.match(direct, /```text/);
    assert.match(embedded, /```text/);
  }
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

async function listMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listMarkdownFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath);
    }
  }

  return files;
}

test('all relative skill navigation paths resolve', async () => {
  const markdownFiles = await listMarkdownFiles(skillsRoot);
  const navigationPath = /`((?:\.\.?\/)+[^`\r\n]*?(?:SKILL|STAGE)\.md)`/g;

  for (const sourcePath of markdownFiles) {
    const content = await readFile(sourcePath, 'utf8');
    for (const match of content.matchAll(navigationPath)) {
      if (match[1].includes('...') || match[1].includes('<')) continue;
      const targetPath = path.resolve(path.dirname(sourcePath), match[1]);
      const relation = `${path.relative(projectRoot, sourcePath)} -> ${match[1]}`;
      await assert.doesNotReject(access(targetPath), relation);
    }
  }
});

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
  assert.match(metadata.description ?? '', /^Use only when the user explicitly invokes \/zhanggui\b/);
  assert.match(metadata.compatibility ?? '', /explicit-only invocation/);


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
    assertDualModeContract(body);
  });
}

test('dual-mode contract rejects hollow mode headings', () => {
  const hollow = [
    '## Invocation Modes',
    '### Direct',
    'Run the procedure.',
    '### Zhanggui Embedded',
    'Run the procedure.',
  ].join('\n');

  assert.throws(() => assertDualModeContract(hollow));
});

test('worktree leaf delegates embedded decisions and never commits setup automatically', async () => {
  const skillPath = path.join(skillsRoot, 'zhanggui-using-git-worktrees', 'SKILL.md');
  const content = await readFile(skillPath, 'utf8');
  const { body } = parseFrontmatter(content);

  assert.doesNotMatch(body, /commit the isolated setup change/i);
  assert.match(body, /without explicit user (?:consent|authorization)/i);
  assert.match(body, /QuestionRequest/);
  assert.match(body, /\/zhanggui[\s\S]*`awaiting`/);
  assert.match(body, /StageStatus:[^\n]*awaiting-user/);

  const completion = extractSection(body, '## Completion Contracts');
  const directCompletion = extractSection(completion, '### Direct', '### Zhanggui Embedded');
  const embeddedCompletion = extractSection(completion, '### Zhanggui Embedded');
  assert.match(directCompletion, /^SetupChange:/m);
  assert.match(embeddedCompletion, /delta:[\s\S]*?^\s+SetupChange:/m);
  assert.doesNotMatch(embeddedCompletion, /^SetupChange:/m);
});

test('executing stage loads embedded leaf procedures without nested invocation', async () => {
  const stagePath = path.join(skillsRoot, 'zhanggui', 'stages', 'executing-plans', 'STAGE.md');
  const content = await readFile(stagePath, 'utf8');
  const intro = content.split('## 加载形态')[0];

  assert.doesNotMatch(intro, /不调用其他 skill/);
  assert.match(intro, /Zhanggui Embedded/);
});

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
