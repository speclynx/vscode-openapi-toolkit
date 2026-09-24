// Shared definition of every place the release version is recorded.
//
// Versions are locked: the extension, the language server and the Claude Code
// plugin all carry the same number, and one tag `vX.Y.Z` releases them together.
// The plugin lives outside the npm workspaces and pins the server exactly, so
// `npm version --workspaces` cannot maintain this on its own.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseSection } from './changelog.mjs';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SERVER_PACKAGE_NAME = '@speclynx/api-language-server';

/** Manifests whose `version` is set by `npm pkg set --workspaces --include-workspace-root`. */
export const WORKSPACE_MANIFESTS = ['package.json', 'client/package.json', 'server/package.json'];

/** Manifests outside the workspaces, rewritten directly. */
export const PLUGIN_MANIFEST = 'plugins/speclynx-lsp/package.json';
export const PLUGIN_CLAUDE_MANIFEST = 'plugins/speclynx-lsp/.claude-plugin/plugin.json';

export const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf-8'));
}

export function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Every version-bearing location, as `{ label, version }`, so the sync script and
 * the check script agree on what "in sync" means.
 */
export function collectVersions() {
  const lock = readJson('package-lock.json');

  const locations = WORKSPACE_MANIFESTS.map((manifest) => ({
    label: manifest,
    version: readJson(manifest).version,
  }));

  locations.push(
    { label: PLUGIN_MANIFEST, version: readJson(PLUGIN_MANIFEST).version },
    { label: PLUGIN_CLAUDE_MANIFEST, version: readJson(PLUGIN_CLAUDE_MANIFEST).version },
    { label: 'package-lock.json (root)', version: lock.version },
    { label: 'package-lock.json packages[""]', version: lock.packages['']?.version },
    { label: 'package-lock.json packages["client"]', version: lock.packages.client?.version },
    { label: 'package-lock.json packages["server"]', version: lock.packages.server?.version },
  );

  return locations;
}

/** The plugin pins the server exactly; it must track the released version. */
export function pluginServerPin() {
  return readJson(PLUGIN_MANIFEST).dependencies?.[SERVER_PACKAGE_NAME];
}

export function readChangelogRelease(version) {
  const changelog = fs.readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf-8');
  return releaseSection(changelog, version);
}
