import * as path from 'path';
import * as glob from 'glob';
import { runMocha } from './mochaRunner';

/**
 * Every suite except the activation one, which needs an extension host where
 * nothing has activated the extension yet and therefore runs on its own.
 */
export async function run(): Promise<void> {
  const testsRoot = __dirname;
  const files = await glob.glob('**.test.js', {
    cwd: testsRoot,
    ignore: 'activation.test.js',
  });

  return runMocha(files.map((file) => path.resolve(testsRoot, file)));
}
