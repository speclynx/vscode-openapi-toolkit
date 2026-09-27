# Contributing to OpenAPI Toolkit

OpenAPI Toolkit contains the VS Code extension, its Node and browser language-server
bundles, the standalone npm server and the Claude Code plugin. Parsing and language
features use [ApiDOM](https://github.com/speclynx/apidom) and
[API Language Service](https://github.com/speclynx/api-languageservice).

## Development branch and source history

Use `main` as the base for development and pull requests. It contains the standalone
language server, the extension, the plugin and the release workflows.

The source was introduced as a single snapshot commit on top of the repository's
existing public documentation history. Earlier development history is not included.
Existing release tags retain their original documentation commits; they do not
identify the source used to build those older release assets. Future release tags
identify the source used by the release workflow.

## Set up and build

Use the Node version in `.nvmrc` and its bundled npm. Dependencies are on the public
npm registry; no registry credential is needed.

```sh
nvm use
npm ci
npm run build:dev
npm run build:prod
```

`client/src/node` and `client/src/browser` contain the extension entry points.
`server/src/node` contains the VS Code server and standalone CLI entry points;
`server/src/browser` contains the worker entry point. Shared server code is under
`server/src/speclynxServer`, with Spectral integration under `server/src/spectral`.

For an unbundled desktop debug session, temporarily set `package.json`'s `main` to
`./client/out/node/speclynxClientMain.js`, then use **Launch Node Client** in VS Code.
Restore the manifest before committing or packaging. **Attach to Server** connects
the server debugger. For **Launch Browser Client**, build the production browser
bundles first with `npm run build:prod:browser`.

## Verify changes

Generate the server declarations before typed lint and type checks. The standalone
consumer fixture resolves the package name through its published exports map.

```sh
npm run build:types --workspace=server
npm run lint
npm run typescript:check-types
npm run check:publication
npm run test:tooling
npm run release:check
npm run build:prod
npm test
npm run vscode:package
```

On headless Linux, use `xvfb-run -a npm test`. Server tests are under `server/src/test`;
extension tests are under `client/src/test`. `npm test` includes server unit, stdio,
package-consumer, plugin and desktop extension tests. Release verification also checks
the retained npm archive and VSIX described in [RELEASE.md](./RELEASE.md).

`npm run test:web` opens VS Code in Chromium for browser verification. Check worker
startup, diagnostics, completion, both JSON/YAML conversions and both preview renderers.
Record the tested source/artifact identity and results; desktop tests do not cover the worker.

## Try the standalone server and plugin

```sh
npm run build:standalone
node server/dist/node/cli.js --stdio
```

For a local Claude Code session, install a retained server archive into the development
plugin, then load that directory directly (the bootstrap marketplace is empty):

```sh
node scripts/install-plugin-server.mjs --tarball /absolute/path/to/server.tgz
claude --plugin-dir ./plugins/speclynx-lsp
```

The default plugin directory is `plugins/speclynx-lsp`; `--plugin-dir` can select an
isolated copy. See the [plugin README](./plugins/speclynx-lsp/README.md) for behavior
and validation settings. Local use is separate from testing the released catalog pin.

## Pull requests

Explain the behavior changed and how it was verified. Include regression coverage for
behavior changes, keep generated build products out of commits, and inspect staged files
before committing. Use sanitized examples in reports. See [SECURITY.md](./SECURITY.md)
for privately reporting vulnerabilities and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
for participation expectations.

Browser checks run against the production bundles after `npm run build:prod`:

```sh
node node_modules/playwright/cli.js install chromium
npm run test:browser
npm run test:previews
```

The preview check uses the extension's CSP and initializer scripts, verifies initial
rendering and document updates for both renderers, and rejects automatic external
requests. It uses synthetic documents and blocks all external browser traffic. Set
`SPECLYNX_PREVIEW_ASSETS` to an extracted VSIX's `client/dist/preview/webview` directory
to run the same preview checks against packaged assets.
