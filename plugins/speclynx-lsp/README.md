# SpecLynx API Language Server (LSP)

API language server (LSP) providing validation, linting, completion, hover and navigation for OpenAPI/Swagger 2.0, OpenAPI 3.0 and 3.1 documents in JSON and YAML.

Powered by [ApiDOM](https://github.com/speclynx/apidom). Inside Claude Code it also pushes diagnostics into the context after each edit.

## Install

Installation requires a verified release entry for `speclynx-lsp` in the
[marketplace catalog](https://github.com/speclynx/vscode-openapi-toolkit/blob/main/.claude-plugin/marketplace.json).
Once that entry is present, run:

```
/plugin marketplace add speclynx/vscode-openapi-toolkit
/plugin install speclynx-lsp@speclynx
```

For local development, build and retain a server tarball, run
`node scripts/install-plugin-server.mjs --tarball /absolute/path/to/server.tgz`, then
start `claude --plugin-dir ./plugins/speclynx-lsp` from this checkout.

The language server is a dependency of this plugin, and Claude Code installs it: a plugin
that ships a `package.json` and a lockfile has `npm ci --ignore-scripts` run for it when
the plugin is cached, and `.lsp.json` launches the result. Dependency lifecycle scripts are disabled during installation. The installed server itself
runs when the plugin starts.

You need Node and `npm` resolvable from the environment Claude Code itself runs in, which
is not always the one your shell profile sets up — the usual reason a language server does
not start under a version manager.

The server is one bundled file with no dependencies of its own, so the install is a single
package. Installation time depends on the network and machine. It is pinned exactly, so a given
plugin release always runs the server released with it, and each plugin version gets its
own cached copy: upgrading cannot disturb a session still running the previous one, and
Claude Code reclaims the copies no session holds.

## Where the server runs

The plugin handles `.yaml`, `.yml` and `.json`.

Claude Code routes files to language servers by extension alone, with no way to match a filename or a path, and OpenAPI documents have no distinctive extension. So the plugin claims every YAML and JSON file in any project where it is enabled.

That is quieter than it sounds. The server recognises what it is looking at and stays silent on documents that are not API descriptions: `docker-compose.yml`, GitHub Actions workflows, Kubernetes manifests, `package.json` and `tsconfig.json` all validate clean. What the extension claim really costs is exclusivity, because the first server registered for an extension wins and the others never start. No other YAML or JSON server can run alongside this one.

Prefer scope over extensions to control that. Installing per project keeps the server where your API descriptions are and out of everything else:

```
claude plugin install speclynx-lsp@speclynx --scope project   # shared with the team
claude plugin install speclynx-lsp@speclynx --scope local     # just you, not committed
```

Both write `enabledPlugins` into the project's settings, so the plugin loads in that repository and nowhere else. Installing at user scope, the default, enables it everywhere.

Two smaller adjustments, in the plugin's `.lsp.json`. Removing `".json": "json"` from `extensionToLanguage` frees JSON for other tooling, at the cost of no longer handling `swagger.json` and other JSON specs. Setting `"diagnostics": false` keeps hover, completion and navigation while stopping diagnostics from being pushed into Claude's context after edits.

To turn the plugin off without uninstalling it:

```
claude plugin disable speclynx-lsp@speclynx
```

## Validation layers

Four layers report independently, each with its own diagnostic source so you can tell them apart:

| Source               | What it checks                                                                  |
| -------------------- | ------------------------------------------------------------------------------- |
| `OpenAPI 3.1 Schema` | the document against the official JSON Schema                                   |
| `apilint`            | ApiDOM's built-in semantic rules                                                |
| `spectral`           | your Spectral ruleset, if the workspace has one and you have turned Spectral on |
| your `source` value  | your own ApiDOM rules, if the workspace has them                                |

JSON Schema validation, reference validation and semantic linting are on by default, and this plugin's `initializationOptions` additionally enable semantic validation, because custom rules attached to a document element do not run without it. All four read data and report; none of them load code the workspace supplies, and none of them fetch a remote `$ref` while validating. Dereferencing does fetch, but it is a request a client makes deliberately, and this plugin gives Claude Code no way to make it.

One thing a rules file does supply is regular expressions, which several rule functions match against the document, and a backtracking engine can be made to spend exponential time on a pattern of a few characters. A rule whose pattern could is refused when the file is read, with a line saying which, so a repository cannot stop the server by shipping one. That check is the boundary: the patterns that remain are matched on the same thread as everything else, and a rule that is merely slow — a large document, many rules — is still slow.

Spectral is the exception, and this plugin leaves it off. Loading a ruleset means executing it: Spectral rulesets may declare custom functions, the bundler inlines that JavaScript, and the loader evaluates it inside the language server process. Since the ruleset is discovered in the workspace, turning Spectral on would mean that opening a session in a repository runs code that repository chose, before you have read a line of it. Off by default, that risk exists only for repositories that ship a ruleset, and only once you decide to run it.

To turn it on for work you trust, set `applySpectralValidation` to `true` in the `initializationOptions` of the plugin's `.lsp.json`. Claude Code takes language server configuration from plugins alone, so there is no per-project switch; a plugin update replaces the file and restores the default.

## Workspace rules files

Both kinds of custom rules are discovered in the directory you start `claude` from, which is the directory Claude Code reports to the server as the workspace root. Only that directory is searched, so a rules file in a subdirectory is never found.

To keep rules elsewhere, name them explicitly in this plugin's `.lsp.json`, under `initializationOptions.extensionConfig.validation`, as `semanticRulesFile` and `spectralRulesFile`. Both accept an absolute path, an HTTP URL, or a path relative to the project directory, so `"semanticRulesFile": "config/speclynx.json"` works. Two things to keep in mind: the setting applies to every project the plugin is enabled in, and `${CLAUDE_PROJECT_DIR}` is not substituted inside `initializationOptions`, where placeholders resolve only in `command`, `args`, `env` and `workspaceFolder`.

Rules are read once, when the session starts. Claude Code does not advertise file watching to language servers, so an edit to a rules file takes effect only after you restart the session.

ApiDOM semantic rules come from `speclynx.json`, `speclynx.yaml`, `speclynx.yml` or any of those prefixed with a dot. The file holds an array of `LinterMeta` objects. The `given` field takes an element name such as `info` or `operation`, not a JSONPath — a rule written with `given: "$.info"` silently never fires.

```json
[
  {
    "code": 8000001,
    "message": "'info.title' must not be left as a placeholder",
    "source": "my-rules",
    "severity": 1,
    "linterFunction": "apilintValueRegex",
    "linterParams": ["^(?!Placeholder Title$).+$"],
    "marker": "value",
    "target": "title",
    "given": "info"
  }
]
```

ApiDOM rules additionally require `applySemanticValidation`, which this plugin already enables, and they are data rather than code: the file is parsed and validated as rule definitions, and the functions they name have to already exist in the server. What they do supply is the patterns those functions match, which are checked as described above and dropped if evaluating one could take exponential time. With `applySemanticValidation` off they load but never report, while Spectral rules keep working, which makes the rules file look broken when the setting is the cause.

Spectral rulesets come from `.spectral.json`, `.spectral.yaml` or `.spectral.yml`, and need `applySpectralValidation`, which this plugin leaves off for the reason given above.

Give every custom Spectral rule a `formats` restriction. Rules inherited from `spectral:oas` already declare their formats and are skipped on documents that are not API descriptions, but a rule of your own that omits `formats` runs against every YAML and JSON file the plugin sees. A rule as ordinary as `given: $..name` will then report against Kubernetes manifests and CI workflows. This is the only way the plugin produces diagnostics on files that are not API descriptions, and the fix is one line:

```yaml
rules:
  my-naming-rule:
    formats: [oas2, oas3]
    given: $..name
    severity: warn
    then:
      function: pattern
      functionOptions:
        notMatch: '^internal-'
```

## Configuration

To change validation settings, override `initializationOptions.extensionConfig.validation` in the plugin's `.lsp.json`. The available keys are documented in the [server README](https://github.com/speclynx/vscode-openapi-toolkit/blob/main/server/README.md).
