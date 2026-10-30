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

const standaloneSkills = ['setup-collaboration-files', 'decision-notes'];

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

function assertPluginManifestV09(manifest) {
  assert.equal(manifest.skills, './skills/');
  assert.equal(manifest.version, '0.9.0');
  assert.equal(
    manifest.description,
    'Eleven strict Agent Skills: the Zhanggui selective-hybrid orchestrator, eight dual-mode engineering leaves, and the standalone setup-collaboration-files and decision-notes collaboration pair.',
  );
  assert.match(manifest.interface.shortDescription, /selective-hybrid root/i);
  assert.match(manifest.interface.shortDescription, /eight dual-mode leaves/i);
  assert.match(manifest.interface.longDescription, /Eleven strict Agent Skills/i);
  assert.match(manifest.interface.longDescription, /automatic or manual/i);
  assert.match(manifest.interface.longDescription, /eight zhanggui-\* leaves/i);
  assert.match(manifest.interface.longDescription, /setup-collaboration-files/i);
  assert.match(manifest.interface.longDescription, /decision-notes/i);
  assert.ok(manifest.interface.defaultPrompt.some(line => /automatically match Zhanggui/i.test(line)));
  assert.ok(manifest.interface.defaultPrompt.some(line => /narrow task/i.test(line)));
}

test('plugin manifest pins the v0.9 hybrid packaging contract', async () => {
  const manifest = JSON.parse(
    await readFile(path.join(projectRoot, '.codex-plugin', 'plugin.json'), 'utf8'),
  );

  // Mutation probe: 0.7 / old packaging wording must fail the strict check.
  const mutated = structuredClone(manifest);
  mutated.version = '0.7.0';
  mutated.description = 'Zhanggui workflow plugin';
  mutated.interface.shortDescription = 'Workflow helper';
  mutated.interface.longDescription = 'Legacy packaging description without leaf contract.';
  mutated.interface.defaultPrompt = ['Type /zhanggui for the full workflow.'];
  assert.throws(
    () => assertPluginManifestV09(mutated),
    /Expected values to be strictly equal|AssertionError/,
  );

  assertPluginManifestV09(manifest);
});

test('root orchestrator supports strict hybrid invocation', async () => {
  const rootSkill = await readFile(path.join(skillsRoot, 'zhanggui', 'SKILL.md'), 'utf8');
  const { metadata, body } = parseFrontmatter(rootSkill);
  assert.equal(metadata.name, 'zhanggui');
  assert.equal(metadata['disable-model-invocation'], undefined);

  const standardFrontmatterFields = new Set([
    'name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools',
  ]);
  const rootExtensions = Object.keys(metadata).filter(key => !standardFrontmatterFields.has(key));
  assert.deepEqual(rootExtensions, []);
  assertDiscoveryDescription(metadata.name, metadata.description ?? '');
  assert.match(metadata.description ?? '', /unclear idea|unresolved design decisions/i);
  assert.match(metadata.description ?? '', /multiple modules|multiple deliverables/i);
  assert.match(metadata.description ?? '', /checkpoint/i);
  assert.match(metadata.description ?? '', /end-to-end/i);
  assertBodyDefersToDescription(extractSection(body, '### Implicit', '### Root-first'));
  assert.match(metadata.compatibility ?? '', /complete Zhanggui skill collection/i);
  assert.match(metadata.compatibility ?? '', /model-selected skills/i);

  const policy = await readFile(
    path.join(skillsRoot, 'zhanggui', 'agents', 'openai.yaml'),
    'utf8',
  );
  assert.match(policy, /allow_implicit_invocation:\s*true/);
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
    assertDiscoveryDescription(metadata.name, metadata.description ?? '');
    assert.equal(metadata['disable-model-invocation'], undefined);
    assertDualModeContract(body);
  });
}

// Discovery only ever sees name + description, and the open spec asks for both
// halves: "Should describe both what the skill does and when to use it". The
// spec's own good examples lead with the capability and end with the trigger
// clause. A description that opens with "Use when" spends its whole budget on
// conditions and never says what the agent gets; one that arbitrates against a
// sibling tells the host "don't pick me" on its own label; one that carries
// behavior instructions or a step list duplicates rules that belong in the body,
// where they are actually executed. The house cap sits well under the
// 1024-character spec ceiling because every skill's metadata is injected at
// startup and competes with the conversation.
const DESCRIPTION_HOUSE_LIMIT = 600;
const MIN_CAPABILITY_CHARS = 30;

