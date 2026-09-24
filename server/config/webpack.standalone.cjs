const path = require('node:path');
const { BannerPlugin } = require('webpack');
const { node } = require('../../webpack.shared.config.cjs');
const { attribution } = require('../../config/webpack-attribution.cjs');

/**
 * The published npm package: the whole language server in one file, with no
 * runtime dependencies. The extension already bundles the server from source
 * into its own artifact; this is the same treatment for the package, which
 * otherwise hands every consumer a few hundred transitive packages to install.
 *
 * Bundling makes this package the distributor of everything it absorbs, so the
 * licences and copyright notices that npm used to deliver alongside each
 * dependency are collected into THIRD-PARTY-NOTICES.txt beside the bundle. A
 * module whose notice cannot be found fails the build rather than shipping
 * unattributed: a licence that says the copyright and permission notice must
 * travel with the code is not satisfied by naming the licence, so a handful of
 * packages that publish no notice of their own have a reviewed copy of theirs
 * in config/licenses, recorded with where it came from.
 *
 * Two outputs. `server.js` is the bundle, and is both what the executable runs
 * and what the `exports` map points at, so a consumer embedding the server gets
 * the same code the command line does. `cli.js` is the executable itself: a
 * launcher that requires the bundle rather than repeating it, which is why the
 * bundle is external to that build.
 */
const shebang = () =>
  new BannerPlugin({ banner: '#!/usr/bin/env node', raw: true, entryOnly: true });

module.exports = [
  node({
    context: __dirname,
    entry: path.join('..', 'src', 'node', 'bin.ts'),
    output: {
      filename: 'server.js',
      path: path.join(__dirname, '..', 'dist', 'node'),
    },
    ...attribution('standalone'),
  }),
  node({
    context: __dirname,
    entry: path.join('..', 'src', 'node', 'cli.ts'),
    output: {
      filename: 'cli.js',
      path: path.join(__dirname, '..', 'dist', 'node'),
    },
    externals: [{ './bin': 'commonjs ./server.js' }],
    plugins: [shebang()],
  }),
];
