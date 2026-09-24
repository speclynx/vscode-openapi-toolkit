import * as vscode from 'vscode';
import debounce from 'lodash.debounce';
import {
  hasRecognizedExtension as hasRecognizedOpenAPIExtension,
  isCanonicalFilename as isCanonicalOpenAPIFilename,
  isOpenAPI,
  isOpenAPIJSON,
  isOpenAPIYAML,
  fileExtensions as openAPIFileExtensions,
} from './OpenAPI';

/**
 * Context key names for conditional menu visibility.
 */
const CONTEXT_KEY_IS_APIDOM_JSON = 'openapiToolkit.isApiDOMJSON';
const CONTEXT_KEY_IS_APIDOM_YAML = 'openapiToolkit.isApiDOMYAML';

/**
 * Registers listeners that automatically switch a document's language to
 * `apidom` whenever it matches the OpenAPI detection RegExp.
 */
export function register(context: vscode.ExtensionContext): void {
  const debouncedEnsureApiDOMLanguage = debounce(ensureApiDOMLanguage, 300);
  const debouncedUpdateContextKeys = debounce(updateContextKeys, 300);

  // Initialize context keys to false to ensure they're set before any async detection
  void vscode.commands.executeCommand('setContext', CONTEXT_KEY_IS_APIDOM_JSON, false);
  void vscode.commands.executeCommand('setContext', CONTEXT_KEY_IS_APIDOM_YAML, false);

  // Set language for already open documents
  vscode.workspace.textDocuments.forEach((doc) => {
    void ensureApiDOMLanguage(doc);
  });

  // Update context keys for the current active editor
  if (vscode.window.activeTextEditor) {
    void updateContextKeys(vscode.window.activeTextEditor.document);
  }

  // Watch for future document opens
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      void ensureApiDOMLanguage(doc);
    }),
  );
  // Watch for changes in text documents
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(({ document }) => {
      void debouncedEnsureApiDOMLanguage(document);
      // Only update context keys if the changed document is the active editor
      if (vscode.window.activeTextEditor?.document === document) {
        void debouncedUpdateContextKeys(document);
      }
    }),
  );
  // Watch for document saves (especially untitled -> file transitions)
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      void ensureApiDOMLanguage(doc);
      // Update context keys if the saved document is the active editor
      if (vscode.window.activeTextEditor?.document === doc) {
        void updateContextKeys(doc);
      }
    }),
  );
  // Watch for active editor changes to update context keys
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      // Cancel any pending debounced updates to avoid race conditions
      debouncedUpdateContextKeys.cancel();

      if (editor) {
        void updateContextKeys(editor.document);
      } else {
        // Clear context keys when no editor is active
        void vscode.commands.executeCommand('setContext', CONTEXT_KEY_IS_APIDOM_JSON, false);
        void vscode.commands.executeCommand('setContext', CONTEXT_KEY_IS_APIDOM_YAML, false);
      }
    }),
  );

  async function ensureApiDOMLanguage(doc: vscode.TextDocument) {
    if (
      isCanonicalApiDOMFilename(doc) ||
      ((await isApiDOM(doc)) && hasRecognizedApiDOMExtension(doc))
    ) {
      await vscode.languages.setTextDocumentLanguage(doc, 'apidom');
    }
  }

  async function updateContextKeys(doc: vscode.TextDocument) {
    // Skip if document is closed
    if (doc.isClosed) {
      await vscode.commands.executeCommand('setContext', CONTEXT_KEY_IS_APIDOM_JSON, false);
      await vscode.commands.executeCommand('setContext', CONTEXT_KEY_IS_APIDOM_YAML, false);
      return;
    }

    try {
      const isJSON = await isApiDOMJSON(doc);
      const isYAML = isJSON ? false : await isApiDOMYAML(doc); // JSON is valid YAML, so only check YAML if not JSON to make them mutually exclusive

      await vscode.commands.executeCommand('setContext', CONTEXT_KEY_IS_APIDOM_JSON, isJSON);
      await vscode.commands.executeCommand('setContext', CONTEXT_KEY_IS_APIDOM_YAML, isYAML);
    } catch {
      // If detection fails, reset context keys to false
      await vscode.commands.executeCommand('setContext', CONTEXT_KEY_IS_APIDOM_JSON, false);
      await vscode.commands.executeCommand('setContext', CONTEXT_KEY_IS_APIDOM_YAML, false);
    }
  }
}

export const apiDOMFileExtensions = [...openAPIFileExtensions];

export function isCanonicalApiDOMFilename(doc: vscode.TextDocument): boolean {
  return isCanonicalOpenAPIFilename(doc);
}

export async function isApiDOM(doc: vscode.TextDocument): Promise<boolean> {
  return isOpenAPI(doc);
}

export function hasRecognizedApiDOMExtension(docs: vscode.TextDocument): boolean {
  return hasRecognizedOpenAPIExtension(docs);
}

export async function isApiDOMJSON(doc: vscode.TextDocument): Promise<boolean> {
  return isOpenAPIJSON(doc);
}

export async function isApiDOMYAML(doc: vscode.TextDocument): Promise<boolean> {
  return isOpenAPIYAML(doc);
}
