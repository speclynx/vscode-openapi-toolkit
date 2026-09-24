import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { releaseSection } from './changelog.mjs';

const today = '2024-03-01';
const section = (heading, body = '- Documented change.') => `${heading}\n\n${body}\n`;
const read = (text, version = '1.6.0') => releaseSection(text, version, { today });

test('release notes use a unique dated section and stop at the next top-level heading', () => {
  const text = `${section('# Unreleased', '- Future work.')}
${section('# 1.6.0 (2024-02-29)', '### Features\n\n- First change.\n- Second change.')}
${section('# Unreleased', '- Do not include this.')}
${section('# 1.0.0 (2020-01-7)', '- Legacy date stays unchanged.')}`;
  assert.deepEqual(read(text.replaceAll('\n', '\r\n')), {
    version: '1.6.0',
    date: '2024-02-29',
    body: '### Features\n\n- First change.\n- Second change.',
  });
});

test('unreleased, duplicate, malformed and empty target sections refuse release', () => {
  for (const text of [
    section('# Unreleased'),
    section('# 1.6.0 (Unreleased)'),
    section('# 1.6.0 (2024-02-29)') + section('# 1.6.0 (2024-02-29)'),
    section('# 1.6.0 (2024-02-29)') + section('# 1.6.0 (Unreleased)'),
    section('# 1.6.0 (2024-02-29) pending'),
    section('# 1.6.0 (2024-02-29)', ''),
    section('# 1.6.0 (2024-02-29)', '<!-- no visible release notes -->'),
  ])
    assert.throws(() => read(text), /CHANGELOG/);
});

test('calendar validation rejects rollover dates and permits real leap days', () => {
  for (const date of [
    '2023-02-29',
    '2024-02-30',
    '2024-04-31',
    '2024-13-01',
    '2024-00-01',
    '2024-01-00',
    '2024-2-29',
  ]) {
    assert.throws(() => read(section(`# 1.6.0 (${date})`)), /calendar date/);
  }
  assert.equal(read(section('# 1.6.0 (2024-02-29)')).date, '2024-02-29');
});

test('UTC date boundary rejects tomorrow but permits today and later retries', () => {
  assert.throws(() => read(section('# 1.6.0 (2024-03-02)')), /future/);
  const text = section('# 1.6.0 (2024-03-01)');
  assert.equal(read(text).date, today);
  assert.equal(releaseSection(text, '1.6.0', { today: '2024-03-12' }).date, today);
  assert.throws(() => releaseSection(text, '1.6.0', { today: 'invalid' }), /UTC date/);
});

test('headings in prose, comments, indented code or fenced examples cannot finalize a release', () => {
  const fake = '# 1.6.0 (2024-02-29)';
  for (const text of [
    `Example: ${fake}\n`,
    `<!--\n${fake}\n-->\n`,
    `    ${fake}\n`,
    `\`\`\`markdown\n${fake}\n\`\`\`\n`,
    `~~~~markdown\n${fake}\n~~~~\n`,
  ])
    assert.throws(() => read(text), /found 0/);
  const text = `${section(fake, `- Real change.\n\n\`\`\`markdown\n${fake}\n\`\`\``)}\n${section('# 1.5.3 (2024-01-01)')}`;
  assert.match(read(text).body, /Real change/);
});

test('version matching is exact, including prereleases and legacy sections', () => {
  assert.throws(() => read(section('# 1.6.01 (2024-02-29)')), /found 0/);
  const text = section('# 1.6.0-rc.1 (2024-02-29)') + section('# 1.0.0 (2020-01-7)');
  assert.equal(read(text, '1.6.0-rc.1').version, '1.6.0-rc.1');
  assert.throws(() => read(text), /found 0/);
});

test('all release entry points reject bad notes before version writes or npm execution', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'changelog-contract-'));
  const scripts = fileURLToPath(new URL('.', import.meta.url));
  try {
    mkdirSync(path.join(directory, 'scripts'));
    for (const name of [
      'versions.mjs',
      'changelog.mjs',
      'check-version-sync.mjs',
      'changelog-section.mjs',
      'sync-version.mjs',
    ]) {
      copyFileSync(path.join(scripts, name), path.join(directory, 'scripts', name));
    }
    const version = '1.6.0';
    const files = [
      'package.json',
      'client/package.json',
      'server/package.json',
      'plugins/speclynx-lsp/package.json',
      'plugins/speclynx-lsp/.claude-plugin/plugin.json',
    ];
    for (const name of files) {
      mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
      writeFileSync(
        path.join(directory, name),
        JSON.stringify({ version, dependencies: { '@speclynx/api-language-server': version } }),
      );
    }
    writeFileSync(
      path.join(directory, 'package-lock.json'),
      JSON.stringify({
        version,
        packages: { '': { version }, client: { version }, server: { version } },
      }),
    );
    const originals = Object.fromEntries(
      [...files, 'package-lock.json'].map((name) => [
        name,
        readFileSync(path.join(directory, name), 'utf8'),
      ]),
    );
    const bin = path.join(directory, 'bin');
    mkdirSync(bin);
    writeFileSync(path.join(bin, 'npm'), '#!/bin/sh\nprintf invoked > npm-was-invoked\nexit 99\n', {
      mode: 0o700,
    });
    const env = {
      ...process.env,
      PATH: bin,
      GITHUB_REF_NAME: `v${version}`,
      npm_config_offline: 'true',
    };
    const run = (...args) =>
      spawnSync(process.execPath, args, { cwd: directory, env, encoding: 'utf8' });
    for (const text of [
      section('# Unreleased'),
      section('# 1.6.0 (Unreleased)'),
      section('# 1.6.0 (2024-02-30)'),
      section('# 1.6.0 (9999-01-01)'),
      section('# 1.6.0 (2024-02-29)') + section('# 1.6.0 (2024-02-29)'),
      section('Example: # 1.6.0 (2024-02-29)'),
      section('# 1.6.0 (2024-02-29)', ''),
    ]) {
      writeFileSync(path.join(directory, 'CHANGELOG.md'), text);
      for (const [script, argument] of [
        ['check-version-sync.mjs', '--tag'],
        ['changelog-section.mjs', version],
        ['sync-version.mjs', version],
      ]) {
        const result = run(`scripts/${script}`, argument);
        assert.equal(result.status, 1, `${script}: ${result.stderr}`);
        assert.match(result.stderr, /CHANGELOG/);
      }
      for (const [name, contents] of Object.entries(originals))
        assert.equal(readFileSync(path.join(directory, name), 'utf8'), contents);
      assert.equal(existsSync(path.join(directory, 'npm-was-invoked')), false);
    }
    writeFileSync(
      path.join(directory, 'CHANGELOG.md'),
      section('# 1.6.0 (2024-02-29)', '- Verified notes.'),
    );
    assert.equal(run('scripts/check-version-sync.mjs', '--tag').status, 0);
    assert.equal(run('scripts/changelog-section.mjs', version).stdout, '- Verified notes.\n');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
