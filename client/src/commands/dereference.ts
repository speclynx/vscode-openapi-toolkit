import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { Utils as UriUtils } from 'vscode-uri';
import type { Command } from '../commandManager';
import {
  isApiDOMJSON,
  isApiDOMYAML,
  apiDOMFileExtensions,
} from '../languageFeatures/languageDetection';

export class DereferenceCommand implements Command {
  public readonly id = 'openapiToolkit.dereferenceDocument';

  public constructor(private readonly _client: BaseLanguageClient) {}

  public async execute(uri: vscode.Uri) {
    const sourceDocumentURI = uri ?? vscode.window.activeTextEditor?.document?.uri ?? null;

    if (!sourceDocumentURI) {
      vscode.window.showErrorMessage('No OpenAPI document selected.');
      return;
    }

    const targetDocumentURI = await vscode.window.showSaveDialog({
      defaultUri: buildDefaultTargetUri(sourceDocumentURI),
      filters: { 'OpenAPI documents': apiDOMFileExtensions },
    });
    if (!targetDocumentURI) return;

    const sourceDocument = vscode.window.activeTextEditor?.document;
    if (!sourceDocument) {
      vscode.window.showErrorMessage('No OpenAPI document selected.');
      return;
    }

    const format = (await isApiDOMJSON(sourceDocument))
      ? 0
      : (await isApiDOMYAML(sourceDocument))
        ? 1
        : undefined;

    let operationSucceeded = false;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Dereferencing document…',
      },
      async () => {
        try {
          const derefText: string = await this._client.sendRequest('apidom/deref', {
            uri: String(sourceDocumentURI),
            baseURI: String(sourceDocumentURI),
            format,
          });

          const bytes = new TextEncoder().encode(derefText);
          await vscode.workspace.fs.writeFile(targetDocumentURI, bytes);
          operationSucceeded = true;
        } catch (e: unknown) {
          if (e instanceof Error) {
            vscode.window.showErrorMessage(
              `Error dereferencing document: ${e.message}\n\nThis is likely due to some issue in the document references.`,
            );
          } else {
            vscode.window.showErrorMessage(
              'Error dereferencing document: \n\nThis is likely due to some issue in the document references.',
            );
          }
        }
      },
    );
    if (operationSucceeded) {
      vscode.window.showInformationMessage(
        `Dereferenced document saved to ${targetDocumentURI.fsPath}`,
      );
    }
  }
}

function buildDefaultTargetUri(src: vscode.Uri): vscode.Uri {
  const filename = UriUtils.basename(src); // e.g. "openapi.yaml"
  const dirname = UriUtils.dirname(src); // e.g. URI for "/folder/"
  const ext = UriUtils.extname(src); // e.g. ".yaml"

  const base = filename.slice(0, -ext.length); // Remove extension from end
  const newFilename = `${base}-dereferenced${ext}`;

  const newPathUri = UriUtils.joinPath(dirname, newFilename);

  return newPathUri.with({
    scheme: src.scheme,
    authority: src.authority,
    query: src.query,
    fragment: src.fragment,
  });
}
