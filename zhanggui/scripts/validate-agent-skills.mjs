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
  if (result.error) {
    throw new Error(`Failed to spawn ${uvx} for ${skillPath}: ${result.error.message}`);
  }
  assert.equal(result.status, 0, `${skillPath}\n${result.stdout}\n${result.stderr}`);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
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
  const disableLine = /^disable-model-invocation:\s*true\r?\n/m;
  assert.match(root, disableLine, 'root must contain disable-model-invocation: true');
  const strictRoot = root.replace(disableLine, '');
  assert.notEqual(strictRoot, root, 'expected exactly one disable-model-invocation line removed');
  assert.doesNotMatch(strictRoot, disableLine, 'strict copy must not retain disable-model-invocation');
  await writeFile(path.join(strictRootDir, 'SKILL.md'), strictRoot);
  validate(strictRootDir);
} finally {
  await rm(temp, { recursive: true, force: true });
}

console.log('Validated 8 strict leaves and 1 host-extended root profile.');
