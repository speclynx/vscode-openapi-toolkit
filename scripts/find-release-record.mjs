#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { publicRepository, registryMetadata, validateRecord } from './release-artifacts.mjs';

export function selectRecord(artifacts, name) {
  const matches = artifacts.filter((item) => item.name === name);
  assert.ok(
    matches.length <= 1,
    'Ambiguous release record identities; select the reviewed original in a separate recovery procedure',
  );
  if (matches.length) assert.equal(matches[0].expired, false, 'Original release record expired');
  return matches[0];
}
function api(endpoint) {
  return JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8' }));
}
function output(key, value) {
  appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}
async function run() {
  assert.equal(process.env.GITHUB_REPOSITORY, publicRepository);
  const sha = process.env.GITHUB_SHA;
  assert.match(sha, /^[a-f0-9]{40}$/);
  const artifacts = [];
  for (let page = 1; ; page++) {
    const result = api(
      `/repos/${publicRepository}/actions/artifacts?name=release-record-${sha}&per_page=100&page=${page}`,
    );
    artifacts.push(...result.artifacts);
    if (result.artifacts.length < 100) break;
  }
  const recordArtifact = selectRecord(artifacts, `release-record-${sha}`);
  if (!recordArtifact) {
    assert.equal(
      process.env.GITHUB_RUN_ATTEMPT,
      '1',
      'A rerun without its original record needs separately reviewed recovery; do not rebuild',
    );
    assert.equal(
      await registryMetadata(process.env.RELEASE_VERSION),
      null,
      'Published version exists but its original release record is unavailable',
    );
    // Detect an interrupted upload/finalization, rather than building over it.
    const candidates = api(
      `/repos/${publicRepository}/actions/artifacts?name=release-deliverables-${sha}&per_page=100`,
    ).artifacts;
    assert.equal(
      candidates.length,
      0,
      'Deliverables exist without a finalized record; recover their original identity before continuing',
    );
    output('restore', 'false');
    return;
  }
  const run = api(`/repos/${publicRepository}/actions/runs/${recordArtifact.workflow_run.id}`);
  assert.equal(run.head_sha, sha);
  assert.equal(run.path, '.github/workflows/release.yml');
  assert.ok(['push', 'workflow_dispatch'].includes(run.event));
  // Read only the one expected JSON member. No archive member is extracted or executed.
  const archive = execFileSync(
    'gh',
    ['api', `/repos/${publicRepository}/actions/artifacts/${recordArtifact.id}/zip`],
    { maxBuffer: 2 * 1024 * 1024 },
  );
  const bytes = execFileSync(
    'python3',
    [
      '-c',
      'import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.namelist()==["release-record.json"]; m=z.getinfo("release-record.json"); assert m.file_size<65536 and not m.flag_bits&1; sys.stdout.buffer.write(z.read(m))',
    ],
    { input: archive },
  );
  const record = validateRecord(JSON.parse(bytes), sha);
  assert.equal(record.version, process.env.RELEASE_VERSION);
  assert.ok(record.deliverablesArtifactId);
  assert.equal(String(recordArtifact.workflow_run.id), String(record.origin.runId));
  const deliverables = api(
    `/repos/${publicRepository}/actions/artifacts/${record.deliverablesArtifactId}`,
  );
  assert.equal(deliverables.expired, false, 'Original deliverables have expired');
  assert.equal(deliverables.name, `release-deliverables-${sha}`);
  assert.equal(String(deliverables.workflow_run.id), String(record.origin.runId));
  assert.equal(deliverables.workflow_run.head_sha, sha);
  mkdirSync('retained-record', { recursive: true });
  writeFileSync('retained-record/release-record.json', bytes);
  output('restore', 'true');
  output('record_id', recordArtifact.id);
  output('deliverables_id', record.deliverablesArtifactId);
  output('origin_run_id', record.origin.runId);
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  run().catch(() => {
    console.error(
      'Original release record lookup failed. Inspect the run and retained artifact identities; no rebuild is authorized.',
    );
    process.exitCode = 1;
  });
