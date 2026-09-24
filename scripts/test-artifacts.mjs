#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './versions.mjs';

let temporary;
try {
  let archive = process.env.SPECLYNX_SERVER_TARBALL;
  if (!archive) {
    if (!existsSync(path.join(repoRoot, 'server/dist/node/server.js')))
      throw new Error('Build the production artifacts before testing.');
    temporary = mkdtempSync(path.join(tmpdir(), 'speclynx-artifacts-'));
    // No prepack: the production build already ran, and package/plugin tests must
    // share one archive. The destination is supplied through cwd, never a shell.
    const packed = JSON.parse(
      execFileSync('npm', ['pack', '--ignore-scripts', '--json'], {
        cwd: path.join(repoRoot, 'server'),
        encoding: 'utf8',
        shell: process.platform === 'win32',
      }),
    );
    const source = path.join(repoRoot, 'server', packed[0].filename);
    const { copyFileSync } = await import('node:fs');
    archive = path.join(temporary, packed[0].filename);
    copyFileSync(source, archive);
    rmSync(source);
  }
  if (!path.isAbsolute(archive) || !existsSync(archive))
    throw new Error('SPECLYNX_SERVER_TARBALL must be an existing absolute path.');
  const identity = () => createHash('sha256').update(readFileSync(archive)).digest('hex');
  const before = identity();
  const result = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, 'node_modules/mocha/bin/mocha.js'),
      '--timeout',
      '300000',
      'out/test/package',
      'out/test/plugin',
    ],
    {
      cwd: path.join(repoRoot, 'server'),
      stdio: 'inherit',
      env: { ...process.env, SPECLYNX_SERVER_TARBALL: archive },
    },
  );
  if (identity() !== before) throw new Error('The tested archive changed during verification');
  console.log(`Verified retained npm archive SHA-256: ${before}`);
  process.exitCode = result.status ?? 1;
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}
