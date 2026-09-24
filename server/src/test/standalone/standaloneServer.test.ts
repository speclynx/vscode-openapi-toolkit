import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Diagnostic } from 'vscode-languageserver-protocol';
import { LspTestClient } from './lspTestClient';
import { PLACEHOLDER_TITLE, PLUGIN_RULE_CODE, PLUGIN_RULE_MESSAGE } from './fixtures/pluginRule';

/**
 * Resolved from the `bin` field rather than hardcoded, so these tests always
 * exercise the artifact the package actually publishes. A published CLI that no
 * test ran is how a server that crashed on startup once reached a release
 * candidate unnoticed.
 */
const SERVER_PATH = path.resolve(
  (
    JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8')) as {
      bin: Record<string, string>;
    }
  ).bin['speclynx-lsp'],
);
const PLUGIN_SERVER_PATH = path.resolve('out/test/standalone/fixtures/pluginServer.js');

const OPENAPI_DOCUMENT = `openapi: 3.1.0
info:
  title: ${PLACEHOLDER_TITLE}
  version: 1.0.0
paths: {}
`;

/**
 * A ruleset the bundled OpenAPI rules never produce, so a diagnostic carrying
 * this code proves the workspace ruleset was discovered, read and applied.
 */
const SPECTRAL_RULESET = `rules:
  title-must-not-be-a-placeholder:
    description: The API title must not be a placeholder
    given: $.info.title
    severity: error
    then:
      function: pattern
      functionOptions:
        notMatch: "^Placeholder Title$"
`;

const SPECTRAL_RULE_CODE = 'title-must-not-be-a-placeholder';
const WORKSPACE_PACKAGE_RULE = 'reported-by-a-workspace-package';
const HTTP_RULE = 'reported-by-a-served-ruleset';

const spectralValidationConfig = {
  validation: {
    applyJsonSchemaValidation: true,
    semanticLinting: true,
    applySpectralValidation: true,
  },
};

function hasSpectralRuleViolation(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.code === SPECTRAL_RULE_CODE);
}

function diagnosticMessageIncludes(diagnostic: Diagnostic, text: string): boolean {
  const message: unknown = diagnostic.message;
  const plainText = typeof message === 'string' ? message : (message as { value: string }).value;
  return plainText.includes(text);
}

