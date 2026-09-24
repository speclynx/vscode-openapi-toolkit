import * as assert from 'node:assert';
import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * The script that puts a locally built server where the plugin looks for one.
 * npm is a `.cmd` shim on Windows and cannot be spawned there without a shell,
 * and a shell command line is text: a path inside it splits on spaces and
 * executes on metacharacters. The script therefore hands npm no paths at all,
 * and this drives it through a shell — on every platform, through the same
 * switch Windows takes — with a plugin directory whose name would break it both
 * ways if a path ever reached one again.
 */
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const PLUGIN_ROOT = path.join(REPO_ROOT, 'plugins/speclynx-lsp');
const SCRIPT = path.join(REPO_ROOT, 'scripts/install-plugin-server.mjs');

/** `;` separates commands in a POSIX shell, `&` in cmd.exe, and both are legal in a directory name. */
const HOSTILE_DIRECTORY = 'plugin dir; touch INJECTED & mkdir INJECTED';
const INJECTED = 'INJECTED';

describe('Development install of the plugin server', function () {
  this.timeout(600000);

  let parent: string;
  let pluginDir: string;
  let install: child_process.SpawnSyncReturns<string>;

  before(function () {
    assert.ok(process.env.SPECLYNX_SERVER_TARBALL, 'tests require the retained server archive');
    parent = fs.mkdtempSync(path.join(os.tmpdir(), 'speclynx-plugin-'));
    pluginDir = path.join(parent, HOSTILE_DIRECTORY);
    fs.mkdirSync(pluginDir);
    for (const file of ['package.json', '.lsp.json']) {
      fs.copyFileSync(path.join(PLUGIN_ROOT, file), path.join(pluginDir, file));
    }

    install = child_process.spawnSync(
      process.execPath,
      [SCRIPT, '--tarball', process.env.SPECLYNX_SERVER_TARBALL, '--plugin-dir', pluginDir],
      {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        env: { ...process.env, SPECLYNX_INSTALL_THROUGH_SHELL: '1' },
      },
    );
  });

  after(function () {
    fs.rmSync(parent, { recursive: true, force: true });
    fs.rmSync(path.join(REPO_ROOT, INJECTED), { recursive: true, force: true });
  });

  it('installs the server at the path the plugin launches', function () {
    assert.strictEqual(install.status, 0, install.stderr);

    const lspConfig = JSON.parse(
      fs.readFileSync(path.join(pluginDir, '.lsp.json'), 'utf-8'),
    ) as Record<string, { args: string[] }>;
    const launched = lspConfig['speclynx-lsp'].args[0].replace('${CLAUDE_PLUGIN_ROOT}', pluginDir);

    assert.ok(
      fs.existsSync(launched),
      `the script must install what .lsp.json launches, and ${launched} is not there:\n${install.stdout}`,
    );
  });

  it('uses the renamed default plugin directory when none is passed', function () {
    const result = child_process.spawnSync(
      process.execPath,
      [SCRIPT, '--tarball', process.env.SPECLYNX_SERVER_TARBALL!],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      },
    );
    assert.strictEqual(result.status, 0, result.stderr);
    assert.ok(
      fs.existsSync(
        path.join(PLUGIN_ROOT, 'node_modules/@speclynx/api-language-server/dist/node/cli.js'),
      ),
    );
  });

  it('leaves a path the shell would have split or executed alone', function () {
    for (const directory of [REPO_ROOT, parent, pluginDir]) {
      assert.ok(
        !fs.existsSync(path.join(directory, INJECTED)),
        `the plugin directory's name was interpreted as a command in ${directory}`,
      );
    }
  });
});
