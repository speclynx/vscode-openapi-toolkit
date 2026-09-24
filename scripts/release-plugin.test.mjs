import assert from 'node:assert/strict';
import { test } from 'node:test';
import { promotedCatalog, compareVersions, validateRuntimeEvidence } from './release-plugin.mjs';
import { repositoryUrl, pluginPath } from './check-plugin-catalog.mjs';
const oldSha = 'a'.repeat(40),
  newSha = 'b'.repeat(40);
const oldEntry = {
  name: 'speclynx-lsp',
  source: { source: 'git-subdir', url: repositoryUrl, path: pluginPath, sha: oldSha },
};
test('promotion uses the published pin, preserves other entries and ignores development versions', () => {
  const other = { name: 'other-plugin', source: './other' };
  const result = promotedCatalog(
    { name: 'speclynx', plugins: [other, oldEntry] },
    '1.6.1',
    newSha,
    (sha) => {
      assert.equal(sha, oldSha);
      return { version: '1.6.0' };
    },
  );
  assert.equal(result.action, 'advance');
  assert.deepEqual(result.catalog.plugins[0], other);
  assert.equal(result.catalog.plugins[1].source.sha, newSha);
  assert.equal(result.previousSha, oldSha);
});
test('old reruns do not roll back the catalog and equal versions cannot replace cached payloads', () => {
  const catalog = { name: 'speclynx', plugins: [oldEntry] };
  assert.equal(
    promotedCatalog(catalog, '1.6.0', newSha, () => ({ version: '1.6.1' })).action,
    'newer',
  );
  assert.throws(() => promotedCatalog(catalog, '1.6.0', newSha, () => ({ version: '1.6.0' })));
  assert.equal(
    promotedCatalog(catalog, '1.6.0', oldSha, () => ({ version: '1.6.0' })).action,
    'identical',
  );
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
});
test('runtime evidence must match the exact payload and currently served predecessor', () => {
  const record = { sourceSha: 'c'.repeat(40), version: '1.6.1' };
  const evidence = {
    schemaVersion: 1,
    sourceSha: record.sourceSha,
    payloadSha: newSha,
    previousPayloadSha: oldSha,
    version: record.version,
    nodeVersion: '24.10.0',
    npmVersion: '11.6.1',
    claudeVersion: '2.1.1',
    installMs: 1000,
    diagnosticsVerified: true,
    cachedUpgradeVerified: true,
    reviewer: 'example-reviewer',
    reviewedAt: '2026-09-17T00:00:00Z',
  };
  assert.doesNotThrow(() => validateRuntimeEvidence(evidence, record, newSha, oldSha));
  assert.throws(() => validateRuntimeEvidence(evidence, record, newSha, 'd'.repeat(40)));
  assert.throws(() =>
    validateRuntimeEvidence({ ...evidence, cachedUpgradeVerified: false }, record, newSha, oldSha),
  );
  assert.throws(() =>
    validateRuntimeEvidence({ ...evidence, installMs: 61000 }, record, newSha, oldSha),
  );
});
