#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCatalog, pluginPath, repositoryUrl } from './check-plugin-catalog.mjs';
import { publicRepository, digests, verifyFiles, registryState } from './release-artifacts.mjs';

export function compareVersions(a, b) {
  for (const value of [a, b]) assert.match(value, /^\d+\.\d+\.\d+$/);
  const left = a.split('.').map(BigInt);
  const right = b.split('.').map(BigInt);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}
export function promotedCatalog(catalog, version, payloadSha, readPinned) {
  assert.match(payloadSha, /^[a-f0-9]{40}$/);
  const old = catalog.plugins.filter((entry) => entry.name === 'speclynx-lsp');
  assert.ok(old.length <= 1);
  if (old.length) {
    const source = old[0].source;
    assert.equal(source.source, 'git-subdir');
    assert.equal(source.url, repositoryUrl);
    assert.equal(source.path, pluginPath);
    assert.match(source.sha, /^[a-f0-9]{40}$/);
    const published = readPinned(source.sha, `${pluginPath}/.claude-plugin/plugin.json`);
    const comparison = compareVersions(published.version, version);
    if (comparison > 0) return { action: 'newer', catalog };
    if (comparison === 0) {
      assert.equal(
        source.sha,
        payloadSha,
        'Equal-version payload changes require a new plugin version',
      );
      return { action: 'identical', catalog };
    }
  }
  const entry = {
    name: 'speclynx-lsp',
    description: 'API language server for OpenAPI documents.',
    category: 'development',
    source: { source: 'git-subdir', url: repositoryUrl, path: pluginPath, sha: payloadSha },
  };
  const plugins = [...catalog.plugins];
  const index = plugins.findIndex((item) => item.name === entry.name);
  if (index < 0) plugins.push(entry);
  else plugins[index] = entry;
  return {
    action: 'advance',
    previousSha: old[0]?.source.sha ?? null,
    catalog: { ...catalog, plugins },
  };
}
export function validateRuntimeEvidence(evidence, record, payloadSha, previousSha) {
  assert.deepEqual(
    Object.keys(evidence).sort(),
    [
      'schemaVersion',
      'sourceSha',
      'payloadSha',
      'previousPayloadSha',
      'version',
      'nodeVersion',
      'npmVersion',
      'claudeVersion',
      'installMs',
      'diagnosticsVerified',
      'cachedUpgradeVerified',
      'reviewer',
      'reviewedAt',
    ].sort(),
  );
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.sourceSha, record.sourceSha);
  assert.equal(evidence.payloadSha, payloadSha);
  assert.equal(evidence.version, record.version);
  assert.equal(evidence.previousPayloadSha, previousSha);
  assert.equal(evidence.diagnosticsVerified, true);
  assert.equal(evidence.cachedUpgradeVerified, true);
  assert.ok(
    Number.isFinite(evidence.installMs) && evidence.installMs > 0 && evidence.installMs <= 60000,
  );
  for (const key of ['nodeVersion', 'npmVersion', 'claudeVersion'])
    assert.match(evidence[key], /^v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/);
  assert.match(evidence.reviewer, /^[A-Za-z0-9-]{1,39}$/);
  assert.ok(Number.isFinite(Date.parse(evidence.reviewedAt)));
}
function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...options }).trim();
}
function readPinned(sha, file) {
  assert.match(sha, /^[a-f0-9]{40}$/);
  return JSON.parse(git(['show', `${sha}:${file}`]));
}
function commitTree(tree, parent, message, date) {
  return git(
    [
      '-c',
      'user.name=github-actions[bot]',
      '-c',
      'user.email=41898282+github-actions[bot]@users.noreply.github.com',
      'commit-tree',
      tree,
      '-p',
      parent,
      '-m',
      message,
    ],
    {
      env: { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) },
    },
  );
}
function withChangedFile(base, file, bytes) {
  const temporary = mkdtempSync(path.join(tmpdir(), 'speclynx-plugin-index-'));
  const env = { ...process.env, GIT_INDEX_FILE: path.join(temporary, 'index') };
  try {
    git(['read-tree', base], { env });
    const blob = git(['hash-object', '-w', '--stdin'], { input: bytes });
    git(['update-index', '--add', '--cacheinfo', '100644', blob, file], { env });
    return git(['write-tree'], { env });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
function remotePayload(ref) {
  const result = git(['ls-remote', '--refs', repositoryUrl, ref]);
  if (!result) return null;
  const [sha] = result.split(/\s+/);
  assert.match(sha, /^[a-f0-9]{40}$/);
  git(['fetch', '--no-tags', repositoryUrl, ref]);
  return sha;
}
function validatePayload(sha, record) {
  assert.equal(git(['rev-parse', `${sha}^`]), record.sourceSha);
  assert.equal(
    git(['diff', '--name-only', record.sourceSha, sha]),
    `${pluginPath}/package-lock.json`,
  );
  const catalog = {
    name: 'speclynx',
    plugins: [
      {
        name: 'speclynx-lsp',
        source: { source: 'git-subdir', url: repositoryUrl, path: pluginPath, sha },
      },
    ],
  };
  checkCatalog(catalog, { readPinned });
  assert.equal(readPinned(sha, `${pluginPath}/.claude-plugin/plugin.json`).version, record.version);
  const lock = readPinned(sha, `${pluginPath}/package-lock.json`);
  assert.deepEqual(Object.keys(lock.packages).sort(), [
    '',
    'node_modules/@speclynx/api-language-server',
  ]);
  assert.equal(
    lock.packages['node_modules/@speclynx/api-language-server'].integrity,
    record.files.npm.integrity,
  );
  return catalog;
}
async function run() {
  assert.equal(process.env.GITHUB_REPOSITORY, publicRepository);
  const record = JSON.parse(readFileSync('release-artifacts/release-record.json'));
  verifyFiles(record, 'release-artifacts', process.env.GITHUB_SHA);
  assert.equal(await registryState(record), 'present-identical');
  const ref = `refs/heads/plugin-releases/v${record.version}`;
  const command = process.argv[2];
  if (command === 'prepare') {
    assert.equal(git(['rev-parse', 'HEAD']), record.sourceSha);
    let payloadSha = remotePayload(ref);
    if (!payloadSha) {
      execFileSync(
        'npm',
        [
          'install',
          '--package-lock-only',
          '--ignore-scripts',
          '--omit=dev',
          '--omit=peer',
          '--no-audit',
          '--no-fund',
        ],
        { cwd: pluginPath, stdio: 'inherit' },
      );
      const tree = withChangedFile(
        record.sourceSha,
        `${pluginPath}/package-lock.json`,
        readFileSync(`${pluginPath}/package-lock.json`),
      );
      payloadSha = commitTree(
        tree,
        record.sourceSha,
        `chore: freeze speclynx-lsp v${record.version}`,
        git(['show', '-s', '--format=%cI', record.sourceSha]),
      );
    }
    validatePayload(payloadSha, record);
    const scan = mkdtempSync(path.join(tmpdir(), 'speclynx-plugin-scan-'));
    try {
      // Scan every payload file, including future additions, without checking it out.
      const entries = git(['ls-tree', '-r', payloadSha, '--', pluginPath]).split('\n');
      const files = entries.map((entry) => {
        const match = /^(100644|100755) blob [a-f0-9]{40}\t(.+)$/.exec(entry);
        assert.ok(match, 'Plugin payload contains an unsupported file type');
        return match[2];
      });
      for (const file of files) {
        assert.ok(file.startsWith(`${pluginPath}/`) && !file.split('/').includes('..'));
        const target = path.join(scan, file);
        mkdirSync(path.dirname(target), { recursive: true });
        const bytes = execFileSync('git', ['show', `${payloadSha}:${file}`], {
          maxBuffer: 100 * 1024 * 1024,
        });
        writeFileSync(target, bytes);
      }
      writeFileSync(
        path.join(scan, 'commit-metadata.txt'),
        git(['cat-file', 'commit', payloadSha]),
      );
      execFileSync('bash', ['scripts/scan-release-artifacts.sh', scan], { stdio: 'inherit' });
    } finally {
      rmSync(scan, { recursive: true, force: true });
    }
    writeFileSync(
      'release-artifacts/plugin-payload.json',
      `${JSON.stringify({ sourceSha: record.sourceSha, payloadSha, ref, scanned: true }, null, 2)}\n`,
    );
  } else if (command === 'push') {
    const payload = JSON.parse(readFileSync('release-artifacts/plugin-payload.json'));
    assert.equal(payload.sourceSha, record.sourceSha);
    assert.equal(payload.ref, ref);
    assert.equal(payload.scanned, true);
    validatePayload(payload.payloadSha, record);
    const current = remotePayload(ref);
    if (current)
      assert.equal(
        current,
        payload.payloadSha,
        'Immutable payload ref already names different bytes',
      );
    else git(['push', '--porcelain', repositoryUrl, `${payload.payloadSha}:${ref}`]);
    assert.equal(remotePayload(ref), payload.payloadSha);
    appendFileSync(process.env.GITHUB_OUTPUT, `payload_sha=${payload.payloadSha}\n`);
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `Plugin payload: ${payload.payloadSha}\n\nRef: ${ref}\n`,
    );
  } else if (command === 'promote') {
    const payloadSha = process.env.PAYLOAD_SHA;
    assert.equal(remotePayload(ref), payloadSha);
    validatePayload(payloadSha, record);
    assert.match(process.env.RUNTIME_EVIDENCE_SHA256 ?? '', /^[a-f0-9]{64}$/);
    const release = JSON.parse(
      execFileSync('gh', ['api', `/repos/${publicRepository}/releases/tags/v${record.version}`], {
        encoding: 'utf8',
      }),
    );
    const asset = release.assets.find((item) => item.name === 'plugin-runtime-evidence.json');
    assert.ok(asset);
    assert.ok(asset.size < 65536);
    const bytes = execFileSync(
      'gh',
      [
        'api',
        '-H',
        'Accept: application/octet-stream',
        `/repos/${publicRepository}/releases/assets/${asset.id}`,
      ],
      { maxBuffer: 65536 },
    );
    assert.equal(digests(bytes).sha256, process.env.RUNTIME_EVIDENCE_SHA256);
    const evidence = JSON.parse(bytes);
    for (let attempt = 0; attempt < 3; attempt++) {
      git(['fetch', '--no-tags', repositoryUrl, 'main']);
      const main = git(['rev-parse', 'FETCH_HEAD']);
      const catalog = readPinned(main, '.claude-plugin/marketplace.json');
      for (const entry of catalog.plugins.filter((item) => item.name === 'speclynx-lsp')) {
        assert.match(entry.source.sha, /^[a-f0-9]{40}$/);
        git(['fetch', '--no-tags', repositoryUrl, entry.source.sha]);
      }
      const result = promotedCatalog(catalog, record.version, payloadSha, readPinned);
      if (result.action !== 'advance') {
        console.log(`Catalog ${result.action}; unchanged.`);
        return;
      }
      validateRuntimeEvidence(evidence, record, payloadSha, result.previousSha);
      const content = `${JSON.stringify(result.catalog, null, 2)}\n`;
      const tree = withChangedFile(main, '.claude-plugin/marketplace.json', content);
      const commit = commitTree(tree, main, `chore: publish speclynx-lsp v${record.version}`);
      try {
        git(['push', '--porcelain', repositoryUrl, `${commit}:refs/heads/main`]);
        console.log(`Catalog now pins ${payloadSha}`);
        return;
      } catch {
        if (attempt === 2)
          throw new Error('Catalog push failed after bounded retries; no force push attempted');
      }
    }
  } else throw new Error('Unknown plugin release command');
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  run().catch((error) => {
    console.error(
      error instanceof Error && !('stdout' in error)
        ? error.message
        : 'Plugin publication stopped; inspect the exact payload and approval record.',
    );
    process.exitCode = 1;
  });
