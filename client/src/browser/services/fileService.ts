import * as vscode from 'vscode';
import { Utils as UriUtils } from 'vscode-uri';
import type { RelativePattern } from 'vscode-languageclient';
import { getFileService as getFileServiceISO } from '../../services/fileService';
import type { FileService } from '../../speclynxClient';

async function pickRulesFile(): Promise<string | undefined> {
  const root = vscode.workspace.workspaceFolders?.[0];

  if (!root) {
    void vscode.window.showWarningMessage('Open a folder first.');
    return undefined;
  }

  const files = await vscode.workspace.findFiles('**/*.{yaml,yml,json}');
  const picked = await vscode.window.showQuickPick(
    files.map((u) => ({ label: vscode.workspace.asRelativePath(u, false), uri: u })),
    { placeHolder: 'Select rules file' },
  );

  if (picked?.uri) {
    return picked.uri.toString(true);
  }

  return undefined;
}

function buildURIForWatcher(path: string): RelativePattern {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const fileUri = vscode.Uri.parse(path);
  if (fileUri.scheme === '' || fileUri.scheme === 'file' || !folder) {
    return {
      baseUri: String(UriUtils.dirname(fileUri)),
      pattern: UriUtils.basename(fileUri),
    };
  } else {
    let pattern =
      UriUtils.dirname(fileUri).path.replace(/^[/\\]/, '') + '/' + UriUtils.basename(fileUri);
    if (pattern.startsWith('/')) {
      pattern = pattern.substring(1);
    }
    return {
      baseUri: String(folder.uri),
      pattern,
    };
  }
}

export function getFileService(): FileService {
  return {
    ...getFileServiceISO(),
    pickRulesFile,
    buildURIForWatcher,
  };
}
