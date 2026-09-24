#!/usr/bin/env node
// Install the exact archive under test; never rebuild it during plugin testing.
import { execFileSync, execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pluginDir = path.join(repoRoot, 'plugins', 'speclynx-lsp');
let archive;
for (let i = 2; i < process.argv.length; i += 2) {
  const flag = process.argv[i];
  const value = process.argv[i + 1];
  if (!['--plugin-dir', '--tarball'].includes(flag) || !value || value.startsWith('--')) {
    throw new Error(
      'Usage: install-plugin-server.mjs --tarball <archive> [--plugin-dir <directory>]',
    );
  }
  if (flag === '--tarball') archive = path.resolve(value);
  else pluginDir = path.resolve(value);
}
if (!archive || !fs.statSync(archive).isFile())
  throw new Error('A retained server tarball is required.');
if (!fs.existsSync(path.join(pluginDir, 'package.json')))
  throw new Error('The selected plugin has no package.json.');
const throughShell =
  process.platform === 'win32' || process.env.SPECLYNX_INSTALL_THROUGH_SHELL === '1';
const staged = path.join(pluginDir, 'speclynx-local-server.tgz');
// Only fixed literals enter the Windows command shell; paths are cwd/file copies.
const args = [
  'install',
  '--no-save',
  '--package-lock=false',
  '--omit=dev',
  '--omit=peer',
  '--ignore-scripts',
  '--no-audit',
  '--no-fund',
  './speclynx-local-server.tgz',
];
fs.copyFileSync(archive, staged, fs.constants.COPYFILE_EXCL);
try {
  if (throughShell) execSync(`npm ${args.join(' ')}`, { cwd: pluginDir, stdio: 'pipe' });
  else execFileSync('npm', args, { cwd: pluginDir, stdio: 'pipe' });
  const installed = path.join(pluginDir, 'node_modules', '@speclynx', 'api-language-server');
  const version = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8')).version;
  console.log(`Installed @speclynx/api-language-server@${version}`);
} finally {
  fs.rmSync(staged, { force: true });
}
