import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retiredIdentifiers } from './check-retired-identifiers.mjs';

test('overlapping identifiers are evaluated independently', () => {
  const found = retiredIdentifiers('README.md', 'apidom-lsp-vscode and apidom-ls');
  assert.ok(found.includes('apidom-ls'));
  assert.ok(found.includes('apidom-lsp-vscode'));
  assert.deepEqual(retiredIdentifiers('README.md', 'my-apidom-ls-copy'), []);
});
test('historical document paths grant no old-name exemption', () => {
  const stale = 'import service from "@speclynx/apidom-ls";';
  assert.ok(retiredIdentifiers('server/src/index.ts', stale).length > 0);
  assert.ok(retiredIdentifiers('docs/changelog/new.md', stale).length > 0);
  assert.ok(
    retiredIdentifiers('docs/changelog/01-lsp-server/03-release-and-publish-plan.md', stale)
      .length > 0,
  );
  assert.ok(retiredIdentifiers('server/src/index.ts', '// speclynx-api-lsp').length > 0);
});
