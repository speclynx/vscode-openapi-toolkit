import { URI } from 'vscode-uri';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type URIjs from 'urijs';
import {
  Spectral,
  Document as SpectralDocument,
  Ruleset,
  ISpectralDiagnostic,
} from '@stoplight/spectral-core';
import * as Parsers from '@stoplight/spectral-parsers';
import { createResolveHttp } from '@stoplight/json-ref-readers';
import { DiagnosticSeverity as SpectralDiagnosticSeverity } from '@stoplight/types';
import { Resolver, Cache } from '@stoplight/json-ref-resolver';
import { bundleAndLoadRuleset } from '@stoplight/spectral-ruleset-bundler/with-loader';
import { builtins } from '@stoplight/spectral-ruleset-bundler/plugins/builtins';
import { url } from '@stoplight/spectral-ruleset-bundler/plugins/url';
import { fetch } from '@stoplight/spectral-runtime';
import { Connection, Diagnostic, DiagnosticSeverity, TextDocuments } from 'vscode-languageserver';

import { Linter } from '../speclynxServer';
import { ICache } from '@stoplight/json-ref-resolver/types';
import type { ServerRuntime } from '../runtime';

function convertSeverity(severity: SpectralDiagnosticSeverity): DiagnosticSeverity {
  switch (severity) {
    case SpectralDiagnosticSeverity.Error:
      return DiagnosticSeverity.Error;
    case SpectralDiagnosticSeverity.Warning:
      return DiagnosticSeverity.Warning;
    case SpectralDiagnosticSeverity.Information:
      return DiagnosticSeverity.Information;
    case SpectralDiagnosticSeverity.Hint:
      return DiagnosticSeverity.Hint;
    default:
      return DiagnosticSeverity.Error;
  }
}

function makeDiagnostic(problem: ISpectralDiagnostic, markStartLineOnly?: boolean): Diagnostic {
  return {
    range: {
      start: {
        line: problem.range.start.line,
        character: problem.range.start.character,
      },
      end: markStartLineOnly
        ? {
            line: problem.range.start.line,
            character: problem.range.start.character,
          }
        : {
            line: problem.range.end.line,
            character: problem.range.end.character,
          },
    },
    severity: convertSeverity(problem.severity),
    code: problem.code,
    source: 'spectral',
    message: problem.documentationUrl
      ? `${problem.message} (${problem.documentationUrl})`
      : problem.message,
  };
}

export function getIO(connection: Connection, runtime?: ServerRuntime): object {
  return {
    fs: {
      promises: {
        readFile: async (filePath: string): Promise<string> => {
          if (filePath && filePath.trim() !== '') {
            return runtime?.readFile
              ? runtime.readFile(filePath)
              : connection.sendRequest('apidom/readFile', filePath);
          }
          return '';
        },
      },
    },
    // The bundler reads `ok`, `statusText` and `text()` off what this returns,
    // so it has to be the response rather than the body: returning the text made
    // every ruleset reached over HTTP fail as though the fetch itself had. This
    // is Spectral's own isomorphic fetch, which is what it uses elsewhere.
    fetch,
  };
}

/** The packages `builtins` supplies from this process rather than from disk. */
const SPECTRAL_BUILTIN_MODULES = [
  '@stoplight/spectral-core',
  '@stoplight/spectral-formats',
  '@stoplight/spectral-functions',
  '@stoplight/spectral-parsers',
  '@stoplight/spectral-ref-resolver',
  '@stoplight/spectral-rulesets',
  '@stoplight/spectral-runtime',
];

/**
 * The loader puts its own URL plugin ahead of anything passed to it, and that
 * plugin resolves every bare import of a ruleset fetched over HTTP against the
 * ruleset's own address — including the Spectral packages `builtins` answers
 * for, which are then fetched from a server that has never heard of them. The
 * bundler deduplicates plugins by name, keeping the first one's position and the
 * last one's implementation, so a plugin under the URL plugin's own name takes
 * its place: builtin identifiers fall through to `builtins`, and everything else
 * is resolved exactly as before.
 */
const urlDeferringToBuiltins = (io: Parameters<typeof url>[0]): ReturnType<typeof url> => {
  const resolveAgainstUrl = url(io);
  const { resolveId } = resolveAgainstUrl;
  const resolveAgainstUrlId = typeof resolveId === 'function' ? resolveId : resolveId?.handler;

  return {
    ...resolveAgainstUrl,
    resolveId(id, importer, options) {
      if (SPECTRAL_BUILTIN_MODULES.includes(id)) {
        return null;
      }
      return resolveAgainstUrlId?.call(this, id, importer, options) ?? null;
    },
  };
};

