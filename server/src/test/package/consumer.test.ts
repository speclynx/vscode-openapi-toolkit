import * as assert from 'node:assert';
import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { LspTestClient } from '../standalone/lspTestClient';

/**
 * The package ships one bundled file and no runtime dependencies, which makes
 * installing it cheap but leaves a question the sources cannot answer: does what
 * is published actually resolve for someone who installs it? This installs the
 * retained tarball into a project of its own, and compiles
 * against the advertised exports with `skipLibCheck` off, so a declaration that
 * reaches a module the manifest does not declare fails here rather than in
 * someone's editor.
 */
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const TYPESCRIPT = path.join(REPO_ROOT, 'node_modules/typescript/bin/tsc');

interface Manifest {
  name: string;
  version: string;
  peerDependencies: Record<string, string>;
}

const serverManifest = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'server/package.json'), 'utf-8'),
) as Manifest;

const TARBALL = 'speclynx-api-language-server.tgz';

/**
 * npm is a .cmd shim on Windows and cannot be spawned without a shell, whose
 * command line is text that splits on spaces and executes on metacharacters.
 * So npm is never given a path: directories reach it as its working directory,
 * the tarball travels between them as a file copy, and every argument is a
 * literal written below.
 */
function runNpm(args: string[], cwd: string): child_process.SpawnSyncReturns<string> {
  return child_process.spawnSync('npm', args, {
    cwd,
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });
}

/** Node is an executable everywhere, so it is spawned with no shell at all. */
function runNode(args: string[], cwd: string): child_process.SpawnSyncReturns<string> {
  return child_process.spawnSync(process.execPath, args, { cwd, encoding: 'utf-8' });
}

