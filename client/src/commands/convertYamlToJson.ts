import * as vscode from 'vscode';
import type { Command } from '../commandManager';
import { isApiDOMYAML } from '../languageFeatures/languageDetection';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { ConversionResult, Format } from '@speclynx/api-languageservice';
import { createFormattingOptions } from '../common/config/formattingOptionsFromConfiguration';
import { buildSuggestedSaveUri } from './convertJsonToYaml';

export class ConvertYamlToJsonCommand implements Command {
  public readonly id = 'openapiToolkit.convertYamlToJson';

  public constructor(private readonly _client: BaseLanguageClient) {}

  public async execute(uri: vscode.Uri) {
    const sourceDocumentURI = uri ?? vscode.window.activeTextEditor?.document?.uri ?? null;
    if (!sourceDocumentURI) {
      vscode.window.showErrorMessage('No document selected.');
      return;
    }

    const sourceDocument = await vscode.workspace.openTextDocument(sourceDocumentURI);

    if (!(await isApiDOMYAML(sourceDocument))) {
      vscode.window.showErrorMessage('Selected document is not a YAML file.');
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Converting YAML to JSON…',
      },
      async () => {
        try {
          const conversionResult: ConversionResult = await this._client.sendRequest(
            'apidom/convert',
            {
              uri: String(sourceDocumentURI),
              sourceFormat: Format.YAML,
              targetFormat: Format.JSON,
              conversionOptions: {
                enhancedFormatting: true,
                formattingOptions: createFormattingOptions(sourceDocument, 'yaml'),
              },
            },
          );

          if (conversionResult.success) {
            const defaultUri = buildSuggestedSaveUri(sourceDocumentURI, 'json');
            const saveUri = await vscode.window.showSaveDialog({
              defaultUri,
              filters: { 'JSON files': ['json'], 'All files': ['*'] },
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
            vscode.window.showErrorMessage(`Error converting YAML to JSON: ${e.message}`);
          } else {
            vscode.window.showErrorMessage(`Error converting YAML to JSON: ${String(e)}`);
          }
        }
      },
    );
  }
}
