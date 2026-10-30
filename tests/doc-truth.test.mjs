import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Eval run status has exactly one home: evals/README.md. It had been copied into
// README.md (twice) and into a docs handoff note, and every copy was already
// false by the time the first runs landed. docs/history/ is out of scope: those
// files are immutable snapshots of what was true when they were written.
const RUN_STATUS_CLAIMS = /尚未运行|从未运行过|两族均已|两族都从未/;

function assertNoRunStatusRestatement(fileName, text) {
  const match = RUN_STATUS_CLAIMS.exec(text);
  assert.equal(
    match,
    null,
    `${fileName} restates eval run status ("${match?.[0]}"); run status lives only in evals/README.md`,
  );
}

async function docTargets() {
  const entries = await readdir(path.join(projectRoot, 'docs'), { withFileTypes: true });
  return [
    'README.md',
    'AGENTS.md',
    'CLAUDE.md',
    ...entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
      .map(entry => path.join('docs', entry.name)),
  ];
}

test('eval run status is stated in exactly one file', async () => {
  for (const relative of await docTargets()) {
    const text = await readFile(path.join(projectRoot, relative), 'utf8');
    assertNoRunStatusRestatement(relative, text);
  }

  // The one file allowed to carry the status must actually carry it, otherwise
  // the ratchet could pass by deleting the status everywhere.
  const evalsReadme = await readFile(path.join(projectRoot, 'evals', 'README.md'), 'utf8');
  assert.match(evalsReadme, /## 当前状态/);
});

test('run-status ratchet rejects a restated claim', () => {
  // Mutation probes: both superseded phrasings must go red.
  assert.throws(
    () => assertNoRunStatusRestatement('probe.md', '两族语料就位但**尚未运行**。'),
    /restates eval run status/,
  );
  assert.throws(
    () => assertNoRunStatusRestatement('probe.md', '- **两族都从未运行过。**'),
    /restates eval run status/,
  );
  assert.throws(
    () => assertNoRunStatusRestatement('probe.md', '两族均已首次实跑。'),
    /restates eval run status/,
  );
  assertNoRunStatusRestatement('probe.md', '运行状态、测量条件与现有速率见 evals/README.md。');
});
