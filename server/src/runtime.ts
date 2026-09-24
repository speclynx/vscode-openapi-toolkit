// API Language Service publishes its declarations as ESM. This package's own declarations
// are CommonJS, and a consumer resolving under node16 cannot import the former
// from the latter without being told which resolution to use.
import type { Metadata } from '@speclynx/api-languageservice' with { 'resolution-mode': 'import' };
import type { GlobPattern } from 'vscode-languageserver-protocol';

/**
 * A plugin that provides additional metadata (rules and linter functions)
 * to the language service.
 */
export interface MetadataPlugin {
  config(): Metadata;
}

/**
 * Runtime abstraction that decouples the LSP server from VS Code.
 *
 * When a method is provided, the server calls it directly instead of
 * sending a custom LSP request to the client.  When omitted the server
 * falls back to the corresponding `apidom/*` client request, preserving
 * full backward-compatibility with the VS Code extension client.
 */
export interface ServerRuntime {
  /**
   * Read a file by URI and return its text content.
   * Replaces the `apidom/readFile` client request.
   */
  readFile?(uri: string): Promise<string>;

  /**
   * Find the default semantic-rules file in the workspace.
   * Replaces the `apidom/getDefaultRulesFile` client request.
   */
  findDefaultRulesFile?(workspaceFolders: string[]): Promise<string | undefined>;

  /**
   * Find the default Spectral ruleset file in the workspace.
   * Replaces the `apidom/getDefaultSpectralRulesFile` client request.
   */
  findDefaultSpectralRulesFile?(workspaceFolders: string[]): Promise<string | undefined>;

  /**
   * Build the glob pattern used to watch a rules file for changes.
   * Replaces the `apidom/buildUriForWatcher` client request, which returns a
   * VS Code `RelativePattern` and is therefore unavailable to other clients.
   */
  buildWatcherPattern?(rulesFile: string): Promise<GlobPattern>;

  /** Metadata plugins injected at startup. */
  metadataPlugins?: MetadataPlugin[];

  /**
   * Default configuration to use when the client does not provide one
   * via initializationOptions.  Loaded from a config file in CLI mode.
   */
  defaultConfig?: Record<string, unknown>;
}
