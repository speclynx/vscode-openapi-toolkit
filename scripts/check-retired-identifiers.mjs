#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const tokens = [
  '@speclynx/apidom-ls',
  'apidom-ls',
  'apidom-lsp-vscode',
  'speclynx-api-lsp',
  'vscode-openapi-toolkit-internal',
  'char0n/apidom',
];
// These exact files define the policy and its synthetic negative fixtures.
const policyFiles = new Set([
  'scripts/check-retired-identifiers.mjs',
  'scripts/check-retired-identifiers.test.mjs',
]);
export function retiredIdentifiers(file, text) {
  if (policyFiles.has(file)) return [];
  return tokens.filter((token) =>
    new RegExp(
      `(?<![A-Za-z0-9_-])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_-])`,
    ).test(text),
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    // Include new nonignored files so the local check also covers preparation before staging.
    const paths = [
      ...new Set(
        execFileSync('git', ['ls-files', '-c', '-o', '--exclude-standard', '-z'], {
          encoding: 'utf8',
        }).split('\0'),
      ),
    ].filter(Boolean);
    let count = 0;
    for (const file of paths) {
      if (!existsSync(file)) continue;
      const data = readFileSync(file);
      if (data.includes(0)) continue; // Maintenance check only; full publication scanning also covers binaries.
      const found = retiredIdentifiers(file, data.toString('utf8'));
      if (found.length) {
        console.error(`${file}: retired identifier(s): ${found.join(', ')}`);
        count++;
      }
    }
    if (count) process.exitCode = 1;
    else console.log('Current identifiers are consistent.');
  } catch (error) {
    console.error(
      error instanceof Error && !('stdout' in error)
        ? error.message
        : 'Could not inventory identifiers; failing closed.',
    );
    process.exitCode = 1;
  }
}
