import * as vscode from 'vscode';
import { Utils as UriUtils } from 'vscode-uri';
import type { Command } from '../commandManager';
import { isApiDOMJSON } from '../languageFeatures/languageDetection';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { ConversionResult, Format } from '@speclynx/api-languageservice';
import { createFormattingOptions } from '../common/config/formattingOptionsFromConfiguration';

export class ConvertJsonToYamlCommand implements Command {
  public readonly id = 'openapiToolkit.convertJsonToYaml';

  public constructor(private readonly _client: BaseLanguageClient) {}

  public async execute(uri: vscode.Uri) {
    const sourceDocumentURI = uri ?? vscode.window.activeTextEditor?.document?.uri ?? null;
    if (!sourceDocumentURI) {
      vscode.window.showErrorMessage('No document selected.');
      return;
    }

    const sourceDocument = await vscode.workspace.openTextDocument(sourceDocumentURI);

    if (!(await isApiDOMJSON(sourceDocument))) {
      vscode.window.showErrorMessage('Selected document is not a JSON file.');
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Converting JSON to YAML…',
      },
      async () => {
        try {
          const conversionResult: ConversionResult = await this._client.sendRequest(
            'apidom/convert',
            {
              uri: String(sourceDocumentURI),
              sourceFormat: Format.JSON,
              targetFormat: Format.YAML,
              conversionOptions: {
                enhancedFormatting: true,
                formattingOptions: createFormattingOptions(sourceDocument, 'json'),
              },
            },
          );

          if (conversionResult.success) {
            const defaultUri = buildSuggestedSaveUri(sourceDocumentURI, 'yaml');
            const saveUri = await vscode.window.showSaveDialog({
              defaultUri,
              filters: { 'YAML files': ['yaml', 'yml'], 'All files': ['*'] },
            });

            if (saveUri) {
              await vscode.workspace.fs.writeFile(
                saveUri,
                new TextEncoder().encode(conversionResult.result),
              );
              const savedDocument = await vscode.workspace.openTextDocument(saveUri);
              await vscode.window.showTextDocument(savedDocument);
            }
          } else {
            vscode.window.showErrorMessage(conversionResult.error!);
          }
        } catch (e: unknown) {
          if (e instanceof Error) {
            vscode.window.showErrorMessage(`Error converting JSON to YAML: ${e.message}`);
          } else {
            vscode.window.showErrorMessage(`Error converting JSON to YAML: ${String(e)}`);
          }
        }
      },
    );
  }
}

export function buildSuggestedSaveUri(
  sourceUri: vscode.Uri,
  targetExtension: 'yaml' | 'json',
): vscode.Uri {
  const basename = UriUtils.basename(sourceUri);
  const dirname = UriUtils.dirname(sourceUri);
  const extname = UriUtils.extname(sourceUri);

  const filename = extname ? basename.slice(0, -extname.length) : basename;
  const newFilename = `${filename}.${targetExtension}`;

  return UriUtils.joinPath(dirname, newFilename).with({
    scheme: sourceUri.scheme,
    authority: sourceUri.authority,
    query: sourceUri.query,
    fragment: sourceUri.fragment,
  });
}