describe('Standalone LSP server', function () {
  let workspaceDir: string;
  let client: LspTestClient | undefined;

  beforeEach(function () {
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'speclynx-lsp-'));
    fs.writeFileSync(path.join(workspaceDir, 'openapi.yaml'), OPENAPI_DOCUMENT);
    fs.writeFileSync(path.join(workspaceDir, '.spectral.yaml'), SPECTRAL_RULESET);
  });

  afterEach(function () {
    client?.stop();
    client = undefined;
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  });

  it('advertises its language features over stdio', async function () {
    client = new LspTestClient({ serverPath: SERVER_PATH, workspaceDir });

    const { capabilities } = await client.initialize();

    assert.strictEqual(capabilities.hoverProvider, true);
    assert.strictEqual(capabilities.definitionProvider, true);
    assert.strictEqual(capabilities.referencesProvider, true);
    assert.strictEqual(capabilities.documentSymbolProvider, true);
    assert.strictEqual(capabilities.documentFormattingProvider, true);
    assert.strictEqual(capabilities.completionProvider?.resolveProvider, false);
    assert.notStrictEqual(capabilities.semanticTokensProvider, undefined);
  });

  it('validates a document without any VS Code client support', async function () {
    client = new LspTestClient({ serverPath: SERVER_PATH, workspaceDir });
    await client.initialize();

    const uri = client.openDocument(
      'openapi.yaml',
      'openapi: 3.1.0\ninfo:\n  title: Missing Version\npaths: {}\n',
    );
    const diagnostics = await client.waitForDiagnostics(uri, (found) => found.length > 0);

    assert.ok(
      diagnostics.some((diagnostic) => diagnosticMessageIncludes(diagnostic, 'version')),
      `expected a diagnostic about the missing version, got ${JSON.stringify(diagnostics)}`,
    );
  });

  it('never sends VS Code specific requests when a runtime is available', async function () {
    client = new LspTestClient({ serverPath: SERVER_PATH, workspaceDir });
    await client.initialize({ extensionConfig: spectralValidationConfig });

    const uri = client.openDocument('openapi.yaml', OPENAPI_DOCUMENT);
    await client.waitForDiagnostics(uri, hasSpectralRuleViolation);

    assert.deepStrictEqual(
      client.rejectedRequests,
      [],
      `the server must not depend on custom client requests: ${client.rejectedRequests.join(', ')}`,
    );
  });

  it('keeps the configuration given through initializationOptions across reloads', async function () {
    client = new LspTestClient({ serverPath: SERVER_PATH, workspaceDir });
    await client.initialize({ extensionConfig: spectralValidationConfig });

    const uri = client.openDocument('openapi.yaml', OPENAPI_DOCUMENT);
    const diagnostics = await client.waitForDiagnostics(uri, hasSpectralRuleViolation);

    assert.ok(
      hasSpectralRuleViolation(diagnostics),
      'Spectral validation enabled through initializationOptions must survive the reload',
    );
  });

  it('reads its configuration from the file given with --config', async function () {
    const configFile = path.join(workspaceDir, 'speclynx-server.json');
    fs.writeFileSync(configFile, JSON.stringify(spectralValidationConfig));

    client = new LspTestClient({
      serverPath: SERVER_PATH,
      workspaceDir,
      serverArgs: ['--config', configFile],
    });
    await client.initialize();

    const uri = client.openDocument('openapi.yaml', OPENAPI_DOCUMENT);
    const diagnostics = await client.waitForDiagnostics(uri, hasSpectralRuleViolation);

    assert.ok(
      hasSpectralRuleViolation(diagnostics),
      'the ruleset enabled by the --config file must be applied',
    );
  });

  it('discovers the workspace Spectral ruleset through the Node runtime', async function () {
    client = new LspTestClient({ serverPath: SERVER_PATH, workspaceDir });
    await client.initialize({ extensionConfig: spectralValidationConfig });

    const uri = client.openDocument('openapi.yaml', OPENAPI_DOCUMENT);
    const diagnostics = await client.waitForDiagnostics(uri, hasSpectralRuleViolation);

    const violation = diagnostics.find((diagnostic) => diagnostic.code === SPECTRAL_RULE_CODE);
    assert.strictEqual(violation?.source, 'spectral');
  });

  it('loads a ruleset that extends a package installed in the workspace', async function () {
    // Spectral's own packages come from the bundle, but everything else a
    // ruleset imports must still resolve where the workspace put it. A loader
    // that rewrote this import to a CDN would reach the network instead, and
    // fail where there is none.
    const packageDir = path.join(workspaceDir, 'node_modules', '@fixture', 'ruleset');
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, 'package.json'),
      JSON.stringify({
        name: '@fixture/ruleset',
        version: '1.0.0',
        type: 'module',
        main: 'index.js',
      }),
    );
    fs.writeFileSync(
      path.join(packageDir, 'index.js'),
      `export default {
         rules: {
           '${WORKSPACE_PACKAGE_RULE}': {
             given: '$.info',
             severity: 0,
             message: 'reported by a ruleset installed in the workspace',
             then: { function: () => [{ message: 'reported by a ruleset installed in the workspace' }] },
           },
         },
       };`,
    );
    fs.writeFileSync(path.join(workspaceDir, '.spectral.yaml'), `extends: ['@fixture/ruleset']\n`);

    client = new LspTestClient({ serverPath: SERVER_PATH, workspaceDir });
    await client.initialize({ extensionConfig: spectralValidationConfig });

    const uri = client.openDocument('openapi.yaml', OPENAPI_DOCUMENT);
    const diagnostics = await client.waitForDiagnostics(uri, (found) =>
      found.some((diagnostic) => diagnostic.code === WORKSPACE_PACKAGE_RULE),
    );

    assert.ok(
      diagnostics.some((diagnostic) => diagnostic.code === WORKSPACE_PACKAGE_RULE),
      `expected the workspace package's rule to report, got ${JSON.stringify(diagnostics)}`,
    );
  });

  it('loads a ruleset served over http', async function () {
    // The bundler reads `ok`, `statusText` and `text()` off whatever the IO's
    // fetch returns, so a ruleset named by URL — which the settings document as
    // supported — exercises a contract nothing else does. It imports a Spectral
    // function as any real ruleset would: a remote ruleset is bundled relative
    // to its own address, so without a resolver that answers for Spectral's own
    // packages first, that import is fetched from the server serving the
    // ruleset, which has never heard of it.
    const ruleset = `import { truthy } from '@stoplight/spectral-functions';
      export default { rules: { '${HTTP_RULE}': { given: '$.info', severity: 0,
        message: 'reported by a ruleset served over http',
        then: { field: 'x-served-over-http', function: truthy } } } };`;
    const server = http.createServer((request, response) => {
      if (request.url !== '/ruleset.js') {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { 'content-type': 'text/javascript' });
      response.end(ruleset);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };

    try {
      client = new LspTestClient({ serverPath: SERVER_PATH, workspaceDir });
      await client.initialize({
        extensionConfig: {
          validation: {
            ...spectralValidationConfig.validation,
            spectralRulesFile: `http://127.0.0.1:${port}/ruleset.js`,
          },
        },
      });

      const uri = client.openDocument('openapi.yaml', OPENAPI_DOCUMENT);
      const diagnostics = await client.waitForDiagnostics(uri, (found) =>
        found.some((diagnostic) => diagnostic.code === HTTP_RULE),
      );

      assert.ok(
        diagnostics.some((diagnostic) => diagnostic.code === HTTP_RULE),
        `expected the rule from the served ruleset, got ${JSON.stringify(diagnostics)}`,
      );
    } finally {
      server.close();
    }
  });

  it('drops a workspace rule whose pattern cannot be evaluated in bounded time', async function () {
    // A rules file is workspace input, and several linter functions hand their
    // pattern straight to a backtracking engine on the thread that answers
    // every request. `^(a+)+$` against a string it cannot match takes time
    // exponential in that string's length, so a repository could stop the
    // server dead by shipping this file. The safe rule beside it is what proves
    // the server is still answering rather than merely quiet.
    const rules = [
      {
        code: 9001,
        message: 'title must match a pattern that cannot be evaluated',
        severity: 1,
        linterFunction: 'apilintValueRegex',
        linterParams: ['^(a+)+$'],
        given: 'info',
        target: 'title',
      },
      {
        code: 9002,
        message: 'title must be digits',
        severity: 1,
        linterFunction: 'apilintValueRegex',
        linterParams: ['^[0-9]+$'],
        given: 'info',
        target: 'title',
      },
    ];
    fs.writeFileSync(path.join(workspaceDir, 'speclynx.json'), JSON.stringify(rules));

    client = new LspTestClient({ serverPath: SERVER_PATH, workspaceDir });
    await client.initialize({
      extensionConfig: {
        validation: {
          applyJsonSchemaValidation: true,
          semanticLinting: true,
          applySemanticValidation: true,
        },
      },
    });

    // The title is what makes the unbounded pattern expensive: letters it can
    // match, then a character it cannot.
    const uri = client.openDocument(
      'openapi.yaml',
      `openapi: 3.1.0\ninfo:\n  title: ${'a'.repeat(32)}!\n  version: 1.0.0\npaths: {}\n`,
    );
    const diagnostics = await client.waitForDiagnostics(uri, (found) =>
      found.some((diagnostic) => diagnostic.code === 9002),
    );

    assert.ok(
      !diagnostics.some((diagnostic) => diagnostic.code === 9001),
      `the rule with the unbounded pattern must not be applied, got ${JSON.stringify(diagnostics)}`,
    );
  });

  it('keeps validating when the workspace ruleset cannot be loaded', async function () {
    // A ruleset is whatever the workspace happens to contain. This one names a
    // function that does not exist, which is enough to fail the load.
    fs.writeFileSync(
      path.join(workspaceDir, '.spectral.yaml'),
      'extends: ./does-not-exist.yaml\nrules: {}\n',
    );
    client = new LspTestClient({ serverPath: SERVER_PATH, workspaceDir });
    await client.initialize({ extensionConfig: spectralValidationConfig });

    const uri = client.openDocument(
      'openapi.yaml',
      'openapi: 3.1.0\ninfo:\n  title: Missing Version\npaths: {}\n',
    );
    const diagnostics = await client.waitForDiagnostics(uri, (found) => found.length > 0);

    assert.ok(
      diagnostics.some((diagnostic) => diagnosticMessageIncludes(diagnostic, 'version')),
      `a broken ruleset must not stop the other layers reporting, got ${JSON.stringify(diagnostics)}`,
    );
  });

  it('watches the rules file with a standard glob pattern', async function () {
    client = new LspTestClient({
      serverPath: SERVER_PATH,
      workspaceDir,
      clientCapabilities: {
        workspace: {
          workspaceFolders: true,
          didChangeWatchedFiles: { dynamicRegistration: true },
        },
      },
    });
    await client.initialize({ extensionConfig: spectralValidationConfig });

    const uri = client.openDocument('openapi.yaml', OPENAPI_DOCUMENT);
    await client.waitForDiagnostics(uri, hasSpectralRuleViolation);

    const watcherRegistration = client.registrations.find(
      (registration) => registration.method === 'workspace/didChangeWatchedFiles',
    );
    assert.notStrictEqual(watcherRegistration, undefined, 'expected a file watcher registration');

    const options = watcherRegistration?.registerOptions as {
      watchers: { globPattern: unknown }[];
    };
    // A glob pattern is `/` separated on every platform, so the expectation is
    // written the same way rather than with the native separator.
    assert.deepStrictEqual(
      options.watchers.map((watcher) => watcher.globPattern),
      [path.join(workspaceDir, '.spectral.yaml').split(path.sep).join('/')],
    );
  });

  it('advertises and answers full-document semantic tokens', async function () {
    client = new LspTestClient({ serverPath: SERVER_PATH, workspaceDir });

    const { capabilities } = await client.initialize();

    // A capability declaring neither `full` nor `range` claims support for
    // neither request, so a conforming client never asks and highlighting is
    // silently dead. Advertising it is not enough on its own either, hence the
    // round trip below.
    const provider = capabilities.semanticTokensProvider as
      { full?: unknown; legend?: { tokenTypes: string[] } } | undefined;
    assert.notStrictEqual(provider, undefined, 'expected a semanticTokensProvider');
    assert.notStrictEqual(provider?.full, undefined, 'semanticTokensProvider must declare `full`');
    assert.ok((provider?.legend?.tokenTypes.length ?? 0) > 0, 'expected a non-empty legend');

    const uri = client.openDocument('openapi.yaml', OPENAPI_DOCUMENT);
    // Tokens are only produced once the document has been parsed, and any
    // publication for it proves that happened.  Waiting for a particular
    // diagnostic instead would wait for the timeout, since the default
    // configuration this test uses reports nothing for this document.
    await client.waitForDiagnostics(uri);

    const tokens = await client.request<{ data: number[] }>('textDocument/semanticTokens/full', {
      textDocument: { uri },
    });
    assert.ok(
      Array.isArray(tokens?.data) && tokens.data.length > 0,
      `expected semantic tokens for the document, got ${JSON.stringify(tokens)}`,
    );
    assert.strictEqual(tokens.data.length % 5, 0, 'token data is encoded in groups of five');

    // The capability belongs in the initialize result, not in a registration
    // sent afterwards: a registration reaches only clients that support dynamic
    // registration, and its document selector restates what the client already
    // scoped when it attached the server to the document.
    assert.deepStrictEqual(
      client.registrations.filter(
        (registration) => registration.method === 'textDocument/semanticTokens',
      ),
      [],
    );
  });

  it('does not register a file watcher with a client that cannot watch files', async function () {
    client = new LspTestClient({ serverPath: SERVER_PATH, workspaceDir });
    await client.initialize({ extensionConfig: spectralValidationConfig });

    const uri = client.openDocument('openapi.yaml', OPENAPI_DOCUMENT);
    await client.waitForDiagnostics(uri, hasSpectralRuleViolation);

    assert.deepStrictEqual(
      client.registrations.filter(
        (registration) => registration.method === 'workspace/didChangeWatchedFiles',
      ),
      [],
    );
  });

  describe('metadata plugins', function () {
    // Rules attached to a document element are only evaluated when semantic
    // validation is on, which the built-in defaults leave off.
    const semanticValidationConfig = {
      extensionConfig: {
        validation: {
          applyJsonSchemaValidation: true,
          semanticLinting: true,
          applySemanticValidation: true,
        },
      },
    };

    function countPluginRuleViolations(diagnostics: Diagnostic[]): number {
      return diagnostics.filter((diagnostic) => diagnostic.code === PLUGIN_RULE_CODE).length;
    }

    function hasPluginRuleViolation(diagnostics: Diagnostic[]): boolean {
      return countPluginRuleViolations(diagnostics) > 0;
    }

    it('applies the rules and linter functions contributed by a plugin', async function () {
      client = new LspTestClient({ serverPath: PLUGIN_SERVER_PATH, workspaceDir });
      await client.initialize(semanticValidationConfig);

      const uri = client.openDocument('openapi.yaml', OPENAPI_DOCUMENT);
      const diagnostics = await client.waitForDiagnostics(uri, hasPluginRuleViolation);

      const violation = diagnostics.find((diagnostic) => diagnostic.code === PLUGIN_RULE_CODE);
      assert.strictEqual(violation?.message, PLUGIN_RULE_MESSAGE);
      assert.strictEqual(violation?.source, 'plugin-test');
    });

    it('keeps the built-in rules that the plugin extends', async function () {
      client = new LspTestClient({ serverPath: PLUGIN_SERVER_PATH, workspaceDir });
      await client.initialize(semanticValidationConfig);

      // `info` is an element the built-in metadata already describes, so the
      // plugin rule must be appended to those rules rather than replace them.
      const uri = client.openDocument(
        'openapi.yaml',
        `openapi: 3.1.0\ninfo:\n  title: ${PLACEHOLDER_TITLE}\npaths: {}\n`,
      );
      const diagnostics = await client.waitForDiagnostics(uri, hasPluginRuleViolation);

      assert.ok(
        diagnostics.some((diagnostic) => diagnosticMessageIncludes(diagnostic, 'version')),
        `expected the built-in rule about the missing version too, got ${JSON.stringify(diagnostics)}`,
      );
    });

    it('reports a plugin rule once however often the metadata is rebuilt', async function () {
      client = new LspTestClient({ serverPath: PLUGIN_SERVER_PATH, workspaceDir });
      await client.initialize(semanticValidationConfig);

      const uri = client.openDocument('openapi.yaml', OPENAPI_DOCUMENT);
      const diagnostics = await client.waitForDiagnostics(uri, hasPluginRuleViolation);

      // The metadata API Language Service hands out shares its values between calls, so a
      // merge that wrote into them would leave the plugin's rules behind and
      // report them once more for every rebuild.  Startup rebuilds twice, and
      // every configuration change and watched file event rebuilds again.
      assert.strictEqual(
        countPluginRuleViolations(diagnostics),
        1,
        `expected the plugin rule to be reported once, got ${JSON.stringify(diagnostics)}`,
      );

      await client.request('apidom/reload', null);
      const afterReload = await client.waitForDiagnostics(
        client.openDocument('reloaded.yaml', OPENAPI_DOCUMENT),
        hasPluginRuleViolation,
      );

      assert.strictEqual(
        countPluginRuleViolations(afterReload),
        1,
        `expected the plugin rule to survive a reload without duplicating, got ${JSON.stringify(afterReload)}`,
      );
    });
  });
});
