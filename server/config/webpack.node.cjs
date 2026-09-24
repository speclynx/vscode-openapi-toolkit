const path = require('node:path');
const { attribution } = require('../../config/webpack-attribution.cjs');
const { node } = require('../../webpack.shared.config.cjs');

require('../scripts/patch-spectral-ruleset-bundler.cjs');

module.exports = node({
  ...attribution('server-node'),
  context: __dirname,
  entry: path.join('..', 'src', 'node', 'speclynxServerMain.ts'),
  output: {
    filename: 'speclynxServerMain.js',
    path: path.join(__dirname, '..', 'dist', 'node'),
  },
  resolve: {
    alias: {
      '@stoplight/spectral-ruleset-bundler/with-loader':
        '@stoplight/spectral-ruleset-bundler/dist/loader/browser.js',
    },
  },
});
