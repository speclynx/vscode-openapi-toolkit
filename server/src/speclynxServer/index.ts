import YAML from 'yaml';
import {
  Connection,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  InitializeParams,
  InitializeResult,
  TextDocuments,
  TextDocumentSyncKind,
  WorkspaceFolder,
  CodeActionKind,
  CompletionItem,
  CompletionParams,
  CodeActionParams,
  CodeAction,
  DocumentLink,
  Hover,
  SymbolInformation,
  RequestType,
  UnregistrationRequest,
  Registration,
  Diagnostic,
  DocumentFormattingParams,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Location, TextEdit } from 'vscode-languageserver-types';
import {
  SemanticTokens,
  SemanticTokensParams,
  DidChangeWatchedFilesRegistrationOptions,
  WatchKind,
  GlobPattern,
} from 'vscode-languageserver-protocol';
import {
  CompletionContext,
  getLanguageService,
  isJsonDoc,
  isYamlDoc,
  LanguageService,
  LanguageServiceContext,
  LogLevel,
  Metadata,
  MetadataMap,
  FormatMeta,
  LinterMeta,
  ValidationContext,
  OpenAPi31JsonSchemaValidationProvider,
  OpenAPi30JsonSchemaValidationProvider,
  OpenAPi20JsonSchemaValidationProvider,
  config as apiDOMConfig,
  isValidLinterMeta,
  ConversionResult,
} from '@speclynx/api-languageservice';
// Used in exported signatures, so these reach the published declarations: see
// the note in ../runtime.ts for why they carry a resolution mode.
import type { ConversionOptions, Format } from '@speclynx/api-languageservice' with {
  'resolution-mode': 'import',
};
import { url as urlUtils } from '@speclynx/apidom-reference';
import { createSpectralLinter } from '../spectral/spectralLinter';
import { rulesWithBoundedPatterns } from './boundedPatterns';
import { plainDiagnostic } from './diagnostics';
import { RefLinksProvider } from './refLinksProvider';
import { configure as configureApiDOM } from './apidom';
import type { ServerRuntime } from '../runtime';

export type { ServerRuntime, MetadataPlugin } from '../runtime';

export interface DerefParams {
  uri: string;
  baseURI?: string;
  format?: 0 | 1; // 0 = JSON, 1 = YAML
}

export type DerefResult = string;

export interface ConversionParams {
  uri: string;
  sourceFormat: Format;
  targetFormat: Format;
  conversionOptions?: ConversionOptions;
}

export interface Linter {
  lint: (textDocument: TextDocument, markStartLineOnly?: boolean) => Promise<Diagnostic[]>;
  loadRuleset: (rulesFile: string, connection: Connection) => Promise<void>;
}

export interface ExtensionConfig {
  validation?: {
    applyJsonSchemaValidation?: boolean;
    betterErrorsForJsonSchema?: boolean;
    applySemanticValidation?: boolean;
    referenceValidation?: boolean;
    semanticLinting?: boolean;
    semanticRulesFile?: string;
    semanticMaxNumberOfProblems?: number;
    applySpectralValidation?: boolean;
    spectralRulesFile?: string;
    markFirstLineOnlyOfSpectralProblem?: boolean;
  };
  logging?: {
    server?: 'off' | 'messages' | 'verbose';
  };
}

const REFRESH_RULES_REG_ID = 'speclynx-rules-file';
/**
 * Registers LSP handlers that are independent of the current runtime
 * (Node process / WebWorker / etc.).
 * The caller is responsible only for creating the `Connection`.
 */
