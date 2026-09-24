import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath: path.resolve(__dirname, './index'),
    });

    // A second host for the activation suite: it can only prove that opening a
    // contributed filename starts the extension if nothing has started it yet.
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath: path.resolve(__dirname, './indexActivation'),
    });
  } catch {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

void main();
