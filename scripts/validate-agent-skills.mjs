import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { accessSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(projectRoot, 'skills');
const source = 'git+https://github.com/agentskills/agentskills.git@38a2ff82958afee88dadf4831509e6f7e9d8ef4e#subdirectory=skills-ref';
const uvx = process.platform === 'win32' ? 'uvx.exe' : 'uvx';

// skills/ is the single source of truth, so the validated set is discovered
// from it. A hardcoded list would silently skip a newly added skill.
function discoverSkills() {
  const names = readdirSync(skillsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => {
      try {
        accessSync(path.join(skillsRoot, name, 'SKILL.md'));
        return true;
      } catch {
        return false;
      }
    })
    .sort();

  assert.ok(names.length > 0, `no skill directories found in ${skillsRoot}`);
  return names;
}

const skills = discoverSkills();

// The validator is a Python tool that reads UTF-8 skill files. On Windows,
// Python defaults to the GBK code page under a Chinese locale and dies on the
// first non-ASCII byte, so force UTF-8 for the child process.
const childEnv = {
  ...process.env,
  PYTHONUTF8: '1',
  PYTHONIOENCODING: 'utf-8',
};

function validate(skillPath) {
  const result = spawnSync(uvx, ['--from', source, 'skills-ref', 'validate', skillPath], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: childEnv,
  });
  if (result.error) {
    throw new Error(`Failed to spawn ${uvx} for ${skillPath}: ${result.error.message}`);
  }
  assert.equal(result.status, 0, `${skillPath}\n${result.stdout}\n${result.stderr}`);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

for (const name of skills) validate(path.join(skillsRoot, name));

console.log(`Validated ${skills.length} strict Agent Skills.`);
