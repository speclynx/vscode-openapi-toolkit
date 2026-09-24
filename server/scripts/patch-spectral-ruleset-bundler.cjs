'use strict';

const fs = require('node:fs');
const path = require('node:path');

const bundlerPkg = path.resolve(
  __dirname, '../../',
  'node_modules/@stoplight/spectral-ruleset-bundler/package.json',
);
const pkg = JSON.parse(fs.readFileSync(bundlerPkg, 'utf8'));

pkg.exports['./dist/loader/browser.js'] = './dist/loader/browser.js';
fs.writeFileSync(bundlerPkg, JSON.stringify(pkg, null, 2));
