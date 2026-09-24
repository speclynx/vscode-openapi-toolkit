import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The plugin has no code: it declares the server as a dependency, Claude Code
 * installs it beside the plugin, and `.lsp.json` launches it. What can go wrong
 * is therefore not behaviour but agreement — between the path the plugin
 * launches and the path the package installs to, and between the validation
 * layers the plugin turns on and the ones that are safe to turn on unattended.
 */
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const PLUGIN_ROOT = path.join(REPO_ROOT, 'plugins/speclynx-lsp');

function readJson<T>(...segments: string[]): T {
  return JSON.parse(fs.readFileSync(path.join(...segments), 'utf-8')) as T;
}

describe('Claude Code plugin configuration', function () {
  const lspConfig = readJson<
    Record<
      string,
      {
        args: string[];
        initializationOptions: { extensionConfig: { validation: Record<string, unknown> } };
      }
    >
  >(PLUGIN_ROOT, '.lsp.json')['speclynx-lsp'];

  it('launches the file the package installs', function () {
    const server = readJson<{ name: string; bin: Record<string, string> }>(
      REPO_ROOT,
      'server/package.json',
    );
    const binary = path.posix.normalize(server.bin['speclynx-lsp']);
    const expected = `\${CLAUDE_PLUGIN_ROOT}/${path.posix.join('node_modules', server.name, binary)}`;

    assert.strictEqual(
      lspConfig.args[0],
      expected,
      'the plugin must launch the executable the package declares, in the directory Claude Code installs it to',
    );
  });

  it('declares the server as a dependency, pinned exactly', function () {
    const server = readJson<{ name: string; version: string }>(REPO_ROOT, 'server/package.json');
    const plugin = readJson<{ dependencies: Record<string, string> }>(PLUGIN_ROOT, 'package.json');

    assert.strictEqual(
      plugin.dependencies[server.name],
      server.version,
      'a range would let one plugin release install different servers for different users',
    );
  });

  it('does not enable Spectral, which would execute the workspace ruleset', function () {
    // Loading a ruleset runs it: rulesets may declare custom functions, the
    // bundler inlines that JavaScript, and the loader evaluates it in the server
    // process. The ruleset is discovered in the workspace, so enabling Spectral
    // here would run code chosen by whatever repository the session opened.
    const { validation } = lspConfig.initializationOptions.extensionConfig;

    assert.strictEqual(validation.applySpectralValidation, false);
    // The layers that stay on read data and report; none of them run anything
    // the workspace supplies.
    assert.strictEqual(validation.applyJsonSchemaValidation, true);
    assert.strictEqual(validation.applySemanticValidation, true);
    assert.strictEqual(validation.semanticLinting, true);
  });
});