describe('Published package', function () {
  this.timeout(300000);

  let consumer: string;

  before(function () {
    consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'speclynx-consumer-'));
    fs.writeFileSync(
      path.join(consumer, 'package.json'),
      JSON.stringify({ name: 'consumer', version: '1.0.0', private: true }),
    );

    const archive = process.env.SPECLYNX_SERVER_TARBALL;
    assert.ok(archive && path.isAbsolute(archive), 'tests require the retained server archive');
    fs.copyFileSync(archive, path.join(consumer, TARBALL));

    const installed = runNpm(
      ['install', '--no-audit', '--no-fund', '--ignore-scripts', '--omit=peer', `./${TARBALL}`],
      consumer,
    );
    assert.strictEqual(installed.status, 0, installed.stderr);
  });

  after(function () {
    fs.rmSync(consumer, { recursive: true, force: true });
  });

  it('installs as a single package with nothing behind it', function () {
    const installedRoot = path.join(consumer, 'node_modules', serverManifest.name);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(installedRoot, 'package.json'), 'utf-8'),
    ) as { dependencies?: Record<string, string> };

    assert.strictEqual(
      manifest.dependencies,
      undefined,
      'a published dependency would be installed into every consumer',
    );
    assert.ok(
      fs.existsSync(path.join(installedRoot, 'dist/node/THIRD-PARTY-NOTICES.txt')),
      'the licences of the bundled code must ship with it',
    );
  });

  it('carries the notice of everything bundled into it', function () {
    // The shortest real licence among the bundled packages runs to about 550
    // characters; naming a licence instead of reproducing it took about 200. A
    // block too short to be a licence is the shape of that regression, whatever
    // wording it comes back in.
    const notices = fs.readFileSync(
      path.join(consumer, 'node_modules', serverManifest.name, 'dist/node/THIRD-PARTY-NOTICES.txt'),
      'utf-8',
    );
    const blocks = notices.split(`${'-'.repeat(78)}\n`);
    const entries = [];
    for (let index = 1; index < blocks.length - 1; index += 2) {
      entries.push({ package: blocks[index].trim(), notice: blocks[index + 1].trim() });
    }

    assert.ok(entries.length > 100, `expected the bundled packages, got ${entries.length}`);
    const withoutNotice = entries.filter((entry) => entry.notice.length < 400);
    assert.deepStrictEqual(
      withoutNotice.map((entry) => entry.package),
      [],
      'every bundled package must carry the notice it is redistributed under',
    );

    // The four that publish no licence file of their own, by the copyright each
    // notice exists to carry.
    for (const holder of [
      'Copyright (c) 2013 Nathan Rajlich',
      'Copyright (c) Sebastian Mayr',
      'Copyright 2018 Stoplight, Inc.',
    ]) {
      assert.ok(notices.includes(holder), `the notices must name ${holder}`);
    }
  });

  it('loads both runtime exports without workspace peer links', function () {
    const result = runNode(
      [
        '-e',
        `
      (async () => { for (const name of ['${serverManifest.name}', '${serverManifest.name}/node']) {
        const api = require(name);
        if (typeof api.startServer !== 'function' || typeof api.runCli !== 'function') process.exit(1);
        const runtime = new api.NodeServerRuntime();
        if (!(await runtime.readFile('package.json')).includes('consumer')) process.exit(1);
      } })().catch(() => process.exit(1));
    `,
      ],
      consumer,
    );
    assert.strictEqual(result.status, 0, result.stderr);
    for (const peer of Object.keys(serverManifest.peerDependencies)) {
      assert.ok(
        !fs.existsSync(path.join(consumer, 'node_modules', peer)),
        'runtime must work without optional peers',
      );
    }
  });

  it('runs the installed CLI and returns diagnostics over stdio', async function () {
    const installed = path.join(consumer, 'node_modules', serverManifest.name);
    const manifest = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8')) as {
      bin: Record<string, string>;
    };
    const client = new LspTestClient({
      serverPath: path.join(installed, manifest.bin['speclynx-lsp']),
      workspaceDir: consumer,
    });
    try {
      const result = await client.initialize();
      assert.strictEqual(result.capabilities.hoverProvider, true);
      const uri = client.openDocument(
        'openapi.yaml',
        'openapi: 3.1.0\ninfo:\n  title: Missing Version\npaths: {}\n',
      );
      const diagnostics = await client.waitForDiagnostics(uri, (items) => items.length > 0);
      assert.ok(diagnostics.length > 0);
      await client.request('shutdown', null);
      client.notify('exit', null);
    } finally {
      client.stop();
    }
  });

  it('type checks against the exports with the declared peer packages installed', function () {
    const typesConsumer = path.join(consumer, 'types-consumer');
    fs.mkdirSync(typesConsumer);
    fs.copyFileSync(path.join(consumer, TARBALL), path.join(typesConsumer, TARBALL));
    fs.writeFileSync(
      path.join(typesConsumer, 'package.json'),
      JSON.stringify({
        name: 'types-consumer',
        version: '1.0.0',
        private: true,
        dependencies: {
          ...serverManifest.peerDependencies,
          [serverManifest.name]: `file:./${TARBALL}`,
        },
      }),
    );
    const installed = runNpm(
      ['install', '--ignore-scripts', '--no-audit', '--no-fund'],
      typesConsumer,
    );
    assert.strictEqual(installed.status, 0, installed.stderr);
    fs.writeFileSync(
      path.join(typesConsumer, 'index.ts'),
      [
        `import { startServer, NodeServerRuntime, runCli } from '${serverManifest.name}';`,
        `import type { ServerRuntime, MetadataPlugin } from '${serverManifest.name}';`,
        'export { startServer, NodeServerRuntime, runCli };',
        'export type { ServerRuntime, MetadataPlugin };',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(typesConsumer, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          module: 'node16',
          moduleResolution: 'node16',
          target: 'ES2022',
          strict: true,
          // Off on purpose: a declaration that reaches a module the manifest
          // does not declare is exactly what this test is looking for.
          skipLibCheck: false,
          noEmit: true,
        },
      }),
    );

    const compiled = runNode([TYPESCRIPT, '-p', '.'], typesConsumer);

    assert.strictEqual(compiled.status, 0, `the published types must resolve:\n${compiled.stdout}`);
  });
});
