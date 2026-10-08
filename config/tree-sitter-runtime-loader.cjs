'use strict';

// Emscripten uses these URLs to locate its runtime, not a build-time asset.
// Webpack's default import.meta.url replacement embeds the builder's filename.
// Keep the separate new URL(wasm, import.meta.url) asset expression intact.
module.exports = function treeSitterRuntimeLoader(source) {
  const { runtime } = this.getOptions();
  if (runtime !== 'node' && runtime !== 'browser') {
    throw new Error('Unknown tree-sitter bundle runtime');
  }
  const requireBase = /createRequire\(import\.meta\.url\)/g;
  const scriptBase = /var _scriptName = import\.meta\.url;/g;
  if (
    [...source.matchAll(requireBase)].length !== 1 ||
    [...source.matchAll(scriptBase)].length !== 1 ||
    [...source.matchAll(/import\.meta\.url/g)].length !== 3
  ) {
    throw new Error('Review changed web-tree-sitter runtime URL expressions');
  }
  if (runtime === 'node') {
    return (
      "import { pathToFileURL as speclynxRuntimeFileURL } from 'node:url';\n" +
      source
        .replace(requireBase, 'createRequire(__filename)')
        .replace(scriptBase, 'var _scriptName = speclynxRuntimeFileURL(__filename).href;')
    );
  }
  return source
    .replace(requireBase, 'createRequire(self.location.href)')
    .replace(scriptBase, 'var _scriptName = self.location.href;');
};