const buildFileResolver = (
  documents: TextDocuments<TextDocument>,
  connection: Connection,
  runtime?: ServerRuntime,
) => {
  return async (ref: URIjs): Promise<unknown> => {
    const lookedUpUri = URI.file(ref.toString());

    const lookedUpUriStr = lookedUpUri.toString();

    for (const key of documents.keys()) {
      if (key === lookedUpUriStr) {
        const doc = documents.get(lookedUpUriStr);

        if (doc === undefined) {
          throw new Error(`Unexpected undefined doc '${lookedUpUriStr}'`);
        }

        return doc.getText();
      }
    }

    try {
      return runtime?.readFile
        ? await runtime.readFile(lookedUpUriStr)
        : await connection.sendRequest('apidom/readFile', lookedUpUriStr);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes('nonexistent')) {
          throw new Error(`Unable to resolve nonexistent file ${lookedUpUriStr}`, { cause: error });
        }
        throw new Error(`Unable to read file ${lookedUpUriStr}`, { cause: error });
      }
      throw error;
    }
  };
};

export function createHttpAndFileResolver(
  documents: TextDocuments<TextDocument>,
  uriCache: ICache,
  connection: Connection,
  runtime?: ServerRuntime,
): Resolver {
  const resolveHttp = createResolveHttp();

  return new Resolver({
    resolvers: {
      https: { resolve: resolveHttp },
      http: { resolve: resolveHttp },
      file: { resolve: buildFileResolver(documents, connection, runtime) },
    },
    uriCache,
  });
}

const buildSpectralInstance = (
  documents: TextDocuments<TextDocument>,
  uriCache: ICache,
  connection: Connection,
  runtime?: ServerRuntime,
): Spectral => {
  return new Spectral({
    resolver: createHttpAndFileResolver(documents, uriCache, connection, runtime),
  });
};

/**
 * Wrapper for the Spectral linter that runs linting against VS Code document
 * content in a manner similar to the Spectral CLI.
 */
export class SpectralLinter implements Linter {
  private readonly spectral: Spectral;
  private readonly cache: ICache;
  private readonly runtime?: ServerRuntime;
  private linterRuleset: Ruleset | undefined;

  constructor(
    documents: TextDocuments<TextDocument>,
    connection: Connection,
    runtime?: ServerRuntime,
  ) {
    this.cache = new Cache();
    this.runtime = runtime;
    this.spectral = buildSpectralInstance(documents, this.cache, connection, runtime);
  }

  /**
   * Executes Spectral linting against a VS Code document.
   * @param {TextDocument} document - The document to lint/validate.
   * @param markStartLineOnly - If true, only the start line of the diagnostic will be marked.
   * @return {Promise<Diagnostic[]>} The set of rule violations found. If no violations are found, this will be empty.
   */
  public async lint(document: TextDocument, markStartLineOnly?: boolean): Promise<Diagnostic[]> {
    // Unclear if we may have issues changing the ruleset on the shared Spectral
    // instance here. If so, we may need to store a Spectral instance per
    // document rather than using a single shared one via Linter.
    if (this.linterRuleset) {
      this.spectral.setRuleset(this.linterRuleset);
    } else {
      // No ruleset, so clear everything out.
      this.spectral.setRuleset({
        rules: {},
      });
    }

    // It's unclear why JSON and YAML both get parsed as YAML, but that's how Spectral does it, sooooooo...
    const text = document.getText();

    // There's a bug in how `json-ref-resolver` handles file:// URLs - it fails
    // to decode any URL-encoded items because it treats a file://path/to/file
    // and /fs/path/to/file style URL as the same thing. To bypass the issue, we
    // pre-convert the file URL into a local FS path.
    //
    // For in-memory documents, this URI will be `untitled:Untitled-1` or
    // something similar. The `fsPath` will be `Untitled-1`, and that seems as
    // reasonable as anything else for in-memory validation. This only really
    // matters when parsing the relative links in references anyway.
    const file = URI.parse(document.uri).fsPath;
    const doc = new SpectralDocument(text, Parsers.Yaml, file);

    this.cache.purge();
    const result = await this.spectral.run(doc, { ignoreUnknownFormat: true });
    if (!result) {
      return [];
    }
    return result.map((problem) => makeDiagnostic(problem, markStartLineOnly));
  }

  async loadRuleset(filepath: string, connection: Connection): Promise<void> {
    // @ts-expect-error not to import `IO` in browser
    const io: Parameters<typeof url>[0] = getIO(connection, this.runtime);

    // `builtins` supplies Spectral's own packages — core, functions, formats and
    // the rest — from this process rather than from disk, which is what a
    // ruleset extending `spectral:oas` needs when the server is a bundle with no
    // node_modules of its own. Everything else a ruleset imports is left to the
    // loader, so a package the workspace installed resolves from the workspace.
    this.linterRuleset = await bundleAndLoadRuleset(filepath, io, [
      builtins(),
      urlDeferringToBuiltins(io),
    ]);
  }
}

export function createSpectralLinter(
  documents: TextDocuments<TextDocument>,
  connection: Connection,
  runtime?: ServerRuntime,
): Linter {
  return new SpectralLinter(documents, connection, runtime);
}
