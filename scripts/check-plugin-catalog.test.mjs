import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkCatalog,
  checkDevelopmentPlugin,
  pluginPath,
  repositoryUrl,
} from './check-plugin-catalog.mjs';

test('bootstrap is explicitly empty and development plugin remains checked', () => {
  assert.equal(checkCatalog({ name: 'speclynx', plugins: [] }, { bootstrap: true }), 'bootstrap');
  assert.throws(() => checkCatalog({ name: 'speclynx', plugins: [{}] }, { bootstrap: true }));
  const read = (file) => (file === '.claude-plugin/plugin.json' ? { name: 'wrong' } : {});
  assert.throws(() => checkDevelopmentPlugin(read));
  assert.doesNotThrow(() => checkDevelopmentPlugin());
});
test('distribution needs an immutable public source and reads the pinned payload', () => {
  const catalog = {
    name: 'speclynx',
    plugins: [
      {
        name: 'speclynx-lsp',
        source: {
          source: 'git-subdir',
          url: repositoryUrl,
          path: pluginPath,
          sha: 'a'.repeat(40),
        },
      },
    ],
  };
  assert.throws(() => checkCatalog(catalog));
  let read = false;
  assert.throws(() =>
    checkCatalog(catalog, {
      readPinned: (sha, file) => {
        read = true;
        assert.equal(sha, 'a'.repeat(40));
        assert.ok(file.startsWith(pluginPath));
        return { name: 'wrong-pinned-name' };
      },
    }),
  );
  assert.ok(read);
  catalog.plugins[0].source.sha = 'main';
  assert.throws(() => checkCatalog(catalog, { readPinned: () => ({}) }));
});

test('distribution validates the pinned release while development has a newer version', () => {
  const version = '1.6.0';
  const catalog = {
    name: 'speclynx',
    plugins: [
      {
        name: 'speclynx-lsp',
        source: {
          source: 'git-subdir',
          url: repositoryUrl,
          path: pluginPath,
          sha: 'a'.repeat(40),
        },
      },
    ],
  };
  const payload = {
    '.claude-plugin/plugin.json': { name: 'speclynx-lsp', version },
    'package.json': {
      name: 'speclynx-lsp-plugin',
      version,
      dependencies: { '@speclynx/api-language-server': version },
    },
    '.lsp.json': {
      'speclynx-lsp': {
        initializationOptions: {
          extensionConfig: { validation: { applySpectralValidation: false } },
        },
      },
    },
    'package-lock.json': {
      lockfileVersion: 3,
      version,
      packages: {
        '': { version, dependencies: { '@speclynx/api-language-server': version } },
        'node_modules/@speclynx/api-language-server': {
          version,
          resolved: `https://registry.npmjs.org/@speclynx/api-language-server/-/api-language-server-${version}.tgz`,
          integrity: `sha512-${'A'.repeat(86)}==`,
        },
      },
    },
  };
  const readPinned = (sha, file) => {
    assert.equal(sha, 'a'.repeat(40));
    return payload[file.slice(pluginPath.length + 1)];
  };
  assert.equal(checkCatalog(catalog, { readPinned }), 'distribution');
  payload['package-lock.json'].packages['node_modules/@speclynx/api-language-server'].resolved =
    'https://example.invalid/unreviewed.tgz';
  assert.throws(() => checkCatalog(catalog, { readPinned }));
  assert.equal(
    checkCatalog({ name: 'speclynx', plugins: [{ name: 'unrelated' }] }),
    'no-speclynx-entry',
  );
});