export function startServer(connection: Connection, runtime: ServerRuntime = {}): void {
  const documents = new TextDocuments(TextDocument);
  let linter: Linter;

  let hasConfigurationCapability = false;
  let hasWorkspaceFolderCapability = true;
  let hasDiagnosticRelatedInformationCapability = false; // eslint-disable-line @typescript-eslint/no-unused-vars
  let hasFileWatchingCapability = false;
  let rulesFileWatcherRegistered = false;

  let languageService: LanguageService;
  let folders: WorkspaceFolder[] | null;

  const configDefault: ExtensionConfig = {
    validation: {
      semanticMaxNumberOfProblems: 1000,
      betterErrorsForJsonSchema: true,
      semanticLinting: true,
      referenceValidation: true,
      applyJsonSchemaValidation: true,
      applySemanticValidation: false,
      applySpectralValidation: false,
    },
    logging: {
      server: 'off',
    },
  };
  let config: ExtensionConfig = configDefault;
  /**
   * Configuration supplied once at startup, through `initializationOptions`
   * or through the runtime (CLI `--config` file).  Clients that do not support
   * `workspace/configuration` have no other way to configure the server, so
   * this value must survive every subsequent reload.
   */
  let initializationConfig: ExtensionConfig | undefined;

  const openAPI31JsonSchemaValidationProvider = new OpenAPi31JsonSchemaValidationProvider();
  const openAPI30JsonSchemaValidationProvider = new OpenAPi30JsonSchemaValidationProvider();
  const openAPI20JsonSchemaValidationProvider = new OpenAPi20JsonSchemaValidationProvider();

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  function validateTextDocument(textDocument: TextDocument) {
    const validationContext: ValidationContext = {
      comments: DiagnosticSeverity.Error,
      maxNumberOfProblems: config.validation?.semanticMaxNumberOfProblems ?? 100,
    };

    void (async () => {
      const diagnostics = await languageService.doValidation(textDocument, validationContext);

      if (config?.validation?.applySpectralValidation) {
        diagnostics.push(
          ...(await linter.lint(
            textDocument,
            config.validation?.markFirstLineOnlyOfSpectralProblem,
          )),
        );
      }
      await connection.sendDiagnostics({
        uri: textDocument.uri,
        diagnostics: diagnostics.map(plainDiagnostic),
      });
    })();
  }

  /**
   * Fills in the settings a supplied configuration leaves out.  Every member
   * of `ExtensionConfig` is optional, and a client configuring the server
   * through `initializationOptions` or the CLI `--config` file sends only what
   * it wants to change.  An omitted setting must keep its default rather than
   * become `undefined`, which the readers of `config` take as off: a file
   * asking for Spectral alone would otherwise turn JSON Schema validation off.
   * VS Code is unaffected, since it resolves settings against their declared
   * defaults before sending them.
   */
  function withDefaults(supplied: ExtensionConfig): ExtensionConfig {
    return {
      validation: { ...configDefault.validation, ...supplied.validation },
      logging: { ...configDefault.logging, ...supplied.logging },
    };
  }

  async function getExtensionConfig(): Promise<ExtensionConfig> {
    if (!hasConfigurationCapability) return initializationConfig ?? configDefault;

    const config = (await connection.workspace.getConfiguration(
      'speclynx.openapi',
    )) as ExtensionConfig;
    return config ?? initializationConfig ?? configDefault;
  }

  function makeWatcherForFile(watcherPattern: GlobPattern) {
    return {
      globPattern: watcherPattern,
      kind: WatchKind.Create | WatchKind.Change | WatchKind.Delete,
    } as const;
  }

  function workspaceFolderUris(): string[] {
    return (folders ?? []).map((f) => f.uri);
  }

  async function loadRulesFile(): Promise<string | undefined> {
    const file = config?.validation?.semanticRulesFile;
    if (!file || file === '') {
      if (runtime.findDefaultRulesFile) {
        return runtime.findDefaultRulesFile(workspaceFolderUris());
      }
      return await connection.sendRequest('apidom/getDefaultRulesFile');
    }
    return file;
  }

  async function loadSpectralRulesFile(): Promise<string | undefined> {
    const file = config?.validation?.spectralRulesFile;
    if (!file || file === '') {
      if (runtime.findDefaultSpectralRulesFile) {
        return runtime.findDefaultSpectralRulesFile(workspaceFolderUris());
      }
      return await connection.sendRequest('apidom/getDefaultSpectralRulesFile');
    }
    return file;
  }

  function isValidLinterMetaArray(obj: unknown): obj is LinterMeta[] {
    if (!Array.isArray(obj)) return false;
    for (const item of obj) {
      const isValid = isValidLinterMeta(item);
      if (!isValid) return false;
    }
    return true;
  }

  /**
   * Concatenates the rules, completions and documentation of two `FormatMeta`
   * into a new one.  Neither input is read after the arrays are copied, so the
   * result shares nothing with either of them.
   */
  function mergeFormatMeta(base: FormatMeta | undefined, addition: FormatMeta): FormatMeta {
    const merged: FormatMeta = { ...base };
    if (addition.lint) {
      merged.lint = [...(base?.lint ?? []), ...addition.lint];
    }
    if (addition.completion) {
      merged.completion = [...(base?.completion ?? []), ...addition.completion];
    }
    if (addition.documentation) {
      merged.documentation = [...(base?.documentation ?? []), ...addition.documentation];
    }
    return merged;
  }

  /**
   * `apiDOMConfig()` hands out a fresh top-level object, but the values inside
   * it are module-level singletons shared with every other caller in the
   * process: `symbols`, `tokens` and each `MetadataMap` under `metadataMaps`
   * are the same instances every time.  Merging into them would append the
   * plugin's contributions to API Language Service's own metadata rather than to this
   * server's copy of it, once per reload — and `reload` runs twice during
   * startup and again on every configuration change and every watched-file
   * event, so a single plugin rule would report a document as violating it a
   * growing number of times.  Everything reachable from the base metadata and
   * from the plugin is therefore treated as read-only: only `base` itself is
   * written to, and always with a copy.
   */
  function mergePluginMetadata(base: Metadata): void {
    const plugins = runtime.metadataPlugins;
    if (!plugins || plugins.length === 0) return;

    base.metadataMaps = { ...base.metadataMaps };
    base.linterFunctions = { ...base.linterFunctions };

    for (const plugin of plugins) {
      const pluginMeta = plugin.config();

      // Merge metadataMaps (namespace -> element -> FormatMeta)
      for (const [ns, map] of Object.entries(pluginMeta.metadataMaps)) {
        const mergedMap: MetadataMap = { ...base.metadataMaps[ns] };
        for (const [element, formatMeta] of Object.entries(map)) {
          mergedMap[element] = mergeFormatMeta(mergedMap[element], formatMeta);
        }
        base.metadataMaps[ns] = mergedMap;
      }

      // Merge linterFunctions (namespace -> functionName -> function)
      for (const [ns, fns] of Object.entries(pluginMeta.linterFunctions)) {
        base.linterFunctions[ns] = { ...base.linterFunctions[ns], ...fns };
      }

      // Merge rules
      if (pluginMeta.rules) {
        const mergedRules: Record<string, FormatMeta> = { ...base.rules };
        for (const [key, formatMeta] of Object.entries(pluginMeta.rules)) {
          mergedRules[key] = mergeFormatMeta(mergedRules[key], formatMeta);
        }
        base.rules = mergedRules;
      }

      // Merge symbols and tokens
      base.symbols = [...base.symbols, ...pluginMeta.symbols];
      base.tokens = [...base.tokens, ...pluginMeta.tokens];
    }
  }

  function buildMetadata(customRules?: string): { metadata: Metadata; semantic: boolean } {
    const customConfig = apiDOMConfig();

    // Apply metadata plugins first
    mergePluginMetadata(customConfig);

    if (!customRules || customRules.trim() === '') {
      return { metadata: customConfig, semantic: false };
    }
    let parsedRules: unknown;
    try {
      parsedRules = JSON.parse(customRules);
    } catch (jsonError) {
      try {
        parsedRules = YAML.parse(customRules);
      } catch (yamlError) {
        console.error(`Failed to parse rules:
        JSON parse error: ${String(jsonError)}
        YAML parse error: ${String(yamlError)}`);
        return { metadata: customConfig, semantic: false };
      }
    }
    if (!isValidLinterMetaArray(parsedRules)) {
      console.error(
        `Invalid rules format. Expected an array of LinterMeta objects, but received: ${JSON.stringify(parsedRules)}`,
      );
      return { metadata: customConfig, semantic: false };
    }
    // The file comes from the workspace, so its rules are input rather than
    // code: one carrying a pattern that can backtrack without bound would stop
    // the server answering anything at all.
    const rules = rulesWithBoundedPatterns(parsedRules);
    (customConfig.rules ??= {}).openapi ??= {};
    (customConfig.rules.openapi ??= {}).lint ??= [];
    customConfig.rules.openapi.lint.push(...rules);
    return { metadata: customConfig, semantic: true };
  }

  function isWatchableFile(rulesFile?: string): rulesFile is string {
    return (
      typeof rulesFile === 'string' && rulesFile.trim() !== '' && !urlUtils.isHttpUrl(rulesFile)
    );
  }

  async function buildWatcherPattern(rulesFile: string): Promise<GlobPattern> {
    if (runtime.buildWatcherPattern) {
      return runtime.buildWatcherPattern(rulesFile);
    }
    return connection.sendRequest('apidom/buildUriForWatcher', rulesFile);
  }

  async function registerRulesFileWatcher(newRulesFile?: string, newSpectralRulesFile?: string) {
    if (rulesFileWatcherRegistered) {
      await connection.sendRequest(UnregistrationRequest.type, {
        unregisterations: [{ id: REFRESH_RULES_REG_ID, method: 'workspace/didChangeWatchedFiles' }],
      });
      rulesFileWatcherRegistered = false;
    }

    const watchers = [];
    for (const rulesFile of [newRulesFile, newSpectralRulesFile]) {
      if (isWatchableFile(rulesFile)) {
        watchers.push(makeWatcherForFile(await buildWatcherPattern(rulesFile.trim())));
      }
    }
    if (watchers.length === 0) {
      return;
    }

    const options: DidChangeWatchedFilesRegistrationOptions = {
      watchers,
    };

    const registration: Registration = {
      id: REFRESH_RULES_REG_ID,
      method: 'workspace/didChangeWatchedFiles',
      registerOptions: options,
    };
    await connection.sendRequest('client/registerCapability', {
      registrations: [registration],
    });
    rulesFileWatcherRegistered = true;
  }

  /**
   * Watching the rules files is an optional convenience.  A client that does
   * not support dynamic file-watcher registration, or that rejects the
   * request, must not prevent the rules themselves from being loaded.
   */
  async function refreshRulesFileWatcher(newRulesFile?: string, newSpectralRulesFile?: string) {
    if (!hasFileWatchingCapability) return;

    try {
      await registerRulesFileWatcher(newRulesFile, newSpectralRulesFile);
    } catch (error: unknown) {
      console.warn(
        `Unable to watch the rules files for changes, they will only be reloaded on request: ${String(error)}`,
      );
    }
  }

  function buildLanguageServiceContext(metadata: Metadata): LanguageServiceContext {
    return {
      metadata,
      logLevel: LogLevel.WARN,
      performanceLogs: false,
      defaultContentLanguage: {
        mediaType: 'application/vnd.oai.openapi+yaml',
        namespace: 'openapi',
        version: '3.1.0',
      },
      validatorProviders: config.validation?.applyJsonSchemaValidation
        ? [
            openAPI31JsonSchemaValidationProvider,
            openAPI30JsonSchemaValidationProvider,
            openAPI20JsonSchemaValidationProvider,
          ]
        : [],
      validationContext: {
        comments: DiagnosticSeverity.Error,
        maxNumberOfProblems: config.validation?.semanticMaxNumberOfProblems,
        jsonSchemaValidation: config.validation?.applyJsonSchemaValidation ?? false,
        semanticValidation: config.validation?.applySemanticValidation ?? true,
        semanticLinting: config.validation?.semanticLinting ?? true,
        referenceValidation: config.validation?.referenceValidation ?? true,
        betterAjvErrors: config.validation?.betterErrorsForJsonSchema ?? false,
      },
      workspaceFolders: folders ?? undefined,
      linksProviders: [new RefLinksProvider()],
    };
  }

  async function reload(checkRulesFile: boolean, customConfig?: ExtensionConfig): Promise<void> {
    config = customConfig ?? (await getExtensionConfig());
    let rulesFile: string | undefined;
    let spectralRulesFile: string | undefined;

    let rulesFileContent = '';

    if (checkRulesFile) {
      rulesFile = await loadRulesFile();
      spectralRulesFile = await loadSpectralRulesFile();
      if (rulesFile && rulesFile.trim() !== '') {
        rulesFileContent = runtime.readFile
          ? await runtime.readFile(rulesFile)
          : await connection.sendRequest('apidom/readFile', rulesFile);
      }
      await refreshRulesFileWatcher(rulesFile, spectralRulesFile);
    }

    const metadataResult = buildMetadata(rulesFileContent);
    if (config.validation?.applySpectralValidation) {
      linter = createSpectralLinter(documents, connection, runtime);
      if (spectralRulesFile && spectralRulesFile.trim() !== '' && checkRulesFile) {
        try {
          await linter.loadRuleset(spectralRulesFile, connection);
        } catch (error: unknown) {
          // A ruleset comes from the workspace and can be anything: unparseable,
          // extending something that is not there, naming a function that
          // cannot be resolved. Letting that escape aborts the reload, so the
          // three validation layers that have nothing to do with Spectral
          // silently stop reporting too.
          console.error(
            `Unable to load the Spectral ruleset ${spectralRulesFile}, continuing without it: ${String(error)}`,
          );
        }
      }
    }
    const context = buildLanguageServiceContext(metadataResult.metadata);
    if (languageService) {
      languageService.terminate();
    }
    languageService = getLanguageService(context);
    documents.all().forEach(validateTextDocument);
  }

  /* ------------------------------------------------------------------ */
  /*  LSP – event handlers                                               */
  /* ------------------------------------------------------------------ */

  connection.onDidChangeConfiguration((change) => {
    const settings = change.settings as { speclynx: { openapi: ExtensionConfig | undefined } };
    void (async () => {
      const changedConfig = hasConfigurationCapability
        ? await getExtensionConfig()
        : withDefaults(settings.speclynx?.openapi ?? initializationConfig ?? configDefault);
      await reload(true, changedConfig);
    })();
  });

  connection.onInitialize(async (params: InitializeParams) => {
    // documents = new TextDocuments(TextDocument);
    const { capabilities } = params;
    hasConfigurationCapability = !!capabilities.workspace?.configuration;
    hasWorkspaceFolderCapability = !!capabilities.workspace?.workspaceFolders;
    hasDiagnosticRelatedInformationCapability =
      !!capabilities.textDocument?.publishDiagnostics?.relatedInformation;
    hasFileWatchingCapability =
      !!capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration;

    folders = params.workspaceFolders ?? null;

    if (
      params.initializationOptions &&
      typeof params.initializationOptions === 'object' &&
      'extensionConfig' in params.initializationOptions
    ) {
      initializationConfig = withDefaults(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        params.initializationOptions.extensionConfig as ExtensionConfig,
      );
    } else if (runtime.defaultConfig) {
      initializationConfig = withDefaults(runtime.defaultConfig);
    }
    // Resolved without querying the client: `workspace/configuration` must not
    // be sent before the initialize handshake completes.
    config = initializationConfig ?? configDefault;
    await reload(false, config);

    const result: InitializeResult = {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
        completionProvider: { resolveProvider: false },
        hoverProvider: true,
        definitionProvider: true,
        referencesProvider: true,
        documentSymbolProvider: true,
        documentLinkProvider: { resolveProvider: false, workDoneProgress: true },
        semanticTokensProvider: {
          legend: languageService.getSemanticTokensLegend(),
          // `full` is what `connection.languages.semanticTokens.on` answers. A
          // capability with neither `full` nor `range` advertises support for
          // neither request, so a client never asks and highlighting is dead.
          full: { delta: false },
          range: false,
        },
        codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix] },
        documentFormattingProvider: true,
      },
    };

    if (hasWorkspaceFolderCapability) {
      result.capabilities.workspace = {
        workspaceFolders: { supported: true, changeNotifications: true },
      };
    }

    return result;
  });

  /**
   * Dynamic registrations are optional refinements of the capabilities already
   * advertised in the initialize result, so a client that does not support them
   * must not stop the server from loading its rules.
   *
   * Semantic tokens are deliberately not registered here. The initialize result
   * already advertises them, and every client scopes that to the documents it
   * attached the server to, which is what a dynamic registration would have had
   * to restate. Restating it cost us twice: once with a VS Code specific document
   * selector that strict clients could not parse, and once by being the only
   * place `full` was declared.
   */
  async function registerDynamicCapabilities(): Promise<void> {
    try {
      if (hasConfigurationCapability) {
        await connection.client.register(DidChangeConfigurationNotification.type);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        connection.workspace.onDidChangeWorkspaceFolders((_event) => {
          // TODO Reload the language service when workspace folders change
        });
      }
    } catch (error: unknown) {
      console.warn(`Unable to register dynamic capabilities: ${String(error)}`);
    }
  }

  connection.onInitialized(() => {
    void (async () => {
      await registerDynamicCapabilities();
      await reload(true);
    })();
  });

  /* ---------------- text document events ---------------------------- */

  documents.onDidChangeContent((change) => {
    validateTextDocument(change.document);
  });

  /* ---------------- language-service requests ----------------------- */

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connection.onDidChangeWatchedFiles((_change) => {
    void reload(true);
  });

  connection.onCompletion(async (params: CompletionParams): Promise<CompletionItem[]> => {
    const ctx: CompletionContext = { maxNumberOfItems: 100 };
    const document = documents.get(params.textDocument.uri)!;
    const list = await languageService.doCompletion(document, params, ctx);
    return list ? list.items : [];
  });

  connection.onCompletionResolve((item: CompletionItem): CompletionItem => item);

  connection.onHover(async ({ textDocument, position }): Promise<Hover | undefined> => {
    const document = documents.get(textDocument.uri);

    if (document === undefined) return undefined;

    return languageService.doHover(document, position);
  });

  connection.onDefinition(async (params): Promise<Location | null> => {
    const document = documents.get(params.textDocument.uri);

    if (document === undefined) return null;

    return languageService.doProvideDefinition(document, params);
  });

  connection.onReferences(async (params): Promise<Location[] | null> => {
    const document = documents.get(params.textDocument.uri);

    if (document === undefined) return null;

    return languageService.doProvideReferences(document, params);
  });

  connection.onDocumentSymbol(async (params): Promise<SymbolInformation[]> => {
    const document = documents.get(params.textDocument.uri);

    if (document === undefined) return [];

    return languageService.doFindDocumentSymbols(document);
  });

  connection.onDocumentLinks(async (params): Promise<DocumentLink[] | null> => {
    const document = documents.get(params.textDocument.uri);

    if (document === undefined) return null;

    return languageService.doLinks(document, {
      maxNumberOfLinks: 100,
      enableTrivialLinkDiscovery: true,
    });
  });

  connection.onCodeAction(async (params: CodeActionParams): Promise<CodeAction[]> => {
    if (params.context.diagnostics.length === 0) return [];

    const document = documents.get(params.textDocument.uri);

    if (!document) return [];

    const actions = await languageService.doCodeActions(document, params);
    return actions.map(({ diagnostics, ...action }) => ({
      ...action,
      ...(diagnostics ? { diagnostics: diagnostics.map(plainDiagnostic) } : {}),
    }));
  });

  connection.languages.semanticTokens.on(
    async (params: SemanticTokensParams): Promise<SemanticTokens> => {
      const document = documents.get(params.textDocument.uri);

      if (document === undefined) return { data: [] };

      return languageService.computeSemanticTokens(document);
    },
  );

  connection.onDocumentFormatting(async (params: DocumentFormattingParams): Promise<TextEdit[]> => {
    const document = documents.get(params.textDocument.uri);

    if (!document) return [];
    return languageService.doFormatting(document, params.options);
  });

  connection.onRequest(
    new RequestType<DerefParams, DerefResult, void>('apidom/deref'),
    async (params): Promise<DerefResult> => {
      const { uri, baseURI } = params;
      let { format } = params;
      const document = documents.get(uri);

      if (!document) {
        throw new Error(`Document ${uri} not found`);
      }

      if (format === undefined) {
        const isJson = await isJsonDoc(document);
        const isYaml = await isYamlDoc(document);

        format = isJson ? 0 : isYaml ? 1 : undefined;
      }

      return languageService.doDeref(document, { baseURI, format });
    },
  );

  connection.onRequest(
    new RequestType<ConversionParams, ConversionResult, void>('apidom/convert'),
    async (params): Promise<ConversionResult> => {
      const { uri, sourceFormat, targetFormat, conversionOptions } = params;
      const document = documents.get(uri);

      if (!document) {
        throw new Error(`Document ${uri} not found`);
      }
      return languageService.doConversion(document, sourceFormat, targetFormat, conversionOptions);
    },
  );

  connection.onRequest(
    new RequestType<void, void, void>('apidom/reload'),
    async (): Promise<void> => {
      await reload(true);
    },
  );

  /** configures ApiDOM internal **/
  configureApiDOM(connection, runtime);

  /** -- server kick-off -- */
  documents.listen(connection);
  connection.listen();
}
