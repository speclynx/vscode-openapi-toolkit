#!/usr/bin/env node
// Runs `npm audit` and fails on every advisory that a reviewed, unexpired entry
// in config/audit-exceptions.json does not cover. An entry that no longer matches
// any advisory fails too, so the list cannot outlive what it was written for.
//
//   node scripts/check-audit.mjs

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { repoRoot, readJson } from './versions.mjs';

export const EXCEPTIONS_FILE = 'config/audit-exceptions.json';

/**
 * The advisories behind an `npm audit --json` report, keyed by the package they
 * were filed against. Packages flagged only for depending on one are left out:
 * the advisory itself is what an exception reviews. `info` is ignored, as
 * `--audit-level=low` does.
 */
export function auditAdvisories(report) {
  if (!report.vulnerabilities) {
    throw new Error(`npm audit returned no report: ${JSON.stringify(report.error ?? report)}`);
  }
  const advisories = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities)) {
    for (const cause of vulnerability.via) {
      if (typeof cause !== 'object' || cause.severity === 'info') continue;
      const id = cause.url.split('/').pop();
      advisories.set(`${id} ${cause.name}`, {
        id,
        package: cause.name,
        severity: cause.severity,
        title: cause.title,
      });
    }
  }
  return [...advisories.values()];
}

/** Every reason the audit must fail; empty when it passes. */
export function checkAudit(advisories, exceptions, today) {
  const covers = (exception, advisory) =>
    exception.id === advisory.id && exception.package === advisory.package;
  const problems = [];
  for (const exception of exceptions) {
    const label = `${exception.id} ${exception.package}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.expires ?? '') || !exception.reason) {
      problems.push(`${label}: an exception needs an "expires" date (YYYY-MM-DD) and a "reason"`);
    } else if (exception.expires < today) {
      problems.push(`${label}: exception expired on ${exception.expires}; review it again`);
    }
    if (!advisories.some((advisory) => covers(exception, advisory))) {
      problems.push(`${label}: exception no longer matches any advisory; remove it`);
    }
  }
  for (const advisory of advisories) {
    if (!exceptions.some((exception) => covers(exception, advisory))) {
      problems.push(`${advisory.id} ${advisory.package} (${advisory.severity}): ${advisory.title}`);
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    // `npm audit` exits non-zero whenever it finds anything; the report is what counts.
    const audit = spawnSync('npm', ['audit', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const advisories = auditAdvisories(JSON.parse(audit.stdout));
    const { exceptions } = readJson(EXCEPTIONS_FILE);
    const problems = checkAudit(advisories, exceptions, new Date().toISOString().slice(0, 10));
    for (const exception of exceptions) {
      console.log(`allowed until ${exception.expires}: ${exception.id} ${exception.package}`);
    }
    if (problems.length > 0) {
      console.error('dependency audit failed:');
      for (const problem of problems) console.error(`  ${problem}`);
      console.error(`\nupdate the dependency, or review the advisory in ${EXCEPTIONS_FILE}`);
      process.exitCode = 1;
    } else {
      console.log(`${advisories.length} advisories, all covered by reviewed exceptions`);
    }
  } catch (error) {
    console.error(`dependency audit could not run: ${error.message}`);
    process.exitCode = 1;
  }
}
