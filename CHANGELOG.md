# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# Unreleased

### Bug Fixes

- parse more YAML correctly, including block scalars, escapes in double-quoted strings, aliases and flow collections
- resolve references to files whose paths contain encoded characters or `?`
- report each error in an externally referenced document once
- mask credentials in errors about references fetched over HTTP

### Improvements

- update SpecLynx ApiDOM to 7.0.2 and `@speclynx/api-languageservice` to 3.0.4, which validates with precompiled JSON Schema validators

# 1.6.2 (2026-11-04)

1.6.1 was tagged but never published: its release build failed before publishing anything.

### Security

- run Spectral, whose rulesets can run code, only in trusted workspaces, and keep the workspace from choosing the rules files in Restricted Mode
- update `follow-redirects` to 1.16.2 and `fast-uri` to 3.1.9, both bundled into the extension and the language server
- update `undici`, `qs`, `serialize-javascript` and `@azure/msal-node` in the build tooling to patched releases

# 1.6.0 (2026-10-13)

### Features

- ship the language server as a package of its own, `@speclynx/api-language-server`
- ship a Claude Code plugin, so Claude validates and lints the OpenAPI documents it edits

### Bug Fixes

- load Spectral rulesets given as an HTTP URL
- keep validating when a Spectral ruleset fails to load
- ignore workspace rules whose pattern cannot be evaluated in bounded time
- describe the rules file names the extension actually looks for
- generate server declarations before CI lint and type checks
- scope release secret-scan approvals to extracted files and archive metadata

### Security

- update `brace-expansion` to patched releases and `serialize-javascript` to 7.1.2
- remove the vulnerable `braces` dependency chain by dropping unused `@babel/cli` and upgrading `@vscode/vsce` to 4.0.0

### Performance Improvements

- update SpecLynx ApiDOM core and reference packages to 5.2.4
- use `@speclynx/api-languageservice` 2.13.1

### Improvements

- update Scalar API Reference to 1.69.0 and Swagger UI to 5.33.0
- remove obfuscation from extension and standalone language server bundles
- include third-party notices for bundled dependencies and copied preview assets

# 1.5.3 (2026-03-17)

### Bug Fixes

- remove ambiguous build artifacts from distribution

# 1.5.2 (2026-03-16)

### Features

- update SpecLynx ApiDOM to latest version

### Performance Improvements

- improved performance
- lower memory footprint

# 1.5.1 (2026-03-01)

### Bug Fixes

- fix Scalar preview rendering on dereference failure

### Enhancements

- simplify README pointing to website documentation for details

# 1.5.0 (2026-02-08)

### Features

- integrate SpecLynx ApiDOM
- update Scalar & SwaggerUI to latest versions

### Performance Improvements

- reduced bundle size
- improved performance
- lower memory footprint

# 1.4.0 (2025-12-22)

### Features

- add OpenAPI Document format conversion (JSON ↔ YAML)

# 1.3.0 (2025-12-14)

### Features

- add Scalar API Reference as default preview renderer (possible to switch back to SwaggerUI by user setting)

# 1.2.0 (2025-09-28)

### Features

- add support for OpenAPI 3.1.2

# 1.1.0 (2025-09-18)

### Features

- add OpenAPI Document JSON/YAML formatting

### Bug Fixes

- improve OpenAPI file pattern matching specificity

# 1.0.2 (2025-09-15)

### Bug Fixes

- add support for previewing OpenAPI 3.1.x Documents
- always enforce SwaggerUI light theme

# 1.0.1 (2025-09-14)

### Bug Fixes

- fix screenshots in documentation (scaling)

# 1.0.0 (2025-09-7)

### Features

- initial SpecLynx OpenAPI Toolkit public release
