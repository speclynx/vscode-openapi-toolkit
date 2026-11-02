import * as assert from 'assert';
import { CancellationToken } from 'vscode-languageclient';
import { configurationMiddleware, restrictToTrust } from '../workspaceTrust';

/**
 * The test host always runs with workspace trust disabled, so the untrusted
 * case is exercised here, on the policy and on the middleware that applies it.
 */
suite('Workspace trust', () => {
  const settings = { validation: { applySpectralValidation: true, semanticLinting: true } };
  const untrusted = { validation: { applySpectralValidation: false, semanticLinting: true } };

  test('an untrusted workspace gets Spectral off, whatever its settings say', () => {
    assert.deepStrictEqual(restrictToTrust(settings, false), untrusted);
    assert.deepStrictEqual(restrictToTrust({}, false), {
      validation: { applySpectralValidation: false },
    });
    assert.strictEqual(restrictToTrust(settings, true), settings);
  });

  test('the server reads the restriction for its own section only, until trust is granted', async () => {
    let trusted = false;
    const middleware = configurationMiddleware(() => trusted);
    const params = { items: [{ section: 'speclynx.openapi' }, { section: 'editor' }] };
    const next = () => [settings, { tabSize: 2 }];

    assert.deepStrictEqual(await middleware(params, CancellationToken.None, next), [
      untrusted,
      { tabSize: 2 },
    ]);
    trusted = true;
    assert.deepStrictEqual(await middleware(params, CancellationToken.None, next), [
      settings,
      { tabSize: 2 },
    ]);
  });
});
