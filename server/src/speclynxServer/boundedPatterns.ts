import { isSafePattern } from 'redos-detector';
import type { LinterMeta } from '@speclynx/api-languageservice' with {
  'resolution-mode': 'import',
};

/**
 * A rules file is whatever the workspace happens to contain, and several linter
 * functions — `apilintValueRegex`, `apilintKeyRegex`, `apilintKeysRegex`,
 * `apilintFieldValueRegex`, `apilintMembersKeysRegex` — take their pattern from
 * the rule as a string and hand it to the regular expression engine. That
 * engine backtracks, so a pattern such as `^(a+)+$` against an input it cannot
 * match takes time exponential in the input's length, on the same thread that
 * answers every other request. A rules file could therefore stop the server
 * dead, and the file is read from a repository before anyone has looked at it.
 *
 * Rules that carry such a pattern are dropped before they reach the language
 * service. Every string a rule passes to a function is checked, rather than
 * only the parameters of the functions known to compile one, because which
 * parameter is a pattern is the called function's business and the check costs
 * a fraction of a millisecond for a string that is not one.
 */

/**
 * The check walks the pattern rather than running it, so it is bounded by
 * construction — but not by much, and a pattern it cannot decide within the
 * budget is refused rather than accepted, since undecidable is the shape a
 * hostile pattern has.
 */
const PATTERN_BUDGET_MS = 250;

function toParameters(params: unknown): unknown[] {
  return Array.isArray(params) ? params : [];
}

function parametersOf(rule: LinterMeta): unknown[] {
  return [
    ...toParameters(rule.linterParams),
    ...(rule.conditions ?? []).flatMap((condition) => toParameters(condition.params)),
    ...(rule.data?.quickFix ?? []).flatMap((quickFix) => toParameters(quickFix.functionParams)),
  ];
}

/**
 * The pattern in a rule that could backtrack without bound, if it has one. A
 * string that is not a valid regular expression has none: the engine would
 * refuse it too.
 */
function unboundedPattern(rule: LinterMeta): string | undefined {
  for (const parameter of parametersOf(rule)) {
    if (typeof parameter !== 'string' || parameter === '') continue;
    try {
      if (!isSafePattern(parameter, { timeout: PATTERN_BUDGET_MS }).safe) {
        return parameter;
      }
    } catch {
      // Not a regular expression at all.
    }
  }
  return undefined;
}

/**
 * The rules that can be evaluated in time bounded by the size of the document,
 * with a line logged for each one left out.
 */
export function rulesWithBoundedPatterns(rules: LinterMeta[]): LinterMeta[] {
  return rules.filter((rule) => {
    const pattern = unboundedPattern(rule);
    if (pattern === undefined) return true;
    console.error(
      `Ignoring the rule ${rule.code ?? rule.name ?? rule.message ?? 'in the rules file'}: the ` +
        `pattern ${pattern} can take time exponential in the length of what it is matched ` +
        'against, which would stop the server answering.',
    );
    return false;
  });
}
