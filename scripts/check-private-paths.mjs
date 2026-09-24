#!/usr/bin/env node
// This tracked-file check complements the separate full-history publication review.
// Ignore rules cannot prevent a forced add. Never print rejected file contents.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function isPrivatePath(file) {
  return (
    /\.iml$/i.test(file) ||
    /(^|\/)(?:\.ftlocal|\.codex|\.idea)(?:\/|$)/.test(file) ||
    /(^|\/)docs\/changelog\/(?:01-lsp-server|02-release-automation|03-public-repo)(?:\/|$)/.test(
      file,
    )
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let files;
  try {
    files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0');
  } catch {
    console.error('Publication guard could not read the Git index; failing closed.');
    process.exit(1);
  }
  const rejected = files.filter(isPrivatePath);
  if (rejected.length) {
    console.error(
      `Publication guard rejected ${rejected.length} tracked private path(s). Inspect the Git index locally.`,
    );
    process.exitCode = 1;
  } else {
    console.log('No private working-record paths are tracked.');
  }
}
