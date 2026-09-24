# SpecLynx API Language Server (LSP)

API language server (LSP) providing validation, linting, completion, hover and navigation for OpenAPI/Swagger 2.0, OpenAPI 3.0 and 3.1 documents in JSON and YAML.

A standalone [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) server powered by [ApiDOM](https://github.com/swagger-api/apidom), which also adds semantic highlighting. This is the same server that backs the SpecLynx OpenAPI Toolkit VS Code extension, packaged so that any LSP client can run it.

## Installation

```bash
npm install --global @speclynx/api-language-server
```

The package installs a `speclynx-lsp` executable. It can also be run without installing:

```bash
npx @speclynx/api-language-server
```

The server ships as a single bundled file with no dependencies, so installing it fetches
one package rather than the few hundred it is built from, and what runs is exactly what
was tested. Both commands require the package to be on npm; before the first release it is
not, and building it from a checkout produces the same artifact:

```bash
npm ci
npm --workspace=server run build:standalone
node server/dist/node/cli.js         # the same executable the package installs
```

## Running the server

The server communicates over stdio, so it is started by the editor rather than by hand:

```bash
speclynx-lsp
speclynx-lsp --config ./speclynx-server.json
```

When `--config` is omitted the server looks for `.speclynx-server.json` in the working directory it was launched from. Configuration sent by the client through `initializationOptions.extensionConfig` takes precedence over the configuration file.

## Configuration

The configuration file holds the settings object directly:

```json
{
  "validation": {
    "applyJsonSchemaValidation": true,
    "betterErrorsForJsonSchema": true,
    "applySemanticValidation": false,
    "referenceValidation": true,
    "semanticLinting": true,
    "semanticRulesFile": "",
    "semanticMaxNumberOfProblems": 1000,
    "applySpectralValidation": false,
    "spectralRulesFile": "",
    "markFirstLineOnlyOfSpectralProblem": false
  },
  "logging": {
    "server": "off"
  }
}
```

JSON Schema validation, reference validation and semantic linting are enabled by default; Spectral linting is not. Clients that implement `workspace/configuration` are asked for the `speclynx.openapi` section, and clients that send `workspace/didChangeConfiguration` can update the settings at any time. Clients that do nothing beyond the initialize handshake keep the configuration they passed in `initializationOptions`.

## Rules files

Two kinds of custom rules are supported, both discovered in the roots of the workspace folders reported during initialization.

ApiDOM semantic rules are read from `speclynx.json`, `speclynx.yaml`, `speclynx.yml`, or any of those names prefixed with a dot. The file holds an array of ApiDOM `LinterMeta` objects, which are appended to the built-in OpenAPI rules.

The file comes from the workspace, so it is read as input rather than trusted as configuration. Rules that name a pattern the regular expression engine could spend exponential time on — `^(a+)+$` and its relatives — are dropped when the file is read, with a line naming the rule and the pattern, because that time would be spent on the thread that answers every request.

[Spectral](https://docs.stoplight.io/docs/spectral) rulesets are read from `.spectral.json`, `.spectral.yaml` or `.spectral.yml`, and are applied when `validation.applySpectralValidation` is enabled. Enabling it means running the ruleset, not just reading it: a ruleset may declare custom functions, and the bundler inlines that JavaScript and the loader evaluates it in this process. Since the ruleset is discovered in the workspace, enable Spectral for workspaces you would be willing to run — it is off by default for this reason.

Either location can be overridden with `validation.semanticRulesFile` and `validation.spectralRulesFile`, which accept a path or an HTTP URL. A Spectral ruleset given by URL is bundled relative to that URL: Spectral's own packages come from the server, and anything else it imports is fetched from beside it rather than resolved in the workspace. A ruleset on disk has no such limit — it may extend packages the workspace has installed, which resolve from there. Relative paths are resolved against the server's working directory, which is normally the directory the editor or agent launched it from. When the client supports dynamic registration of file watchers, the rules files are watched and the rules reloaded when they change; otherwise the rules are reloaded on the `apidom/reload` request.

## Editor configuration

Any client able to launch a language server over stdio can use the server. The two examples below cover the common shape of that configuration.

Neovim 0.11 or later, using the built-in client, with no plugin required:

```lua
vim.lsp.config('speclynx_api_lsp', {
  cmd = { 'speclynx-lsp' },
  filetypes = { 'json', 'yaml' },
  root_markers = { 'openapi.yaml', 'openapi.json', '.spectral.yaml' },
  init_options = {
    extensionConfig = {
      validation = {
        applyJsonSchemaValidation = true,
        semanticLinting = true,
        applySpectralValidation = true,
      },
    },
  },
})

vim.lsp.enable('speclynx_api_lsp')
```

Helix, in `languages.toml`:

```toml
[language-server.speclynx-lsp]
command = "speclynx-lsp"

[language-server.speclynx-lsp.config.extensionConfig.validation]
applyJsonSchemaValidation = true
semanticLinting = true

[[language]]
name = "yaml"
language-servers = ["speclynx-lsp"]
```

### When the editor cannot find `speclynx-lsp`

A graphical editor started from a desktop launcher does not inherit the `PATH` from your shell profile, so a server installed under a version manager such as nvm, fnm, asdf or volta is invisible to it even though the command works in a terminal. In a JetBrains IDE this surfaces as:

```
Cannot run program "speclynx-lsp": Exec failed, error: 2 (No such file or directory)
```

Pointing the editor at the absolute path of `speclynx-lsp` is not enough on its own. The file begins with `#!/usr/bin/env node`, so launching it still requires `node` on the editor's `PATH`, and under a version manager `node` lives in the same directory that is missing. The second attempt then fails with `/usr/bin/env: 'node': No such file or directory`, which looks like a different problem but has the same cause.

Give the editor both absolute paths instead, so no lookup happens at all:

```sh
command -v node                          # /…/node
readlink -f "$(command -v speclynx-lsp)" # /…/api-language-server/dist/node/cli.js
```

and configure the command as `<node> <bin.js>` — for example, in LSP4IJ's Command field, or as the `cmd` of the `vim.lsp.config` call above. Note that this pins the version manager's current runtime directory, so it needs updating when you change the active version of Node.

To fix it once for every graphical editor rather than per editor, make the runtime visible to desktop sessions: symlink `node` into a directory already on the system `PATH`, or add the version manager's `bin` directory to `~/.profile` and log in again. Launching the editor from a terminal also works, since it then inherits the shell's environment.

## Language features

The server advertises text document synchronization, completion, hover, go to definition, find references, document symbols, document links, semantic tokens, quick fix code actions and document formatting. Diagnostics are published as documents are opened and edited.

Beyond the standard protocol it answers three custom requests: `apidom/deref` dereferences a document, `apidom/convert` converts between JSON and YAML, and `apidom/reload` reloads the configuration and rules.

## Programmatic use

`startServer` attaches all handlers to a connection you create, which lets you embed the server in your own binary:

```typescript
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { startServer } from '@speclynx/api-language-server';
import { NodeServerRuntime } from '@speclynx/api-language-server/node';

const connection = createConnection(ProposedFeatures.all, process.stdin, process.stdout);

startServer(connection, new NodeServerRuntime());
```

Types ship with the package and refer to the four packages the API is written in terms of:
`vscode-languageserver`, `vscode-languageserver-protocol`, `vscode-languageserver-textdocument`
and `@speclynx/api-languageservice`. They are declared as optional peer dependencies, so installing the
server for the command line pulls in nothing, while embedding it means installing them too —
which a project embedding a language server needs anyway, to build a connection and to
describe rules.

What crosses the boundary is data and plain functions: a linter function receives elements
the bundled ApiDOM created, so read them through the element API rather than through your
own copy of ApiDOM.

The licences of everything bundled into the package are in `dist/node/THIRD-PARTY-NOTICES.txt`,
generated from the modules actually included. The few packages that publish no licence file of
their own have a reviewed copy of their notice in `config/licenses`, recorded with where it came
from; a bundled package whose notice cannot be found stops the build.

The runtime is what decouples the server from any particular host. `NodeServerRuntime` reads files and discovers rules files with the Node filesystem. A client that would rather serve files itself can supply its own `readFile`, `findDefaultRulesFile`, `findDefaultSpectralRulesFile` and `buildWatcherPattern`; whichever methods are left out fall back to the corresponding `apidom/*` request sent to the client.

## Custom rules and linter functions

Rules files can only express declarative rules. Rules that need code are supplied as metadata plugins, which is how a specialized server for another specification is built on top of this one:

```typescript
import { NodeServerRuntime } from '@speclynx/api-language-server/node';
import { config as arazzoConfig } from '@jentic/arazzo-validator';

const runtime = new NodeServerRuntime({
  metadataPlugins: [{ config: arazzoConfig }],
});
```

Each plugin contributes an ApiDOM `Metadata` object. Its metadata maps, linter functions, rules, symbols and tokens are merged into the built-in OpenAPI configuration before the language service is created, so plugin rules are evaluated alongside the built-in ones and can call their own linter functions. Rules attached to a document element through `metadataMaps` are only evaluated when `validation.applySemanticValidation` is enabled, which is not the default.

## License

Apache-2.0
