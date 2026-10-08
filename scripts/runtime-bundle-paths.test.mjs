import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const webpack = require('webpack');
const defaults = require('../webpack.shared.config.cjs');
const loader = require('../config/tree-sitter-runtime-loader.cjs');
const { containsBuildPath, BuildPathGuardPlugin } = require('../config/webpack-build-paths.cjs');

const fixture = `
export async function runtimeBase() {
  if (typeof process === 'object' && process.versions?.node) {
    const { createRequire } = await import('module');
    var require = createRequire(import.meta.url);
  }
  var _scriptName = import.meta.url;
  return { url: _scriptName, builtin: require ? require('path').basename('/a/b') : null };
}
export const wasmAsset = () => new URL('web-tree-sitter.wasm', import.meta.url).href;
`;

function compile(config) {
  return new Promise((resolve, reject) => {
    const compiler = webpack(config);
    compiler.run((error, stats) => {
      compiler.close((closeError) => {
        if (error || closeError) reject(error || closeError);
        else resolve(stats);
      });
    });
  });
}

function fixtureConfig(root, runtime) {
  const dependency = path.join(root, 'node_modules/web-tree-sitter');
  mkdirSync(dependency, { recursive: true });
  writeFileSync(path.join(dependency, 'web-tree-sitter.js'), fixture);
  writeFileSync(path.join(dependency, 'web-tree-sitter.wasm'), 'synthetic wasm asset');
  writeFileSync(
    path.join(root, 'entry.js'),
    "export * from './node_modules/web-tree-sitter/web-tree-sitter.js';",
  );
  const loaders = path.join(root, 'config');
  mkdirSync(loaders);
  copyFileSync(
    require.resolve('../config/tree-sitter-runtime-loader.cjs'),
    path.join(loaders, 'runtime.cjs'),
  );
  writeFileSync(path.join(loaders, 'empty-wasm.cjs'), "module.exports = () => '';\n");
  const config = defaults[runtime]({
    context: root,
    entry: './entry.js',
    output: { path: path.join(root, 'dist'), filename: 'bundle.cjs', libraryTarget: 'commonjs2' },
  });
  // Each fixture owns its loaders, as independent real installations do.
  // A shared loader outside the fixture would itself change module IDs by root.
  for (const rule of config.module.rules) {
    if (rule.use?.options?.runtime) rule.use.loader = path.join(loaders, 'runtime.cjs');
    if (rule.use === 'null-loader') rule.use = path.join(loaders, 'empty-wasm.cjs');
  }
  return config;
}

test('runtime adaptation rejects upstream shape changes and unsupported targets', () => {
  for (const runtime of ['node', 'browser']) {
    const run = (source) => loader.call({ getOptions: () => ({ runtime }) }, source);
    assert.doesNotThrow(() => run(fixture));
    assert.throws(
      () => run(fixture.replace('var _scriptName', 'let _scriptName')),
      /Review changed/,
    );
    assert.throws(() => run(fixture + '\nexport const extra = import.meta.url;'), /Review changed/);
  }
  assert.throws(() => loader.call({ getOptions: () => ({ runtime: 'unknown' }) }, fixture));
});

test('output guard recognizes paths without rejecting runtime URL construction', () => {
  const root = path.join(tmpdir(), 'synthetic checkout');
  for (const value of [root, pathToFileURL(root).href, encodeURI(root), encodeURIComponent(root)]) {
    assert.ok(containsBuildPath(JSON.stringify(value + '/module.js'), [root]));
    assert.ok(
      containsBuildPath(JSON.stringify(value + '/module.js').replaceAll('/', '\\/'), [root]),
    );
  }
  for (const value of [
    'file:///synthetic/module.js',
    'file:///C:/synthetic/module.js',
    '/work/.ftlocal/record',
    'C:\\work\\.idea\\record',
  ]) {
    assert.ok(containsBuildPath(JSON.stringify(value), []));
  }
  assert.ok(
    containsBuildPath(JSON.stringify('C:\\synthetic\\checkout\\module.js'), [
      'C:\\synthetic\\checkout',
    ]),
  );
  for (const value of [
    'pathToFileURL(__filename).href',
    'self.location.href',
    '"file:///"',
    '`file:///${runtimePath}`',
    '"https://example.com/file.js"',
  ]) {
    assert.equal(containsBuildPath(value, [root]), false);
  }
});

for (const runtime of ['node', 'browser']) {
  test(`${runtime} bundles are location-independent and use their runtime location`, async () => {
    const parent = mkdtempSync(path.join(tmpdir(), 'runtime-bundles-'));
    try {
      const roots = ['one checkout', 'another/deeper/checkout'].map((name) =>
        path.join(parent, name),
      );
      const outputs = [];
      for (const root of roots) {
        const stats = await compile(fixtureConfig(root, runtime));
        assert.equal(stats.hasErrors(), false, stats.toString({ all: false, errors: true }));
        const output = path.join(root, 'dist/bundle.cjs');
        outputs.push(readFileSync(output));
        assert.equal(containsBuildPath(outputs.at(-1).toString(), roots), false);
      }
      assert.deepEqual(outputs[0], outputs[1]);
      if (runtime === 'node') {
        const installed = path.join(parent, 'installed #package.cjs');
        copyFileSync(path.join(roots[0], 'dist/bundle.cjs'), installed);
        const result = await require(installed).runtimeBase();
        assert.equal(result.url, pathToFileURL(installed).href);
        assert.equal(result.builtin, 'b');
      } else {
        for (const href of [
          'https://example.com/worker.js',
          'blob:https://example.com/worker-id',
        ]) {
          const context = { module: { exports: {} }, self: { location: { href } }, URL };
          vm.runInNewContext(outputs[0].toString(), context);
          const result = await context.module.exports.runtimeBase();
          assert.equal(result.url, href);
          assert.equal(result.builtin, null);
        }
      }
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
}

test('unadapted dependencies fail at build time even with custom target plugins', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'unadapted-bundle-'));
  try {
    writeFileSync(path.join(root, 'entry.js'), 'export const url = import.meta.url;');
    const config = defaults.node({
      context: root,
      entry: './entry.js',
      output: { path: path.join(root, 'dist'), filename: 'bundle.cjs' },
      plugins: [],
    });
    assert.ok(config.plugins.some((plugin) => plugin instanceof BuildPathGuardPlugin));
    const stats = await compile(config);
    assert.equal(stats.hasErrors(), true);
    assert.ok(
      stats.compilation.errors.some((error) =>
        error.message.includes('Generated asset contains a build path'),
      ),
    );
    for (const error of stats.compilation.errors) assert.ok(!error.message.includes(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
