#!/usr/bin/env node
// Set the release version everywhere it is recorded.
//
//   node scripts/sync-version.mjs 1.5.4
//
// Sets the version in the three workspace manifests, both plugin manifests, the
// plugin's exact dependency pin on the server and the lockfile, and changes nothing
// else in those files. Validates that CHANGELOG.md already documents the version,
// then re-reads everything to prove the result is consistent.

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  PLUGIN_CLAUDE_MANIFEST,
  PLUGIN_MANIFEST,
  SERVER_PACKAGE_NAME,
  VERSION_PATTERN,
  WORKSPACE_MANIFESTS,
  readChangelogRelease,
  collectVersions,
  pluginServerPin,
  repoRoot,
} from './versions.mjs';
import { setJsonValues } from './json-values.mjs';

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

// Edit the values in place: npm's writers would also sort dependencies, unescape
// strings and re-resolve the lockfile, none of which belongs in a version change.
const setVersion = (relativePath, jsonPaths) => {
  const file = path.join(repoRoot, relativePath);
  fs.writeFileSync(file, setJsonValues(fs.readFileSync(file, 'utf-8'), jsonPaths, version));
};

for (const manifest of [...WORKSPACE_MANIFESTS, PLUGIN_CLAUDE_MANIFEST]) {
  setVersion(manifest, [['version']]);
}

// The plugin is not a workspace: its version and its pin on the server are ours to maintain.
setVersion(PLUGIN_MANIFEST, [['version'], ['dependencies', SERVER_PACKAGE_NAME]]);

// The lockfile records the workspace versions too. `npm ci` accepts it stale;
// check-version-sync.mjs rejects it.
setVersion('package-lock.json', [
  ['version'],
  ...['', 'client', 'server'].map((workspace) => ['packages', workspace, 'version']),
]);

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
