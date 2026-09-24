# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenAPI Toolkit is a VS Code extension for editing, validating, linting, and previewing OpenAPI specification documents. It uses [ApiDOM](https://github.com/speclynx/apidom) for parsing and analysis, and implements the Language Server Protocol (LSP) for rich editor features.

## Build Commands

```bash
# Always switch to the correct Node.js version before installing
nvm use

# Install dependencies
npm ci

# Development build (compiles TypeScript, copies assets)
npm run build:dev

# Development build with watch mode
npm run build:dev:watch

# Production build (bundles with webpack for both Node and browser)
npm run build:prod

# Type checking only
npm run typescript:check-types

# Lint all workspaces
npm run lint

# Lint and fix
npm run lint:fix

# Run all tests (server unit tests + e2e tests)
npm run test

# Run only server tests
npm --workspace=server run test

# Package extension as VSIX
npm run vscode:package
```

## Architecture

This is a monorepo with two npm workspaces:

### Client (`client/`)
VS Code extension and LSP client. Has separate entry points for:
- **Node**: `client/src/node/speclynxClientMain.ts` - desktop VS Code
- **Browser**: `client/src/browser/speclynxClientMain.ts` - web-based VS Code (vscode.dev)

Key modules:
- `speclynxClient.ts` - Language client initialization and configuration
- `commandManager.ts` - VS Code command registration
- `commands/` - Command implementations (preview, dereference, pick rules files)
- `preview/` - SwaggerUI preview webview panel
- `languageFeatures/languageDetection/` - OpenAPI document detection

### Server (`server/`)
LSP server providing language features. Has separate entry points for:
- **Node**: `server/src/node/speclynxServerMain.ts`
- **Browser**: `server/src/browser/speclynxServerMain.ts`

Key modules:
- `speclynxServer/index.ts` - Main server with validation, completion, hover
- `speclynxServer/apidom/` - ApiDOM integration and file resolution
- `spectral/spectralLinter.ts` - Spectral ruleset integration

### Dependencies
- `@speclynx/apidom-*` packages - Core parsing and reference handling (published on npm)
- `@stoplight/spectral-*` - Spectral linting integration
- `vscode-languageserver` / `vscode-languageclient` - LSP implementation

## Testing

- **Server unit tests**: `server/src/test/` - Run with `npm --workspace=server run test`
- **E2E tests**: `client/src/test/` - Run via `scripts/e2e.sh`, tests the full extension in VS Code

## Development Workflow

1. Run `npm run build:dev` after any TypeScript changes
2. Use "Launch Node Client" or "Launch Browser Client" from VS Code's Run and Debug
3. Use "Attach to Server" launch config to debug the language server

## Extension Configuration

Settings are prefixed with `speclynx.openapi.validation.*`:
- JSON Schema validation
- Semantic validation with custom rules file
- Spectral linting with custom ruleset file
