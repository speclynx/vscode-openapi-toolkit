'use strict';

const path = require('node:path');
const { attribution } = require('../../config/webpack-attribution.cjs');
const { browser } = require('../../webpack.shared.config');

module.exports = browser({
  ...attribution('server-browser'),
  context: __dirname,
  entry: path.join('..', 'src', 'browser', 'speclynxServerMain.ts'),
  output: {
    filename: 'speclynxServerMain.js',
    path: path.join(__dirname, '..', 'dist', 'browser'),
    libraryTarget: 'var',
    library: 'serverExportVar',
  },
});
