import * as assert from 'node:assert';
import { plainDiagnostic } from '../speclynxServer/diagnostics';

describe('Language service diagnostic compatibility', function () {
  const range = { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } };

  it('converts markup messages to strings for LSP 3.17 clients without changing metadata', function () {
    const diagnostic = {
      range,
      message: { kind: 'markdown', value: 'Missing **version**' },
      code: 42,
      source: 'schema',
      data: { fix: true },
    };
    assert.deepStrictEqual(plainDiagnostic(diagnostic), {
      ...diagnostic,
      message: 'Missing **version**',
    });
    assert.strictEqual(typeof diagnostic.message, 'object');
  });

  it('preserves plain messages', function () {
    const diagnostic = { range, message: 'Missing version' };
    assert.deepStrictEqual(plainDiagnostic(diagnostic), diagnostic);
  });
});
