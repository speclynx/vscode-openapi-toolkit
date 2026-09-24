import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';

const EXTENSION_ID = 'SpecLynx.vscode-openapi-toolkit';

/**
 * `openapi.yaml` is claimed by the `apidom` language the extension contributes,
 * so it opens as `apidom` without `onLanguage:json` or `onLanguage:yaml` ever
 * firing. This checks that the extension still starts for such a file and
 * validates it.
 *
 * It runs in an extension host of its own, launched separately by `runTest`,
 * because the assertion below only means anything while nothing has activated
 * the extension yet: every other suite calls `helper.activate` first, and an
 * already running extension publishes these diagnostics whether or not the
 * filename triggered anything.
 */
suite('Contributed filename', () => {
  test('openapi.yaml opens as apidom and gets diagnostics', async () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, `expected ${EXTENSION_ID} to be installed in the test host`);
    assert.strictEqual(
      extension.isActive,
      false,
      'the extension was already running, so this test cannot prove the filename started it',
    );

    const uri = vscode.Uri.file(path.resolve(__dirname, '../../testFixture', 'openapi.yaml'));
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);

    assert.strictEqual(
      document.languageId,
      'apidom',
      'expected the contributed filename to claim the document',
    );

    const deadline = Date.now() + 60000;
    while (vscode.languages.getDiagnostics(uri).length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(
      vscode.languages.getDiagnostics(uri).length > 0,
      'no diagnostics: the extension did not activate for a file opened directly as apidom',
    );
  });
});
