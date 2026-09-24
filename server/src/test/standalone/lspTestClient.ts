import * as child_process from 'node:child_process';
import { pathToFileURL } from 'node:url';
import type {
  ClientCapabilities,
  Diagnostic,
  InitializeResult,
  Registration,
} from 'vscode-languageserver-protocol';

interface JsonRpcMessage {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

/**
 * Requests any LSP client is expected to answer.  Everything else the server
 * sends is a custom extension that a standalone client cannot be assumed to
 * implement, and is rejected with `MethodNotFound`.
 */
const STANDARD_SERVER_REQUESTS = new Set([
  'client/registerCapability',
  'client/unregisterCapability',
  'workspace/configuration',
  'window/workDoneProgress/create',
]);

export interface LspTestClientOptions {
  /** Path of the server entry point to spawn. */
  serverPath: string;
  /** Directory opened as the single workspace folder. */
  workspaceDir: string;
  /** Extra command line arguments passed to the server. */
  serverArgs?: string[];
  /** Capabilities advertised to the server, merged over the minimal defaults. */
  clientCapabilities?: ClientCapabilities;
}

/**
 * A minimal LSP client speaking stdio, used to drive the standalone server the
 * way a non VS Code editor would.  Custom `apidom/*` requests are deliberately
 * rejected so that any remaining dependency on the VS Code client surfaces as
 * a test failure rather than as silently missing diagnostics.
 */
export class LspTestClient {
  private readonly serverProcess: child_process.ChildProcessWithoutNullStreams;
  private readonly pendingRequests = new Map<number, PendingRequest>();
  private readonly notifications: JsonRpcMessage[] = [];
  private readonly processFailureListeners = new Set<(error: Error) => void>();
  private buffer = Buffer.alloc(0);
  private nextRequestId = 1;
  private stderrTail = '';
  private processFailure: Error | undefined;

  /** Custom server-to-client requests that were rejected as unsupported. */
  public readonly rejectedRequests: string[] = [];
  /** Dynamic capability registrations the server asked for. */
  public readonly registrations: Registration[] = [];

  constructor(private readonly options: LspTestClientOptions) {
    this.serverProcess = child_process.spawn(
      process.execPath,
      [options.serverPath, ...(options.serverArgs ?? [])],
      { cwd: options.workspaceDir, stdio: 'pipe' },
    );
    this.serverProcess.stdout.on('data', (chunk: Buffer) => this.consume(chunk));
    this.serverProcess.stderr.on('data', (chunk: Buffer) => {
      // Webpack bundles are single-line files, so a stack trace can contain
      // megabytes of source. Retain just enough of the tail to diagnose exits.
      this.stderrTail = `${this.stderrTail}${chunk.toString('utf-8')}`.slice(-16_384);
    });
    this.serverProcess.on('error', (error) => this.failProcess(error));
    this.serverProcess.on('close', (code, signal) => {
      const status = signal === null ? `code ${code}` : `signal ${signal}`;
      const stderr = this.stderrTail.trim();
      const protocolOutput = JSON.stringify(this.notifications.slice(-5));
      const details = [stderr, protocolOutput === '[]' ? '' : protocolOutput]
        .filter((detail) => detail !== '')
        .join('\n');
      this.failProcess(
        new Error(`Language server exited with ${status}${details === '' ? '' : `:\n${details}`}`),
      );
    });
  }

  public get workspaceUri(): string {
    return pathToFileURL(this.options.workspaceDir).toString();
  }

  public documentUri(fileName: string): string {
    return `${this.workspaceUri}/${fileName}`;
  }

  private consume(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    for (;;) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;

      const header = this.buffer.subarray(0, headerEnd).toString('utf-8');
      const contentLength = /Content-Length: (\d+)/i.exec(header);
      if (contentLength === null) return;

      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + Number(contentLength[1]);
      if (this.buffer.length < bodyEnd) return;

      const body = this.buffer.subarray(bodyStart, bodyEnd).toString('utf-8');
      this.buffer = this.buffer.subarray(bodyEnd);
      this.dispatch(JSON.parse(body) as JsonRpcMessage);
    }
  }

