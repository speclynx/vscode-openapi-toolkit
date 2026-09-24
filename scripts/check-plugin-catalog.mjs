#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { repoRoot, readJson } from './versions.mjs';

export const pluginPath = 'plugins/speclynx-lsp';
export const repositoryUrl = 'https://github.com/speclynx/vscode-openapi-toolkit.git';
export function checkDevelopmentPlugin(read = (file) => readJson(`${pluginPath}/${file}`)) {
  const plugin = read('.claude-plugin/plugin.json');
  const manifest = read('package.json');
  const lsp = read('.lsp.json');
  assert.equal(plugin.name, 'speclynx-lsp');
  assert.equal(manifest.name, `${plugin.name}-plugin`);
  assert.deepEqual(Object.keys(lsp), [plugin.name]);
  assert.equal(manifest.version, plugin.version);
  assert.equal(manifest.dependencies['@speclynx/api-language-server'], plugin.version);
  assert.equal(
    lsp[plugin.name].initializationOptions.extensionConfig.validation.applySpectralValidation,
    false,
  );
  return plugin;
}
export function checkCatalog(catalog, { bootstrap = false, readPinned } = {}) {
  assert.equal(catalog.name, 'speclynx');
  assert.ok(Array.isArray(catalog.plugins));
  if (bootstrap)
    assert.deepEqual(catalog.plugins, [], 'Bootstrap catalog must explicitly contain no entries');
  if (catalog.plugins.length === 0) return 'bootstrap';
  assert.equal(new Set(catalog.plugins.map((item) => item.name)).size, catalog.plugins.length);
  const matching = catalog.plugins.filter((item) => item.name === 'speclynx-lsp');
  if (matching.length === 0) return 'no-speclynx-entry';
  assert.equal(matching.length, 1);
  const [entry] = matching;
  assert.equal(entry.name, 'speclynx-lsp');
  assert.deepEqual(Object.keys(entry.source).sort(), ['path', 'sha', 'source', 'url']);
  assert.equal(entry.source.source, 'git-subdir');
  assert.equal(entry.source.url, repositoryUrl);
  assert.equal(entry.source.path, pluginPath);
  assert.match(entry.source.sha, /^[a-f0-9]{40}$/);
  assert.equal(
    typeof readPinned,
    'function',
    'A distribution catalog must be checked against its pinned commit',
  );
  const read = (file) => readPinned(entry.source.sha, `${pluginPath}/${file}`);
  const plugin = checkDevelopmentPlugin(read);
  assert.equal(plugin.name, entry.name);
  const lock = read('package-lock.json');
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.version, plugin.version);
  assert.equal(lock.packages[''].version, plugin.version);
  assert.equal(lock.packages[''].dependencies['@speclynx/api-language-server'], plugin.version);
  const installed = lock.packages['node_modules/@speclynx/api-language-server'];
  assert.equal(installed.version, plugin.version);
  assert.equal(
    installed.resolved,
    `https://registry.npmjs.org/@speclynx/api-language-server/-/api-language-server-${plugin.version}.tgz`,
  );
  assert.match(installed.integrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/);
  return 'distribution';
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    checkDevelopmentPlugin();
    const catalog = JSON.parse(
      readFileSync(new URL('../.claude-plugin/marketplace.json', import.meta.url)),
    );
    const result = checkCatalog(catalog, {
      bootstrap: process.argv.includes('--bootstrap'),
      readPinned: (sha, file) => {
        if (process.argv.includes('--fetch'))
          execFileSync('git', ['fetch', '--no-tags', 'origin', sha], {
            cwd: repoRoot,
            stdio: 'pipe',
          });
        return JSON.parse(
          execFileSync('git', ['show', `${sha}:${file}`], { cwd: repoRoot, encoding: 'utf8' }),
        );
      },
    });
    console.log(`Development plugin and ${result} catalog are valid.`);
  } catch {
    console.error(
      'Plugin/catalog validation failed. Inspect the development manifests and exact pinned payload locally.',
    );
    process.exitCode = 1;
  }
}
