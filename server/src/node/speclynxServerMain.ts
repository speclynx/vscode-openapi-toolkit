import { Connection, ProposedFeatures } from 'vscode-languageserver';
import { createConnection } from 'vscode-languageserver/node';
import { startServer } from '../speclynxServer';

// Create a connection for the server, using Node's IPC as transport.
// Also include all preview / proposed LSP features.
const connection: Connection = process.argv.includes('--stdio')
  ? createConnection(ProposedFeatures.all)
  : createConnection();

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

startServer(connection);