  private dispatch(message: JsonRpcMessage): void {
    if (message.method === undefined && message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending === undefined) return;
      this.pendingRequests.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method === undefined) return;
    this.notifications.push(message);

    if (message.method === 'client/registerCapability') {
      const params = message.params as { registrations: Registration[] };
      this.registrations.push(...params.registrations);
    }

    if (message.id === undefined) return;

    if (STANDARD_SERVER_REQUESTS.has(message.method)) {
      this.send({ jsonrpc: '2.0', id: message.id, result: null });
    } else {
      this.rejectedRequests.push(message.method);
      this.send({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32601, message: `Unsupported request ${message.method}` },
      });
    }
  }

  private send(message: Record<string, unknown>): void {
    const payload = Buffer.from(JSON.stringify(message), 'utf-8');
    this.serverProcess.stdin.write(`Content-Length: ${payload.length}\r\n\r\n`);
    this.serverProcess.stdin.write(payload);
  }

  private failProcess(error: Error): void {
    if (this.processFailure !== undefined) return;
    this.processFailure = error;

    for (const pending of this.pendingRequests.values()) pending.reject(error);
    this.pendingRequests.clear();
    for (const listener of this.processFailureListeners) listener(error);
    this.processFailureListeners.clear();
  }

  public request<T>(method: string, params: unknown): Promise<T> {
    const id = this.nextRequestId;
    this.nextRequestId += 1;

    return new Promise<T>((resolve, reject) => {
      if (this.processFailure !== undefined) {
        reject(this.processFailure);
        return;
      }
      this.pendingRequests.set(id, { resolve: resolve as (result: unknown) => void, reject });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  public notify(method: string, params: unknown): void {
    this.send({ jsonrpc: '2.0', method, params });
  }

  public async initialize(initializationOptions?: unknown): Promise<InitializeResult> {
    const capabilities: ClientCapabilities = {
      textDocument: { publishDiagnostics: {} },
      workspace: { workspaceFolders: true },
      ...this.options.clientCapabilities,
    };

    const result = await this.request<InitializeResult>('initialize', {
      processId: process.pid,
      rootUri: this.workspaceUri,
      capabilities,
      workspaceFolders: [{ uri: this.workspaceUri, name: 'standalone-test' }],
      initializationOptions,
    });

    this.notify('initialized', {});
    return result;
  }

  public openDocument(fileName: string, text: string, languageId = 'yaml'): string {
    const uri = this.documentUri(fileName);
    this.notify('textDocument/didOpen', {
      textDocument: { uri, languageId, version: 1, text },
    });
    return uri;
  }

  /**
   * Resolves with the diagnostics published for `uri`.  Diagnostics are
   * republished on every reload, so an optional predicate selects the
   * publication the assertion is actually interested in.
   */
  public waitForDiagnostics(
    uri: string,
    predicate: (diagnostics: Diagnostic[]) => boolean = () => true,
    timeoutMs = 30000,
  ): Promise<Diagnostic[]> {
    return new Promise<Diagnostic[]>((resolve, reject) => {
      if (this.processFailure !== undefined) {
        reject(this.processFailure);
        return;
      }

      const deadline = Date.now() + timeoutMs;
      const fail = (error: Error): void => {
        clearInterval(poll);
        reject(error);
      };

      const poll = setInterval(() => {
        for (const notification of this.notifications) {
          if (notification.method !== 'textDocument/publishDiagnostics') continue;
          const params = notification.params as { uri: string; diagnostics: Diagnostic[] };
          if (params.uri === uri && predicate(params.diagnostics)) {
            clearInterval(poll);
            this.processFailureListeners.delete(fail);
            resolve(params.diagnostics);
            return;
          }
        }
        if (Date.now() > deadline) {
          clearInterval(poll);
          this.processFailureListeners.delete(fail);
          reject(new Error(`Timed out waiting for diagnostics on ${uri}`));
        }
      }, 50);
      this.processFailureListeners.add(fail);
    });
  }

  public stop(): void {
    this.serverProcess.kill();
  }
}
