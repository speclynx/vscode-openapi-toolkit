import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ServerRuntime, MetadataPlugin } from '../runtime';

const RULES_FILE_NAMES = [
  'speclynx.json',
  'speclynx.yaml',
  'speclynx.yml',
  '.speclynx.json',
  '.speclynx.yaml',
  '.speclynx.yml',
];

const SPECTRAL_RULES_FILE_NAMES = ['.spectral.json', '.spectral.yaml', '.spectral.yml'];

export interface NodeServerRuntimeOptions {
  metadataPlugins?: MetadataPlugin[];
  defaultConfig?: Record<string, unknown>;
}

function toFilePath(uri: string): string {
  if (uri.startsWith('file://')) {
    return fileURLToPath(uri);
  }
  return uri;
}

async function findFileInFolders(
  folders: string[],
  candidates: string[],
): Promise<string | undefined> {
  for (const folder of folders) {
    const folderPath = toFilePath(folder);
    for (const name of candidates) {
      const candidate = path.join(folderPath, name);
      try {
        await fs.access(candidate);
        return pathToFileURL(candidate).toString();
      } catch {
        // not found, try next
      }
    }
  }
  return undefined;
}

async function readFileByUri(uri: string): Promise<string> {
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${uri}`);
    }
    return response.text();
  }
  const filePath = toFilePath(uri);
  return fs.readFile(filePath, 'utf-8');
}

export class NodeServerRuntime implements ServerRuntime {
  public readonly metadataPlugins?: MetadataPlugin[];
  public readonly defaultConfig?: Record<string, unknown>;

  constructor(options?: NodeServerRuntimeOptions) {
    this.metadataPlugins = options?.metadataPlugins;
    this.defaultConfig = options?.defaultConfig;
  }

  async readFile(uri: string): Promise<string> {
    return readFileByUri(uri);
  }

  async findDefaultRulesFile(workspaceFolders: string[]): Promise<string | undefined> {
    return findFileInFolders(workspaceFolders, RULES_FILE_NAMES);
  }

  async findDefaultSpectralRulesFile(workspaceFolders: string[]): Promise<string | undefined> {
    return findFileInFolders(workspaceFolders, SPECTRAL_RULES_FILE_NAMES);
  }

  /**
   * Standard LSP allows a plain string glob pattern, so the absolute path of
   * the rules file is watched directly without any VS Code specific type.
   * Glob patterns separate their segments with `/` on every platform, and a
   * backslash escapes the character after it rather than separating, so a
   * native Windows path has to be rewritten before it can match anything.
   */
  buildWatcherPattern(rulesFile: string): Promise<string> {
    return Promise.resolve(toFilePath(rulesFile).split(path.sep).join('/'));
  }
}
