import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setJsonValues } from './json-values.mjs';

test('version edits leave escapes, key order, inline arrays and other values as written', () => {
  const manifest = `{
  "version": "1.6.2",
  "author": "Vladim\\u00edr Gorej",
  "keywords": ["openapi", "lsp"],
  "dependencies": {
    "webpack-cli": "^7.0.2",
    "@speclynx/api-language-server": "1.6.2"
  },
  "packages": {
    "": { "version": "1.6.2" },
    "server": {
      "version": "1.6.2"
    }
  }
}
`;
  const paths = [
    ['version'],
    ['dependencies', '@speclynx/api-language-server'],
    ['packages', '', 'version'],
    ['packages', 'server', 'version'],
  ];
  assert.equal(setJsonValues(manifest, paths, '1.7.0'), manifest.replaceAll('1.6.2', '1.7.0'));
});
