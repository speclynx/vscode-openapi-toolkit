import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const { checkLicense } = createRequire(import.meta.url)('../config/webpack-attribution.cjs');

test('license policy checks compound expressions and unknown terms', () => {
  for (const license of ['MIT', 'Apache-2.0', '(MIT OR BSD-3-Clause)', 'MPL-2.0']) {
    assert.doesNotThrow(() => checkLicense(license));
  }
  for (const license of [
    'MIT AND GPL-3.0-only',
    '(MIT OR AGPL-3.0-only)',
    'LicenseRef-Unknown',
    'unknown',
    null,
  ]) {
    assert.throws(() => checkLicense(license));
  }
});
