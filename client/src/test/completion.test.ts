import * as vscode from 'vscode';
import * as assert from 'assert';

import { getDocUri, activate } from './helper';

suite('Should do completion', () => {
  // const docUri = getDocUri('oasbasic.json');
  const docUri = getDocUri('oasbasic.yaml');

  test('Completes JS/TS in txt file', async () => {
    /*
    await testCompletion(docUri, new vscode.Position(0, 1), {
      items: [{ label: 'openapi', kind: vscode.CompletionItemKind.Text }],
    });
*/
    await testCompletion(docUri, new vscode.Position(1, 0), {
      items: [{ label: 'components', kind: vscode.CompletionItemKind.Text }],
    });
  });
});

async function testCompletion(
  docUri: vscode.Uri,
  position: vscode.Position,
  expectedCompletionList: vscode.CompletionList,
) {
  await activate(docUri);

  // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
  const actualCompletionList: vscode.CompletionList = await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    docUri,
    position,
  );
  assert.ok(actualCompletionList.items.length >= 1);
  const actualItem = actualCompletionList.items[0];
  assert.equal(actualItem.label, expectedCompletionList.items[0].label);
}
