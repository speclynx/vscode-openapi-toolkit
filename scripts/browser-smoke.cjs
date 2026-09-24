// Runs inside VS Code's browser extension host against the production bundles.
const vscode = require('vscode');
function check(value, message) {
  if (!value) throw new Error(message);
}
exports.run = async function () {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
  check(folder, 'The browser fixture workspace is required');
  const uri = vscode.Uri.joinPath(folder, 'oasfeatures.yaml');
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
  const extension = vscode.extensions.getExtension('SpecLynx.vscode-openapi-toolkit');
  check(extension, 'The packaged extension must be installed');
  await extension.activate();
  const deadline = Date.now() + 60000;
  while (!vscode.languages.getDiagnostics(uri).length && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 250));
  check(doc.languageId === 'apidom', 'Browser language detection failed');
  check(
    vscode.languages.getDiagnostics(uri).some((d) => d.message.includes('version')),
    'Browser diagnostics failed',
  );
  const command = (name, ...args) => vscode.commands.executeCommand(name, uri, ...args);
  const completion = await command(
    'vscode.executeCompletionItemProvider',
    new vscode.Position(3, 0),
  );
  check(completion?.items.length, 'Browser completion failed');
  check(
    (await command('vscode.executeHoverProvider', new vscode.Position(0, 1)))?.length,
    'Browser hover failed',
  );
  const definitions = await command(
    'vscode.executeDefinitionProvider',
    new vscode.Position(24, 35),
  );
  check(
    definitions?.some((d) => d.uri.path.endsWith('schemas/pet.yaml')),
    'Browser cross-file reference resolution failed',
  );
  check((await command('vscode.executeDocumentSymbolProvider'))?.length, 'Browser symbols failed');
  check(
    (await command('vscode.provideDocumentSemanticTokens'))?.data.length,
    'Browser semantic tokens failed',
  );
  check(
    Array.isArray(
      await command('vscode.executeFormatDocumentProvider', { tabSize: 2, insertSpaces: true }),
    ),
    'Browser formatting failed',
  );
  console.log(
    'Browser production bundle smoke: detection, diagnostics, completion, hover, cross-file reference, symbols, tokens and formatting passed.',
  );
};
