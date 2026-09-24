#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { digests, publicRepository, verifyFiles, registryState } from './release-artifacts.mjs';

try {
  assert.equal(process.env.GITHUB_REPOSITORY, publicRepository);
  const record = JSON.parse(readFileSync('release-artifacts/release-record.json'));
  verifyFiles(record, 'release-artifacts', process.env.GITHUB_SHA);
  assert.equal(await registryState(record), 'present-identical');
  const tag = `v${record.version}`;
  const api = (endpoint) => JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8' }));
  // Listing distinguishes an absent release from an authentication/network error.
  const pages = JSON.parse(
    execFileSync(
      'gh',
      ['api', '--paginate', '--slurp', `/repos/${publicRepository}/releases?per_page=100`],
      { encoding: 'utf8' },
    ),
  );
  let release = pages.flat().find((item) => item.tag_name === tag);
  const notes = execFileSync(process.execPath, ['scripts/changelog-section.mjs', record.version]);
  writeFileSync('release-artifacts/release-notes.md', notes);
  if (!release) {
    execFileSync(
      'gh',
      [
        'release',
        'create',
        tag,
        '--repo',
        publicRepository,
        '--verify-tag',
        '--title',
        tag,
        '--notes-file',
        'release-artifacts/release-notes.md',
      ],
      { stdio: 'inherit' },
    );
    release = api(`/repos/${publicRepository}/releases/tags/${tag}`);
  }
  for (const filename of [
    ...Object.values(record.files).map((file) => file.filename),
    'release-record.json',
  ]) {
    const existing = release.assets.find((asset) => asset.name === filename);
    const local = readFileSync(`release-artifacts/${filename}`);
    if (existing) {
      const remote = execFileSync(
        'gh',
        [
          'api',
          '-H',
          'Accept: application/octet-stream',
          `/repos/${publicRepository}/releases/assets/${existing.id}`,
        ],
        { maxBuffer: 100 * 1024 * 1024 },
      );
      assert.equal(
        digests(remote).sha256,
        digests(local).sha256,
        'Existing release asset has a different identity; never clobber it',
      );
    } else {
      execFileSync(
        'gh',
        ['release', 'upload', tag, `release-artifacts/${filename}`, '--repo', publicRepository],
        { stdio: 'inherit' },
      );
    }
  }
} catch (error) {
  console.error(
    error instanceof Error && !('stdout' in error)
      ? error.message
      : 'GitHub release failed; existing assets were not replaced.',
  );
  process.exitCode = 1;
}
