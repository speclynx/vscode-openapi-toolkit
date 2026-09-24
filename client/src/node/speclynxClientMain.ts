import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  BaseLanguageClient,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import { getFileService } from './services/fileService';
import { getHTTPService } from './services/httpService';
import { startClient, LanguageClientConstructor, Runtime } from '../speclynxClient';

let client: BaseLanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const clientPackageJSON = await getPackageInfo(context);

  // The server is started using the module path relative to the extension root
  const serverMain = path.join(
    'server',
    clientPackageJSON.main.includes('/dist/') ? 'dist' : 'out',
    'node',
    'speclynxServerMain',
  );
  const serverModule = context.asAbsolutePath(serverMain);

  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  const newLanguageClient: LanguageClientConstructor = (
    id: string,
    name: string,
    clientOptions: LanguageClientOptions,
  ) => {
    return new LanguageClient(id, name, serverOptions, clientOptions);
  };

  const runtime: Runtime = {
    file: getFileService(),
    http: getHTTPService(),
  };

  client = await startClient(context, newLanguageClient, runtime);
}

export async function deactivate() {
  if (client) {
    await client.dispose();
    client = undefined;
  }
}

/**
 * Helpers.
 */

interface IPackageInfo {
  name: string;
  version: string;
  aiKey: string;
  main: string;
}

async function getPackageInfo(context: vscode.ExtensionContext): Promise<IPackageInfo> {
  const location = context.asAbsolutePath('./package.json');
  try {
    const packg = await fs.readFile(location);
    return JSON.parse(packg.toString()) as IPackageInfo;
  } catch (error) {
    console.log(`Problems reading ${location}: ${String(error)}`);
    return { name: '', version: '', aiKey: '', main: '' };
  }
}
