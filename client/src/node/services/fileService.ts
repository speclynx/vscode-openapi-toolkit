import * as vscode from 'vscode';
import { Utils as UriUtils } from 'vscode-uri';
import type { RelativePattern } from 'vscode-languageclient';
import { getFileService as getFileServiceISO } from '../../services/fileService';
import type { FileService } from '../../speclynxClient';

async function pickRulesFile(): Promise<string | undefined> {
  const [uri] =
    (await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      openLabel: 'Use this file',
      defaultUri: vscode.workspace.workspaceFolders?.[0].uri,
      filters: { Config: ['json', 'yaml', 'yml'] },
    })) ?? [];
  return uri?.toString(true);
}

function buildURIForWatcher(path: string): RelativePattern {
  const fileUri = vscode.Uri.parse(path);

  return {
    baseUri: String(UriUtils.dirname(fileUri)),
    pattern: UriUtils.basename(fileUri),
  };
}

export function getFileService(): FileService {
  return {
    ...getFileServiceISO(),
    pickRulesFile,
    buildURIForWatcher,
  };
}
