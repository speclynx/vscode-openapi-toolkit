import { ResponseError } from 'vscode-languageclient';
import type { ConfigurationRequest } from 'vscode-languageclient';

export const CONFIGURATION_SECTION = 'speclynx.openapi';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Spectral runs a ruleset rather than reading it: the bundler inlines a
 * ruleset's custom functions and the language server evaluates them. A ruleset
 * can come from the workspace itself, found as a `.spectral.*` file or named in
 * its settings, so a workspace the user has not trusted gets Spectral off
 * whatever its settings say.
 */
export function restrictToTrust(settings: unknown, isTrusted: boolean): unknown {
  if (isTrusted || !isObject(settings)) return settings;
  return {
    ...settings,
    validation: {
      ...(isObject(settings.validation) ? settings.validation : {}),
      applySpectralValidation: false,
    },
  };
}

/**
 * Applies `restrictToTrust` to every `workspace/configuration` answer for the
 * extension's own section, which is how the server reads its settings on start
 * and after every configuration change.
 */
export function configurationMiddleware(
  isTrusted: () => boolean,
): ConfigurationRequest.MiddlewareSignature {
  return async (params, token, next) => {
    const result = await next(params, token);
    if (result instanceof ResponseError) return result;
    return (result as unknown[]).map((settings, index) =>
      params.items[index]?.section === CONFIGURATION_SECTION
        ? restrictToTrust(settings, isTrusted())
        : settings,
    );
  };
}