function assertDiscoveryDescription(name, description) {
  assert.ok(
    description.length <= DESCRIPTION_HOUSE_LIMIT,
    `${name}: description must stay within ${DESCRIPTION_HOUSE_LIMIT} characters, got ${description.length}`,
  );
  assert.doesNotMatch(
    description,
    /^Use when\b/,
    `${name}: description must lead with what the skill does, not with the trigger clause`,
  );
  assert.match(description, /^[A-Z]/, `${name}: description must open with a capability sentence`);
  const [capability = '', trigger = ''] = description.split(/\bUse when\b/);
  assert.ok(
    capability.trim().length >= MIN_CAPABILITY_CHARS,
    `${name}: description needs a capability clause of at least ${MIN_CAPABILITY_CHARS} characters before its "Use when" clause`,
  );
  assert.ok(
    trigger.trim().length >= 10,
    `${name}: description needs an actual trigger clause after "Use when"`,
  );
  assert.doesNotMatch(description, /\bdo not use\b/i, `${name}: description must not carry negative selection clauses`);
  assert.doesNotMatch(description, /\bdefer to\b/i, `${name}: description must not defer selection to another skill`);
  assert.doesNotMatch(description, /begin with|已自动进入/, `${name}: description must not carry behavior instructions`);
  assert.doesNotMatch(
    description,
    /\bStep \d|\b\d+\.\s+\S/,
    `${name}: description must not summarize the workflow as steps`,
  );
  // A plain YAML scalar cannot carry ": " (mapping indicator) or " #" (comment
  // indicator). The line-based frontmatter parser used above happily reads such
  // a line, so only the official validator rejects the file outright - catching
  // it here keeps the failure one step closer to the edit that caused it.
  assert.doesNotMatch(
    description,
    /: | #/,
    `${name}: description must stay a plain YAML scalar - no ": " or " #"`,
  );
}

// A measured A/B on the full 144-query corpus (two arms, only the root
// description differing) found the root taking a leaf-positive query zero times:
// precision 1.000 in both arms. The "generalist description steals the leaves'
// territory" hypothesis is therefore not supported by evidence and is not
// encoded here as a rule -- a test that forbids breadth would be enforcing an
// unmeasured preference. What is encoded is the part independent of that
// hypothesis: the body must defer to the description instead of keeping a
// second, hand-maintained enumeration of the same preconditions.
function assertBodyDefersToDescription(implicitSection) {
  assert.match(
    implicitSection,
    /preconditions its description names/i,
    'the implicit-entry predicate must defer to the description instead of restating it',
  );
}

test('implicit-entry predicate defers to the description', () => {
  // Mutation probe: a second, hand-maintained precondition list must fail.
  assert.throws(
    () => assertBodyDefersToDescription(
      'Implicit entry is valid when the request spans multiple modules or produces multiple deliverables.',
    ),
    /must defer to the description/,
  );
});

test('every catalog description states what the skill does and when to use it', async () => {
  const names = await discoverSkillNames();
  assert.equal(names.length, 11);

  for (const name of names) {
    const content = await readFile(path.join(skillsRoot, name, 'SKILL.md'), 'utf8');
    const { metadata } = parseFrontmatter(content);
    assertDiscoveryDescription(name, metadata.description ?? '');
  }
});

test('discovery-description gate rejects trigger-only, arbitrating and overlong text', () => {
  const capability = 'Traces a failing test to its root cause. ';
  assert.throws(() => assertDiscoveryDescription('probe', 'Use when a test fails'));
  assert.throws(() => assertDiscoveryDescription('probe', 'Handles bug reports as needed'));
  assert.throws(() => assertDiscoveryDescription('probe', 'Short. Use when a test fails'));
  assert.throws(() => assertDiscoveryDescription('probe', `${capability}Use when a test fails; do not use for builds`));
  assert.throws(() => assertDiscoveryDescription('probe', `${capability}Use when a test fails; defer to the zhanggui root otherwise`));
  assert.throws(() => assertDiscoveryDescription('probe', `${capability}Use when a test fails. When selected implicitly, begin with the notice.`));
  assert.throws(() => assertDiscoveryDescription('probe', `${capability}Use when ${'trigger '.repeat(80)}`));
  assert.throws(() => assertDiscoveryDescription('probe', `${capability}Use when a test fails. Step 1 read the log.`));
  assert.throws(() => assertDiscoveryDescription('probe', `${capability}Use when a test fails, see: the log`));
  assert.throws(() => assertDiscoveryDescription('probe', `${capability}Use when a test fails # not a comment`));
  assertDiscoveryDescription('probe', `${capability}Use when a test failure needs its root cause found`);
});

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

test('catalog exposes only the root, approved leaves, and standalone skills', async () => {
  const actual = await discoverSkillNames();
  const expectedLeaves = leafSkills.filter(({ enabled }) => enabled).map(({ name }) => name);
  const expected = ['zhanggui', ...expectedLeaves, ...standaloneSkills].sort();
  assert.deepEqual(actual, expected);
});

test('standalone skills are strict and own no Zhanggui state', async () => {
  for (const skillName of standaloneSkills) {
    const content = await readFile(path.join(skillsRoot, skillName, 'SKILL.md'), 'utf8');
    const { metadata, body } = parseFrontmatter(content);

    assert.equal(metadata.name, skillName);
    assert.ok((metadata.description ?? '').length > 0, `${skillName} needs a description`);

    // A standalone skill is not part of the root/leaf routing contract, so it
    // must not claim the orchestrator's state or the dual-mode contract.
    assert.doesNotMatch(body, /WorkflowState/);
    assert.doesNotMatch(body, /## Invocation Modes/);
  }
});
