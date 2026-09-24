import * as fs from 'node:fs';
import * as path from 'node:path';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { startServer } from '../speclynxServer';
import { NodeServerRuntime } from './runtime';

function parseArgs(): { configFile?: string } {
  const args = process.argv.slice(2);
  let configFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && i + 1 < args.length) {
      configFile = args[i + 1];
      i++;
    }
  }

  return { configFile };
}

function loadConfigFile(filePath: string): Record<string, unknown> {
  const resolved = path.resolve(filePath);
  const content = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(content) as Record<string, unknown>;
}

function findDefaultConfig(): Record<string, unknown> | undefined {
  const candidates = ['.speclynx-server.json'];
  for (const name of candidates) {
    const filePath = path.resolve(name);
    if (fs.existsSync(filePath)) {
      return loadConfigFile(filePath);
    }
  }
  return undefined;
}

/**
 * Starts the server on stdio, which is what editors and agents outside VS Code
 * speak. Transports are selected explicitly rather than left to the argument
 * parsing built into `vscode-languageserver`, so an unrecognised argument
 * cannot silently leave the server without one and hang the client.
 */
export function runCli(): void {
  const { configFile } = parseArgs();
  const connection = createConnection(ProposedFeatures.all, process.stdin, process.stdout);

  // stdout is the protocol stream, so anything written to it directly corrupts
  // the connection. Rebound before anything can log.
  console.log = connection.console.log.bind(connection.console);
  console.info = connection.console.info.bind(connection.console);
  console.warn = connection.console.warn.bind(connection.console);
  console.error = connection.console.error.bind(connection.console);

  process.on('unhandledRejection', (error: unknown) => {
    let message: string;

    if (error instanceof Error) {
      message = `Unhandled exception: ${error.message}\n${error.stack}`;
    } else if (typeof error === 'string') {
      message = `Unhandled exception: ${error}`;
    } else {
      message = `Unhandled exception: ${String(error)}`;
    }

    connection.console.error(message);
  });

  const fileConfig = configFile ? loadConfigFile(configFile) : findDefaultConfig();

  startServer(connection, new NodeServerRuntime({ defaultConfig: fileConfig }));
}

export { startServer } from '../speclynxServer';
export type { ServerRuntime, MetadataPlugin, ExtensionConfig } from '../speclynxServer';
export { NodeServerRuntime } from './runtime';
