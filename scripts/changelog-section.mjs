#!/usr/bin/env node
// Print the CHANGELOG.md section for one version, used as GitHub release notes.
//
//   node scripts/changelog-section.mjs 1.5.4
//
// Release notes use the same finalized-date checks as version preparation and tagging.
import { VERSION_PATTERN, readChangelogRelease } from './versions.mjs';

const version = process.argv[2];

if (!version || !VERSION_PATTERN.test(version)) {
  console.error(
    `usage: node scripts/changelog-section.mjs <X.Y.Z>\ngot: ${version ?? '(nothing)'}`,
  );
  process.exit(1);
}

try {
  process.stdout.write(`${readChangelogRelease(version).body}\n`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
