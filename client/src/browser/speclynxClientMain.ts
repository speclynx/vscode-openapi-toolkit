import * as vscode from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient';
import { LanguageClient, BaseLanguageClient } from 'vscode-languageclient/browser';
import { getFileService } from './services/fileService';
import { getHTTPService } from './services/httpService';
import { startClient, LanguageClientConstructor, Runtime } from '../speclynxClient';

let client: BaseLanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const serverMain = vscode.Uri.joinPath(
    context.extensionUri,
    'server',
    'dist',
    'browser',
    'speclynxServerMain.js',
  );

  try {
    const worker = new Worker(serverMain.toString(true), { type: 'classic' });

    const newLanguageClient: LanguageClientConstructor = (
      id: string,
      name: string,
      clientOptions: LanguageClientOptions,
    ) => {
      return new LanguageClient(id, name, clientOptions, worker);
    };

    const runtime: Runtime = {
      file: getFileService(),
      http: getHTTPService(),
    };

    client = await startClient(context, newLanguageClient, runtime);
  } catch (error: unknown) {
    console.log(error);
  }
}

export async function deactivate(): Promise<void> {
  if (client) {
    await client.dispose();
    client = undefined;
  }
}
