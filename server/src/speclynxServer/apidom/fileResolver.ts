import { Resolver, ResolverError, url } from '@speclynx/apidom-reference';
import type { ResolverOptions, File } from '@speclynx/apidom-reference';
import type { Connection } from 'vscode-languageserver';
import type { ServerRuntime } from '../../runtime';

interface FileResolverOptions extends Omit<ResolverOptions, 'name'> {
  readonly connection: Connection;
  readonly runtime?: ServerRuntime;
}

export class FileResolver extends Resolver {
  public readonly connection: Connection;
  private readonly runtime?: ServerRuntime;
  public readonly textEncoder: TextEncoder;

  constructor(options: FileResolverOptions) {
    super({ name: 'VSCodeServerFileResolver' });
    this.connection = options.connection;
    this.runtime = options.runtime;
    this.textEncoder = new TextEncoder();
  }

  canRead(file: File): boolean {
    // VS Code file providers also serve virtual workspace schemes. HTTP stays
    // with the HTTP resolver; client-side providers retain their own URI.
    return url.isFileSystemPath(file.uri) || !url.isHttpUrl(file.uri);
  }

  async read(file: File) {
    const fileSystemPath = url.isFileSystemPath(file.uri)
      ? `file://${url.toFileSystemPath(file.uri, { keepFileProtocol: false })}`
      : file.uri;

    try {
      const content: string = this.runtime?.readFile
        ? await this.runtime.readFile(fileSystemPath)
        : await this.connection.sendRequest('apidom/readFile', fileSystemPath);
      return this.textEncoder.encode(content) as Buffer;
    } catch (error: unknown) {
      throw new ResolverError(`Error opening file "${file.uri}"`, { cause: error });
    }
  }
}
