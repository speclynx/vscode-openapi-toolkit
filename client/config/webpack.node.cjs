'use strict';

const path = require('node:path');
const { attribution } = require('../../config/webpack-attribution.cjs');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { node, nodePlugins } = require('../../webpack.shared.config');

module.exports = node({
  ...attribution('client-node'),
  context: __dirname,
  entry: path.join('..', 'src', 'node', 'speclynxClientMain.ts'),
  output: {
    filename: 'speclynxClientMain.js',
    path: path.join(__dirname, '..', 'dist', 'node'),
  },
  plugins: [
    ...attribution('client-node').plugins,
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(__dirname, '..', 'src', 'preview', 'webview'),
          to: path.join(__dirname, '..', 'dist', 'preview', 'webview'),
          // Keep reviewed upstream bytes and initializer scripts intact.
          info: { minimized: true },
        },
      ],
    }),
    ...nodePlugins(__dirname),
  ],
});
