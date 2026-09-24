import type { Metadata } from '@speclynx/api-languageservice';

export const PLUGIN_RULE_CODE = 9000001;
export const PLUGIN_RULE_MESSAGE = 'title must not be a placeholder';
export const PLACEHOLDER_TITLE = 'Placeholder Title';

/**
 * A rule that the built-in OpenAPI metadata does not contain, backed by a
 * linter function that only a plugin can provide.  A diagnostic carrying this
 * code proves both halves of the plugin were merged into the language service.
 */
export function pluginMetadata(): Metadata {
  return {
    metadataMaps: {
      openapi: {
        info: {
          lint: [
            {
              code: PLUGIN_RULE_CODE,
              source: 'plugin-test',
              message: PLUGIN_RULE_MESSAGE,
              severity: 1,
              linterFunction: 'pluginTitleIsNotPlaceholder',
              marker: 'value',
              target: 'title',
              data: {},
              targetSpecs: [{ namespace: 'openapi', version: '3.1.0' }],
            },
          ],
        },
      },
    },
    linterFunctions: {
      openapi: {
        pluginTitleIsNotPlaceholder: (element: unknown): boolean => {
          const title = (element as { toValue?: () => unknown } | undefined)?.toValue?.();
          return title !== PLACEHOLDER_TITLE;
        },
      },
    },
    symbols: [],
    tokens: [],
  };
}
