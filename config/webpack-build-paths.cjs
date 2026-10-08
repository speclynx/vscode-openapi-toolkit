'use strict';

const { realpathSync } = require('node:fs');
const { pathToFileURL } = require('node:url');

function containsBuildPath(source, roots) {
  const normalized = source.replaceAll('\\/', '/').replaceAll('\\\\', '\\');
  if (/["'`]file:\/\/\/(?!\$\{)[^"'`\s\\]/i.test(normalized)) return true;
  if (/(?:^|[/\\])(?:\.ftlocal|\.codex|\.idea)[/\\]/.test(normalized)) return true;
  return roots.some((root) => {
    const variants = [root, root.replaceAll('\\', '/'), pathToFileURL(root).href];
    return variants.some((value) =>
      [value, encodeURI(value), encodeURIComponent(value)].some((form) =>
        normalized.includes(form),
      ),
    );
  });
}

class BuildPathGuardPlugin {
  constructor(root) {
    this.roots = [...new Set([root, realpathSync(root)])];
  }

  apply(compiler) {
    const name = 'BuildPathGuardPlugin';
    compiler.hooks.thisCompilation.tap(name, (compilation) => {
      compilation.hooks.afterProcessAssets.tap(name, () => {
        for (const asset of compilation.getAssets()) {
          if (containsBuildPath(asset.source.source().toString(), this.roots)) {
            // Do not disclose the rejected path or surrounding artifact bytes in CI.
            compilation.errors.push(
              new compiler.webpack.WebpackError(
                'Generated asset contains a build path or literal local file URL; inspect locally.',
              ),
            );
          }
        }
      });
    });
  }
}

module.exports = { BuildPathGuardPlugin, containsBuildPath };
