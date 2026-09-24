import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import type { Command } from '../commandManager';

export class ReloadCommand implements Command {
  public readonly id = 'openapiToolkit.reloadRules';

  public constructor(private readonly _client: BaseLanguageClient) {}

  public async execute() {
    await this._client.sendRequest('apidom/reload', {});
    vscode.window.showInformationMessage(`Reloaded rules.`);
  }
}
