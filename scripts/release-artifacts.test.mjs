import assert from 'node:assert/strict';
import { test } from 'node:test';
import { digests, registryState, registryMetadata, validateRecord } from './release-artifacts.mjs';
import { selectRecord } from './find-release-record.mjs';
const bytes = Buffer.from('synthetic retained archive');
const record = {
  schemaVersion: 1,
  sourceSha: 'a'.repeat(40),
  version: '1.6.0',
  origin: { runId: '123', runAttempt: 1 },
  files: {
    npm: { filename: 'speclynx-api-language-server-1.6.0.tgz', ...digests(bytes) },
    vsix: { filename: 'vscode-openapi-toolkit-1.6.0.vsix', sha256: 'b'.repeat(64) },
  },
  deliverablesArtifactId: '456',
};
const metadata = {
  name: '@speclynx/api-language-server',
  version: '1.6.0',
  gitHead: record.sourceSha,
  dist: {
    integrity: record.files.npm.integrity,
    tarball:
      'https://registry.npmjs.org/@speclynx/api-language-server/-/api-language-server-1.6.0.tgz',
  },
};
const reply = (data, status = 200) => ({ status, ok: status === 200, json: async () => data });
test('only a definite registry 404 permits first publication', async () => {
  assert.equal(await registryState(record, async () => reply(null, 404)), 'absent');
  let attempts = 0;
  await assert.rejects(() =>
    registryMetadata(
      '1.6.0',
      async () => {
        attempts++;
        return reply(null, 503);
      },
      async () => {},
    ),
  );
  assert.equal(attempts, 3);
});
test('matching gitHead, SRI and downloaded bytes permit a retry to skip publication', async () => {
  const request = async (url) =>
    url.endsWith('.tgz') ? { ok: true, arrayBuffer: async () => bytes } : reply(metadata);
  assert.equal(await registryState(record, request), 'present-identical');
});
test('same gitHead with different bytes or SRI stops before publication', async () => {
  await assert.rejects(() =>
    registryState(record, async () =>
      reply({
        ...metadata,
        dist: { ...metadata.dist, integrity: digests(Buffer.from('other')).integrity },
      }),
    ),
  );
  await assert.rejects(() =>
    registryState(record, async (url) =>
      url.endsWith('.tgz')
        ? { ok: true, arrayBuffer: async () => Buffer.from('other') }
        : reply(metadata),
    ),
  );
});
test('records constrain source and filenames before reading archives', () => {
  assert.doesNotThrow(() => validateRecord(record, record.sourceSha));
  assert.throws(() => validateRecord(record, 'c'.repeat(40)));
  assert.throws(() =>
    validateRecord({
      ...record,
      files: { ...record.files, npm: { ...record.files.npm, filename: '../escape.tgz' } },
    }),
  );
});
test('record lookup never selects a newer same-named artifact or expired bytes', () => {
  assert.equal(selectRecord([], 'record'), undefined);
  const original = { name: 'record', id: 1, expired: false };
  assert.equal(selectRecord([original], 'record'), original);
  assert.throws(() => selectRecord([original, { ...original, id: 2 }], 'record'));
  assert.throws(() => selectRecord([{ ...original, expired: true }], 'record'));
});
