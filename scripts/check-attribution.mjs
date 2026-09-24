#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { checkLicense } = require('../config/webpack-attribution.cjs');
const recoveryTable = require('../server/config/licenses/recovered.json');
export const inventoryPaths = [
  'client/dist/node/THIRD-PARTY-client-node-INVENTORY.json',
  'client/dist/browser/THIRD-PARTY-client-browser-INVENTORY.json',
  'server/dist/node/THIRD-PARTY-server-node-INVENTORY.json',
  'server/dist/browser/THIRD-PARTY-server-browser-INVENTORY.json',
  'server/dist/node/THIRD-PARTY-INVENTORY.json',
];
const needed = new Set();
for (const file of inventoryPaths) {
  const inventory = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(inventory.packages.length > 0, `Empty inventory: ${file}`);
  const notices = readFileSync(file.replace('INVENTORY.json', 'NOTICES.txt'), 'utf8');
  for (const item of inventory.packages) {
    checkLicense(item.license);
    assert.ok(notices.includes(`${item.name}@${item.version}`), `Missing notice: ${item.name}`);
    if (item.recovered) needed.add(item.name);
  }
  console.log(`${inventory.target}: ${inventory.packages.length} attributed packages`);
}
for (const name of Object.keys(recoveryTable))
  assert.ok(needed.has(name), `Stale recovered notice: ${name}`);
const vendor = JSON.parse(readFileSync('config/preview-assets.json', 'utf8'));
assert.equal(vendor.schemaVersion, 1);
assert.ok(vendor.packages.length > 0);
const actualAssets = ['scalar', 'swagger-ui'].flatMap((renderer) => {
  const root = `client/src/preview/webview/${renderer}`;
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.name.endsWith('.initialize.js') &&
        !entry.name.endsWith('.override.css'),
    )
    .map((entry) => `${entry.parentPath}/${entry.name}`);
});
assert.deepEqual(
  vendor.assets.map((asset) => asset.path).sort(),
  actualAssets.sort(),
  'Every copied preview file needs an exact inventory entry',
);
for (const asset of vendor.assets) {
  const digest = createHash('sha256').update(readFileSync(asset.path)).digest('hex');
  assert.equal(
    digest,
    asset.sha256,
    `Preview asset changed without provenance update: ${asset.path}`,
  );
  const built = readFileSync(asset.path.replace('/src/', '/dist/'));
  assert.equal(
    createHash('sha256').update(built).digest('hex'),
    asset.sha256,
    `Copied preview bytes changed during the build: ${asset.path}`,
  );
}
for (const item of vendor.packages) checkLicense(item.license);
console.log(
  `Copied assets: ${vendor.assets.length} verified files, ${vendor.packages.length} attributed package versions`,
);
