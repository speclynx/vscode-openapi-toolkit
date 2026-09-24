import * as vscode from 'vscode';
import { LanguageClientOptions, BaseLanguageClient } from 'vscode-languageclient';
import type { RelativePattern } from 'vscode-languageclient';
import { SemanticTokensFeature } from 'vscode-languageclient/lib/common/semanticTokens';
import { url } from '@speclynx/apidom-reference/configuration/empty';
import * as preview from './preview';
import * as languageDetection from './languageFeatures/languageDetection';
import { CommandManager } from './commandManager';
import { registerOpenAPIToolkitCommands } from './commands/index';

export type LanguageClientConstructor = (
  name: string,
  description: string,
  clientOptions: LanguageClientOptions,
) => BaseLanguageClient;

export interface FileService {
  getContent(uri: string): Promise<Uint8Array | null>;
  pickRulesFile(): Promise<string | undefined>;
  buildURIForWatcher(path: string): RelativePattern;
}

export interface HTTPService {
  getContent(url: string): Promise<Uint8Array | null>;
}

export interface Runtime {
  file: FileService;
  http: HTTPService;
}

export async function startClient(
  context: vscode.ExtensionContext,
  newLanguageClient: LanguageClientConstructor,
  runtime: Runtime,
): Promise<BaseLanguageClient> {
  const commandManager = new CommandManager();

  const extensionConfig: unknown = JSON.parse(
    JSON.stringify(vscode.workspace.getConfiguration('speclynx.openapi')),
  );

  const clientOptions: LanguageClientOptions = {
    // Register the server for apidom docs
    documentSelector: ['apidom'],
    initializationOptions: {
      extensionConfig,
    },
  };

  // Create the language client and start the client.
  const client = newLanguageClient('apidom', 'SpecLynx Language Server', clientOptions);
  client.registerProposedFeatures();
  client.registerFeature(new SemanticTokensFeature(client));
  languageDetection.register(context);
  context.subscriptions.push(registerOpenAPIToolkitCommands(commandManager, client, runtime));

  client.onRequest('apidom/getDefaultRulesFile', async (): Promise<string | undefined> => {
    if (!vscode.workspace.workspaceFolders) {
      return;
    }
    for (const folder of vscode.workspace.workspaceFolders) {
      const folderUri = folder.uri;
      const pattern = new vscode.RelativePattern(
        folderUri,
        '{**/speclynx.json,**/speclynx.yaml,**/speclynx.yml,**/.speclynx.json,**/.speclynx.yaml,**/.speclynx.yml}',
      );
      const uris = await vscode.workspace.findFiles(pattern);
      if (uris && uris.length > 0) {
        return String(uris[0]);
      }
    }
  });

  client.onRequest('apidom/getDefaultSpectralRulesFile', async (): Promise<string | undefined> => {
    if (!vscode.workspace.workspaceFolders) {
      return;
    }
    for (const folder of vscode.workspace.workspaceFolders) {
      const folderUri = folder.uri;
      const pattern = new vscode.RelativePattern(
        folderUri,
        '{**/.spectral.json,**/.spectral.yaml,**/.spectral.yml}',
      );
      const uris = await vscode.workspace.findFiles(pattern);
      if (uris && uris.length > 0) {
        return String(uris[0]);
      }
    }
  });

  client.onRequest('apidom/readFile', async (uri: string) => {
    const bytes = url.isHttpUrl(uri)
      ? await runtime.http.getContent(uri)
      : await runtime.file.getContent(uri);
    return new TextDecoder('utf-8').decode(bytes ?? new Uint8Array());
  });

  client.onRequest('apidom/buildUriForWatcher', (path: string): RelativePattern => {
    return runtime.file.buildURIForWatcher(path);
  });

  preview.activate(context);

  await client.start();
  return client;
}
