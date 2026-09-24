#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const publicRepository = 'speclynx/vscode-openapi-toolkit';
export const packageName = '@speclynx/api-language-server';
export function digests(bytes) {
  return {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
  };
}
export function validateRecord(record, expectedSha) {
  assert.equal(record.schemaVersion, 1);
  assert.match(record.sourceSha, /^[a-f0-9]{40}$/);
  if (expectedSha) assert.equal(record.sourceSha, expectedSha);
  assert.match(record.version, /^\d+\.\d+\.\d+$/);
  assert.match(String(record.origin.runId), /^\d+$/);
  assert.ok(Number(record.origin.runId) > 0);
  assert.ok(Number.isInteger(record.origin.runAttempt) && record.origin.runAttempt > 0);
  for (const [kind, expected] of Object.entries({
    npm: `speclynx-api-language-server-${record.version}.tgz`,
    vsix: `vscode-openapi-toolkit-${record.version}.vsix`,
  })) {
    assert.equal(record.files[kind].filename, expected);
    assert.match(record.files[kind].sha256, /^[a-f0-9]{64}$/);
  }
  assert.match(record.files.npm.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
  if (record.deliverablesArtifactId !== undefined)
    assert.match(String(record.deliverablesArtifactId), /^[1-9]\d*$/);
  return record;
}
export function verifyFiles(record, directory, expectedSha) {
  validateRecord(record, expectedSha);
  for (const [kind, item] of Object.entries(record.files)) {
    assert.ok(['npm', 'vsix'].includes(kind));
    const actual = digests(readFileSync(path.join(directory, item.filename)));
    assert.equal(actual.sha256, item.sha256, `${kind} archive differs from retained identity`);
    if (kind === 'npm') assert.equal(actual.integrity, item.integrity);
  }
}
export async function registryMetadata(
  version,
  request = fetch,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  assert.match(version, /^\d+\.\d+\.\d+$/);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request(
        `https://registry.npmjs.org/@speclynx%2fapi-language-server/${version}`,
        { signal: AbortSignal.timeout(20000) },
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Registry request failed');
      const result = await response.json();
      assert.equal(result.name, packageName);
      assert.equal(result.version, version);
      assert.ok(
        result.dist?.integrity && result.dist?.tarball && result.gitHead,
        'Incomplete registry metadata',
      );
      return result;
    } catch {
      if (attempt === 2)
        throw new Error(
          'Registry could not provide definitive version metadata after three attempts',
        );
      await pause(1000 * (attempt + 1));
    }
  }
}
export async function registryState(record, request = fetch, pause) {
  validateRecord(record);
  const metadata = await registryMetadata(record.version, request, pause);
  if (metadata === null) return 'absent';
  assert.equal(metadata.gitHead, record.sourceSha, 'Registry source commit mismatch');
  assert.equal(metadata.dist.integrity, record.files.npm.integrity, 'Registry npm SRI mismatch');
  const url = `https://registry.npmjs.org/@speclynx/api-language-server/-/api-language-server-${record.version}.tgz`;
  assert.equal(metadata.dist.tarball, url, 'Unexpected registry tarball URL');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request(url, {
        signal: AbortSignal.timeout(30000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Tarball request failed');
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(
        digests(bytes).sha256,
        record.files.npm.sha256,
        'Registry tarball bytes mismatch',
      );
      return 'present-identical';
    } catch (error) {
      if (error.code === 'ERR_ASSERTION' || attempt === 2)
        throw new Error('Registry tarball identity verification failed');
      await (pause ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(
        1000 * (attempt + 1),
      );
    }
  }
}
function output(key, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  console.log(`${key}=${value}`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [command, directory = 'release-artifacts'] = process.argv
      .slice(2)
      .filter((argument) => !argument.startsWith('--'));
    if (command === 'record') {
      const version = JSON.parse(readFileSync('package.json')).version;
      const record = {
        schemaVersion: 1,
        sourceSha: process.env.GITHUB_SHA,
        version,
        origin: {
          runId: process.env.GITHUB_RUN_ID,
          runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
        },
        files: {},
      };
      for (const [kind, filename] of Object.entries({
        npm: `speclynx-api-language-server-${version}.tgz`,
        vsix: `vscode-openapi-toolkit-${version}.vsix`,
      })) {
        const digest = digests(readFileSync(path.join(directory, filename)));
        record.files[kind] = {
          filename,
          sha256: digest.sha256,
          ...(kind === 'npm' ? { integrity: digest.integrity } : {}),
        };
      }
      validateRecord(record, process.env.GITHUB_SHA);
      writeFileSync(
        path.join(directory, 'release-record.json'),
        `${JSON.stringify(record, null, 2)}\n`,
      );
    } else {
      const record = JSON.parse(readFileSync(path.join(directory, 'release-record.json')));
      verifyFiles(record, directory, process.env.GITHUB_SHA);
      if (command === 'verify') output('verified', record.sourceSha);
      else if (command === 'finalize') {
        record.deliverablesArtifactId = process.env.DELIVERABLES_ARTIFACT_ID;
        validateRecord(record);
        assert.ok(record.deliverablesArtifactId);
        writeFileSync(
          path.join(directory, 'release-record.json'),
          `${JSON.stringify(record, null, 2)}\n`,
        );
      } else if (['registry', 'publish'].includes(command)) {
        let state = await registryState(record);
        if (command === 'publish' && state === 'absent') {
          // Paths never enter a shell. CI runs on a hosted Linux runner.
          execFileSync(
            'npm',
            [
              'publish',
              path.resolve(directory, record.files.npm.filename),
              '--access',
              'public',
              '--provenance',
            ],
            { stdio: 'inherit' },
          );
          state = await registryState(record);
          assert.equal(state, 'present-identical');
        }
        if (process.argv.includes('--require-present')) assert.equal(state, 'present-identical');
        output('registry_state', state);
      } else throw new Error('Unknown release-artifacts command');
    }
  } catch (error) {
    console.error(
      error instanceof Error && !('stdout' in error)
        ? error.message
        : 'Release artifact command failed; no publication identity accepted.',
    );
    process.exitCode = 1;
  }
}
