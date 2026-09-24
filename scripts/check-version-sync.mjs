#!/usr/bin/env node
// Assert that every version-bearing file agrees, and that the plugin pins the
// server at the version being released.
//
//   node scripts/check-version-sync.mjs             # on a branch or PR
//   node scripts/check-version-sync.mjs --tag       # additionally match $GITHUB_REF_NAME
//
// Run on pull requests so the plugin pin cannot drift from the server version,
// and in the release workflow before anything is published.

import {
  PLUGIN_MANIFEST,
  SERVER_PACKAGE_NAME,
  readChangelogRelease,
  collectVersions,
  pluginServerPin,
  readJson,
} from './versions.mjs';

const checkTag = process.argv.includes('--tag');
const expected = readJson('package.json').version;
const problems = [];

for (const location of collectVersions()) {
  if (location.version !== expected) {
    problems.push(`${location.label}: ${location.version ?? '(missing)'} (expected ${expected})`);
  }
}

const expectedPin = expected;
const actualPin = pluginServerPin();
if (actualPin !== expectedPin) {
  problems.push(
    `${PLUGIN_MANIFEST} pins ${SERVER_PACKAGE_NAME}@${actualPin} (expected ${expectedPin}) — ` +
      'the Claude Code plugin would install a server version that is not this release',
  );
}

if (checkTag) {
  const tag = process.env.GITHUB_REF_NAME;
  if (tag !== `v${expected}`) {
    problems.push(
      `tag ${tag ?? '(unset)'} does not match version ${expected} (expected v${expected})`,
    );
  }
  try {
    readChangelogRelease(expected);
  } catch (error) {
    problems.push(error.message);
  }
}

if (problems.length > 0) {
  console.error('version sync check failed:');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('\nrun: node scripts/sync-version.mjs <X.Y.Z>');
  process.exit(1);
}

console.log(
  `version ${expected} is consistent across all manifests, the lockfile and the plugin pin`,
);
