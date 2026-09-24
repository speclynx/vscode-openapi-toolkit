import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isPrivatePath } from './check-private-paths.mjs';

test('private paths include nested working-record directories', () => {
  for (const file of [
    '.ftlocal/review.md',
    'nested/.idea/workspace.xml',
    'nested/project.iml',
    'nested/.codex/state.json',
    'docs/changelog/03-public-repo/plan.md',
    'docs/changelog/01-lsp-server/06-lsp-public-repos.md',
    'docs/changelog/01-lsp-server/05-lsp-reorganize-progression.md',
    'nested/docs/changelog/02-release-automation/01-release-automation-plan.md',
  ])
    assert.ok(isPrivatePath(file));
  assert.equal(isPrivatePath('CHANGELOG.md'), false);
});

for (const privatePath of [
  '.ftlocal/private-fixture.txt',
  'docs/changelog/01-lsp-server/private-fixture.txt',
  'docs/changelog/02-release-automation/private-fixture.txt',
  '.idea/private-fixture.xml',
  'private-fixture.iml',
])
  test(`a force-added private file fails without disclosure: ${privatePath}`, () => {
    const root = mkdtempSync(path.join(tmpdir(), 'publication-guard-'));
    try {
      execFileSync('git', ['init', '--quiet', root]);
      writeFileSync(path.join(root, '.gitignore'), '.ftlocal/\ndocs/changelog/\n');
      mkdirSync(path.dirname(path.join(root, privatePath)), { recursive: true });
      writeFileSync(path.join(root, privatePath), 'SYNTHETIC_PRIVATE_CONTENT');
      execFileSync('git', ['add', '-f', privatePath], { cwd: root });
      const result = spawnSync(
        process.execPath,
        [fileURLToPath(new URL('./check-private-paths.mjs', import.meta.url))],
        { cwd: root, encoding: 'utf8' },
      );
      assert.equal(result.status, 1);
      assert.doesNotMatch(
        result.stdout + result.stderr,
        /SYNTHETIC_PRIVATE_CONTENT|private-fixture/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
