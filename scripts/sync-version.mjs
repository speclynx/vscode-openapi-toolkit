#!/usr/bin/env node
// Set the release version everywhere it is recorded.
//
//   node scripts/sync-version.mjs 1.5.4
//
// Writes the three workspace manifests, both plugin manifests, the plugin's exact
// dependency pin on the server, and refreshes the lockfile. Validates that
// CHANGELOG.md already documents the version, then re-reads everything to prove
// the result is consistent.

import { execFileSync } from 'node:child_process';
import {
  PLUGIN_CLAUDE_MANIFEST,
  PLUGIN_MANIFEST,
  SERVER_PACKAGE_NAME,
  VERSION_PATTERN,
  readChangelogRelease,
  collectVersions,
  pluginServerPin,
  readJson,
  repoRoot,
  writeJson,
} from './versions.mjs';

const version = process.argv[2];

if (!version || !VERSION_PATTERN.test(version)) {
  console.error(`usage: node scripts/sync-version.mjs <X.Y.Z>\ngot: ${version ?? '(nothing)'}`);
  process.exit(1);
}

try {
  readChangelogRelease(version);
} catch (error) {
  console.error(
    `${error.message}\nFinalize the release date and notes before changing any versions.`,
  );
  process.exit(1);
}

const run = (command, args) =>
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

// The three workspace manifests, via npm so its own JSON writer preserves formatting.
run('npm', ['pkg', 'set', `version=${version}`, '--workspaces', '--include-workspace-root']);

// The plugin is not a workspace: its version and its pin on the server are ours to maintain.
const pluginManifest = readJson(PLUGIN_MANIFEST);
pluginManifest.version = version;
pluginManifest.dependencies[SERVER_PACKAGE_NAME] = version;
writeJson(PLUGIN_MANIFEST, pluginManifest);

const pluginClaudeManifest = readJson(PLUGIN_CLAUDE_MANIFEST);
pluginClaudeManifest.version = version;
writeJson(PLUGIN_CLAUDE_MANIFEST, pluginClaudeManifest);

// `npm pkg set` does not touch the lockfile, and `npm ci` validates workspace
// versions against it, so a stale lock fails the release after the tag is public.
run('npm', ['install', '--package-lock-only', '--ignore-scripts']);

const mismatched = collectVersions().filter((location) => location.version !== version);
const expectedPin = version;
const actualPin = pluginServerPin();

if (mismatched.length > 0 || actualPin !== expectedPin) {
  console.error('version sync did not converge:');
  for (const location of mismatched) {
    console.error(`  ${location.label}: ${location.version ?? '(missing)'} (expected ${version})`);
  }
  if (actualPin !== expectedPin) {
    console.error(`  ${PLUGIN_MANIFEST} pin: ${actualPin} (expected ${expectedPin})`);
  }
  process.exit(1);
}

console.log(`\nversion ${version} written to ${collectVersions().length} locations`);
console.log(`plugin pins ${SERVER_PACKAGE_NAME}@${expectedPin}`);
console.log('\nreview `git diff`, then commit and tag:');
console.log(`  git commit -am "chore(release): cut the v${version} release"`);
console.log(`  git tag v${version}`);
