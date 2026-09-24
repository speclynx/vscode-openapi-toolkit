const fs = require('node:fs');
const path = require('node:path');
const { Compilation, sources } = require('webpack');
const { LicenseWebpackPlugin } = require('license-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const parseSpdx = require('spdx-expression-parse');
const recoveries = require('../server/config/licenses/recovered.json');

// Preserve the existing excluded families, checking every term of compound SPDX
// expressions. Unknown/custom terms need explicit review; MPL is not silently banned.
function checkLicense(expression) {
  const visit = (term) => {
    if (term.conjunction) {
      visit(term.left);
      visit(term.right);
      return;
    }
    if (!term.license || /^(?:GPL|AGPL|LGPL|SSPL|LicenseRef-|DocumentRef-)/i.test(term.license)) {
      throw new Error(`License requires redistribution review: ${String(expression)}`);
    }
  };
  visit(parseSpdx(expression));
}

function noticeOf(module) {
  const notices = fs
    .readdirSync(module.directory)
    .filter(
      (file) =>
        /^notice(?:\.|$)/i.test(file) && fs.statSync(path.join(module.directory, file)).isFile(),
    );
  return notices.flatMap((file) => [
    `The NOTICE distributed with ${module.name}:`,
    '',
    fs.readFileSync(path.join(module.directory, file), 'utf8').trimEnd(),
    '',
  ]);
}

function attribution(target) {
  if (
    !['standalone', 'client-node', 'client-browser', 'server-node', 'server-browser'].includes(
      target,
    )
  ) {
    throw new Error(`Unknown attribution target: ${target}`);
  }
  const basename = target === 'standalone' ? 'THIRD-PARTY' : `THIRD-PARTY-${target}`;
  const recovered = new Set();
  let inventory;
  const embedsParser = target === 'standalone' || target.startsWith('server-');
  const notices = new LicenseWebpackPlugin({
    outputFilename: `${basename}-NOTICES.txt`,
    perChunkOutput: false,
    addBanner: true,
    excludedPackageTest: (name) =>
      [
        'vscode-openapi-toolkit',
        'vscode-openapi-toolkit-client',
        '@speclynx/api-language-server',
      ].includes(name),
    unacceptableLicenseTest: (license) => {
      checkLicense(license);
      return false;
    },
    handleMissingLicenseType: (name) => {
      throw new Error(`Missing license identifier: ${name}`);
    },
    licenseFileOverrides: { '@speclynx/api-languageservice': 'LICENSES/Apache-2.0.txt' },
    // redos-detector embeds this parser rather than importing it. Every server
    // target uses boundedPatterns, so all three redistribute that embedded code.
    additionalModules: embedsParser
      ? [
          {
            name: 'regjsparser',
            directory: path.dirname(
              require.resolve('regjsparser/package.json', {
                paths: [path.dirname(require.resolve('redos-detector/package.json'))],
              }),
            ),
          },
        ]
      : [],
    handleMissingLicenseText: (name, license) => {
      const recovery = recoveries[name];
      if (!recovery || recovery.license !== license)
        throw new Error(`Missing or unreviewed license text: ${name}`);
      recovered.add(name);
      return `${recovery.source}\n\n${fs
        .readFileSync(path.join(__dirname, '../server/config/licenses', recovery.file), 'utf8')
        .replace(/^\n+/, '')
        .trimEnd()}`;
    },
    renderLicenses: (modules) => {
      if (embedsParser && !modules.some((module) => module.name === 'redos-detector')) {
        throw new Error(`${target}: embedded parser entry is stale; review the target graph`);
      }
      for (const module of modules) {
        checkLicense(module.licenseId);
        if (!module.licenseText?.trim()) throw new Error(`No license text: ${module.name}`);
        const recovery = recoveries[module.name];
        if (
          recovery &&
          (!recovered.has(module.name) || module.packageJson.version !== recovery.version)
        ) {
          throw new Error(
            `Review recovered notice for ${module.name}@${module.packageJson.version}`,
          );
        }
      }
      const sorted = modules.slice().sort((a, b) => a.name.localeCompare(b.name));
      inventory = {
        target,
        packages: sorted.map((module) => ({
          name: module.name,
          version: module.packageJson.version,
          license: module.licenseId,
          recovered: recovered.has(module.name),
        })),
      };
      return [
        `Open-source software redistributed in OpenAPI Toolkit (${target}).`,
        'OpenAPI Toolkit itself is licensed under Apache-2.0; see LICENSE.',
        '',
        ...sorted.flatMap((module) => [
          '-'.repeat(78),
          `${module.name}@${module.packageJson.version} — ${module.licenseId}`,
          '-'.repeat(78),
          '',
          module.licenseText,
          '',
          ...noticeOf(module),
        ]),
      ].join('\n');
    },
  });
  const inventoryPlugin = {
    apply(compiler) {
      compiler.hooks.thisCompilation.tap('AttributionInventory', (compilation) => {
        compilation.hooks.processAssets.tap(
          { name: 'AttributionInventory', stage: Compilation.PROCESS_ASSETS_STAGE_REPORT + 2 },
          () => {
            if (!inventory?.packages.length)
              throw new Error(`Missing attribution inventory for ${target}`);
            compilation.emitAsset(
              `${basename}-INVENTORY.json`,
              new sources.RawSource(`${JSON.stringify(inventory, null, 2)}\n`),
            );
          },
        );
      });
    },
  };
  return {
    plugins: [notices, inventoryPlugin],
    optimization: {
      concatenateModules: false,
      minimizer: [
        new TerserPlugin({
          extractComments: false,
          terserOptions: {
            format: { comments: /^\**!|@preserve|@license|@cc_on/i },
            mangle: true,
            keep_classnames: true,
          },
        }),
      ],
    },
    ignoreWarnings: [
      (warning) => {
        const text = String(warning.message ?? warning);
        return Object.keys(recoveries).some((name) =>
          text.includes(`could not find any license file for ${name}.`),
        );
      },
    ],
  };
}
module.exports = { attribution, checkLicense };
