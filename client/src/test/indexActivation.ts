import * as path from 'path';
import { runMocha } from './mochaRunner';

/**
 * The activation suite alone.  It asserts that the extension is not running
 * before the document is opened, which only holds in a host where no other
 * suite has called `activate` on it first.
 */
export function run(): Promise<void> {
  return runMocha([path.resolve(__dirname, 'activation.test.js')]);
}
