import * as vscode from 'vscode';
import type { FileService } from '../speclynxClient';

function normalizePath(path: string): string {
  const p = path.replace(/\\/g, '/');
  const segments = p.split('/');
  const out: string[] = [];
  for (const s of segments) {
    if (s === '' || s === '.') continue;
    if (s === '..') {
      out.pop();
      continue;
    }
    out.push(s);
  }
  let result = out.join('/');
  if (p.startsWith('/')) result = '/' + result;
  return result || '.';
}

function sanitizeRelativePath(p: string): string {
  const n = normalizePath(p);
  return n.replace(/^(?:\/?\.\.(\/|$))+/, ''); // strip leading “…/”
}

/**
 * Resolves a URI string, handling both absolute and relative paths
 * @param uri The URI string to resolve
 * @returns A properly resolved Uri object
 */
function resolveUri(uri: string): vscode.Uri {
  // Handle absolute URIs (http, https, file protocols)
  if (/^[a-z][a-z0-9+\-.]*:/i.test(uri)) {
    return vscode.Uri.parse(uri);
  }
  // Handle relative paths
  const sanitized = sanitizeRelativePath(uri);

  // If the workspace has folders, resolve against the first workspace folder
  if (
    !sanitized.startsWith('/') &&
    !sanitized.startsWith('\\') &&
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    const rootUri = vscode.workspace.workspaceFolders[0].uri;
    return vscode.Uri.joinPath(rootUri, sanitized);
  }

  // Fallback to parsing as-is if no workspace folders
  return vscode.Uri.parse(sanitized);
}

export function getFileService(): FileService {
  return {
    async getContent(uri) {
      return vscode.workspace.fs.readFile(resolveUri(uri));
    },
    async pickRulesFile() {
      return Promise.reject(Error('pickRulesFile method is not implemented'));
    },
    buildURIForWatcher() {
      throw new Error('buildURIForWatcher method is not implemented');
    },
  };
}
