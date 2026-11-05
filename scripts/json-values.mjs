// In-place JSON edits for release:version, which runs after `npm ci`. Kept apart
// from versions.mjs, which jobs without installed dependencies import.
import { applyEdits, modify } from 'jsonc-parser';

/** Set each JSON path in `text` to `value`, leaving every other byte as written. */
export function setJsonValues(text, jsonPaths, value) {
  const formattingOptions = { insertSpaces: true, tabSize: 2 };
  return jsonPaths.reduce(
    (current, jsonPath) =>
      applyEdits(current, modify(current, jsonPath, value, { formattingOptions })),
    text,
  );
}
