import * as vscode from 'vscode';
import type { Runtime } from '../speclynxClient';
import type { Command } from '../commandManager';

export class PickRulesFileCommand implements Command {
  public readonly id = 'openapiToolkit.pickRulesFile';

  public constructor(private readonly _runtime: Runtime) {}

  public async execute() {
    const path = await this._runtime.file.pickRulesFile();

    if (path) {
      await vscode.workspace
        .getConfiguration()
        .update(
          'speclynx.openapi.validation.semanticRulesFile',
          path,
          vscode.ConfigurationTarget.Workspace,
        );
      vscode.window.showInformationMessage(`Semantic Rules file set to ${path}`);
    }
  }
}
