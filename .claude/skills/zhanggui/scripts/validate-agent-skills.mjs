import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(projectRoot, 'skills');
const source = 'git+https://github.com/agentskills/agentskills.git@38a2ff82958afee88dadf4831509e6f7e9d8ef4e#subdirectory=skills-ref';
const uvx = process.platform === 'win32' ? 'uvx.exe' : 'uvx';
const skills = [
  'zhanggui',
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

for (const name of skills) validate(path.join(skillsRoot, name));

console.log('Validated 9 strict Agent Skills.');
