import * as vscode from 'vscode';
import type { Command } from '../commandManager';
import type { Runtime } from '../speclynxClient';

export class PickSpectralRulesFileCommand implements Command {
  public readonly id = 'openapiToolkit.pickSpectralRulesFile';
  public constructor(private readonly _runtime: Runtime) {}

  public async execute() {
    const path = await this._runtime.file.pickRulesFile();

    if (path) {
      await vscode.workspace
        .getConfiguration()
        .update(
          'speclynx.openapi.validation.spectralRulesFile',
          path,
          vscode.ConfigurationTarget.Workspace,
        );
      vscode.window.showInformationMessage(`Spectral Rules file set to ${path}`);
    }
  }
}
