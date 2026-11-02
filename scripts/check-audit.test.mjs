import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXCEPTIONS_FILE, auditAdvisories, checkAudit } from './check-audit.mjs';
import { readJson } from './versions.mjs';

const advisory = (name, severity, id) => ({
  name,
  severity,
  title: `${name} advisory`,
  url: `https://github.com/advisories/${id}`,
});
const report = {
  vulnerabilities: {
    minimatch: { via: [advisory('minimatch', 'moderate', 'GHSA-aaaa-bbbb-cccc')] },
    eslint: { via: ['minimatch'] },
    notice: { via: [advisory('notice', 'info', 'GHSA-dddd-eeee-ffff')] },
  },
};
const exception = {
  id: 'GHSA-aaaa-bbbb-cccc',
  package: 'minimatch',
  expires: '2027-01-31',
  reason: 'Not reachable from the bundles.',
};

test('advisories are read from the package they were filed against', () => {
  assert.deepEqual(auditAdvisories(report), [
    {
      id: 'GHSA-aaaa-bbbb-cccc',
      package: 'minimatch',
      severity: 'moderate',
      title: 'minimatch advisory',
    },
  ]);
  assert.throws(() => auditAdvisories({ error: { code: 'ENOAUDIT' } }), /no report/);
});

test('only a matching, reasoned and unexpired exception allows an advisory', () => {
  const advisories = auditAdvisories(report);
  assert.deepEqual(checkAudit(advisories, [exception], '2027-01-31'), []);
  assert.match(
    checkAudit(advisories, [], '2026-11-02').join('\n'),
    /GHSA-aaaa-bbbb-cccc minimatch/,
  );
  assert.match(checkAudit(advisories, [exception], '2027-02-01').join('\n'), /expired/);
  assert.match(
    checkAudit(advisories, [{ ...exception, reason: '' }], '2026-11-02').join('\n'),
    /needs an "expires" date/,
  );
  const stale = checkAudit(
    advisories,
    [exception, { ...exception, package: 'glob' }],
    '2026-11-02',
  );
  assert.deepEqual(stale, [
    'GHSA-aaaa-bbbb-cccc glob: exception no longer matches any advisory; remove it',
  ]);
});

test('the committed exceptions are well formed', () => {
  const { exceptions } = readJson(EXCEPTIONS_FILE);
  const asAdvisories = exceptions.map(({ id, package: name }) => ({ id, package: name }));
  assert.deepEqual(checkAudit(asAdvisories, exceptions, '0000-01-01'), []);
});
