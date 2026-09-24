import type { BaseLanguageClient } from 'vscode-languageclient';
import { CommandManager } from '../commandManager';
import { DereferenceCommand } from './dereference';
import { PickRulesFileCommand } from './pickRulesFile';
import { PickSpectralRulesFileCommand } from './pickSpectralRulesFile';
import { ReloadCommand } from './reload';
import { ConvertJsonToYamlCommand } from './convertJsonToYaml';
import { ConvertYamlToJsonCommand } from './convertYamlToJson';
import { Runtime } from '../speclynxClient';

export function registerOpenAPIToolkitCommands(
  commandManager: CommandManager,
  client: BaseLanguageClient,
  runtime: Runtime,
) {
  commandManager.register(new DereferenceCommand(client));
  commandManager.register(new PickRulesFileCommand(runtime));
  commandManager.register(new PickSpectralRulesFileCommand(runtime));
  commandManager.register(new ReloadCommand(client));
  commandManager.register(new ConvertJsonToYamlCommand(client));
  commandManager.register(new ConvertYamlToJsonCommand(client));

  return commandManager;
}
