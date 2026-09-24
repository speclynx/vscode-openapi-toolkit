import * as vscode from 'vscode';
import * as assert from 'assert';

import { getDocUri, activate, doc } from './helper';

/**
 * Drives every language feature the server advertises through the real VS Code
 * extension host, so a capability that stops being offered, or is offered in a
 * shape the client silently drops, fails here rather than in someone's editor.
 *
 * `info.version` is deliberately missing from the fixture: it is what produces
 * the diagnostic and the quick fix.
 */
suite('Language features', () => {
  const docUri = getDocUri('oasfeatures.yaml');
  // `$ref: '#/components/schemas/Pet'` — the internal reference value.
  const refPosition = new vscode.Position(14, 40);
  // `$ref: './schemas/pet.yaml#/Pet'` — inside the file name of the external one.
  const externalRefPosition = new vscode.Position(24, 35);
  // The `Pet` schema name under `components.schemas`.
  const schemaPosition = new vscode.Position(27, 4);

  suiteSetup(async () => {
    await activate(docUri);
    await waitFor(() => vscode.languages.getDiagnostics(docUri).length > 0, 60000);
  });

  test('the document is recognised as an ApiDOM document', () => {
    assert.strictEqual(
      doc.languageId,
      'apidom',
      'language detection must claim the document, or every feature below is scoped out',
    );
  });

  test('publishes diagnostics', () => {
    const diagnostics = vscode.languages.getDiagnostics(docUri);
    assert.ok(diagnostics.length > 0, 'expected diagnostics for a document missing info.version');
    assert.ok(
      diagnostics.some((diagnostic) => diagnostic.message.includes('version')),
      `expected a diagnostic about the missing version, got ${JSON.stringify(
        diagnostics.map((d) => d.message),
      )}`,
    );
  });

  test('completion', async () => {
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      docUri,
      new vscode.Position(3, 0),
    );
    assert.ok((list?.items.length ?? 0) > 0, 'expected completion items');
  });

  test('hover', async () => {
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      docUri,
      new vscode.Position(0, 1),
    );
    assert.ok((hovers?.length ?? 0) > 0, 'expected hover content on the openapi field');
  });

  test('go to definition follows an internal $ref', async () => {
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      docUri,
      refPosition,
    );
    assert.ok((locations?.length ?? 0) > 0, 'expected a definition for the $ref target');
  });

  test('go to definition follows a $ref into another file', async () => {
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      docUri,
      externalRefPosition,
    );

    // Resolving across files goes through the reference resolver rather than
    // the document's own element tree, so it can break while every in-document
    // navigation keeps working.
    assert.ok((locations?.length ?? 0) > 0, 'expected a definition for the external $ref target');
    assert.ok(
      locations.some((location) => location.uri.path.endsWith('schemas/pet.yaml')),
      `expected the definition to land in schemas/pet.yaml, got ${JSON.stringify(
        locations.map((location) => location.uri.toString()),
      )}`,
    );
  });

  test('find references', async () => {
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      docUri,
      schemaPosition,
    );
    assert.ok((locations?.length ?? 0) > 0, 'expected references to the Pet schema');
  });

  test('document symbols', async () => {
    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      'vscode.executeDocumentSymbolProvider',
      docUri,
    );
    assert.ok((symbols?.length ?? 0) > 0, 'expected document symbols');
  });

  test('document links resolve an external $ref', async () => {
    const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
      'vscode.executeLinkProvider',
      docUri,
    );
    // API Language Service excludes internal fragments from link discovery outright — its
    // links service guards the `$ref` branch with `!value.startsWith('#')` — so
    // only references that leave the document become links. Internal ones are
    // still navigable: `textDocument/definition` resolves them to an exact range.
    assert.ok((links?.length ?? 0) > 0, 'expected a link for the external $ref');
    assert.ok(
      links.some((link) => link.target?.path.endsWith('schemas/pet.yaml')),
      `expected a link to schemas/pet.yaml, got ${JSON.stringify(
        links.map((link) => link.target?.toString()),
      )}`,
    );
  });

  test('semantic tokens', async () => {
    const tokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
      'vscode.provideDocumentSemanticTokens',
      docUri,
    );
    assert.ok(tokens !== undefined, 'no semantic tokens provider was registered');
    assert.ok((tokens?.data.length ?? 0) > 0, 'expected encoded semantic token data');
    assert.strictEqual(tokens.data.length % 5, 0, 'token data is encoded in groups of five');
  });

  test('code actions offer a quick fix for the diagnostic', async () => {
    const diagnostic = vscode.languages
      .getDiagnostics(docUri)
      .find((item) => item.message.includes('version'));
    assert.ok(diagnostic, 'expected the missing-version diagnostic to drive a quick fix');

    const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
      'vscode.executeCodeActionProvider',
      docUri,
      diagnostic.range,
    );
    assert.ok((actions?.length ?? 0) > 0, 'expected at least one quick fix');
  });

  test('formatting', async () => {
    const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
      'vscode.executeFormatDocumentProvider',
      docUri,
      { tabSize: 2, insertSpaces: true },
    );
    // A well-formed document may need no edits; the provider must still answer.
    assert.ok(Array.isArray(edits), 'expected the formatting provider to respond');
  });
});

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (predicate()) return;
    if (Date.now() > deadline) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
