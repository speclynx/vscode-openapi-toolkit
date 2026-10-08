# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 1.6.0 (2026-10-08)

### Features

- ship the language server as a package of its own, `@speclynx/api-language-server`
- ship a Claude Code plugin, so Claude validates and lints the OpenAPI documents it edits

### Bug Fixes

- load Spectral rulesets given as an HTTP URL
- keep validating when a Spectral ruleset fails to load
- ignore workspace rules whose pattern cannot be evaluated in bounded time
- describe the rules file names the extension actually looks for
- generate server declarations before CI lint and type checks

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
