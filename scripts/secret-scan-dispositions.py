"""Match reviewed non-secret findings by exact input bytes and detector location."""
import hashlib
import re
from pathlib import Path


def finding_key(finding, content_sha256):
    return (content_sha256, finding['RuleID'], finding['StartLine'],
            finding['EndLine'], finding['StartColumn'], finding['EndColumn'],
            hashlib.sha256(finding['Match'].encode()).hexdigest(),
            tuple(sorted(finding.get('Tags', []))))


def reviewed_keys(manifest, config_sha256):
    if manifest.get('schemaVersion') != 1 or manifest.get('configSha256') != config_sha256:
        raise ValueError('Disposition schema/configuration mismatch')
    keys = set()
    for entry in manifest['findings']:
        if entry.get('decision') != 'non-secret' or not entry.get('reviewer') or not entry.get('reason'):
            raise ValueError('A disposition lacks an explicit non-secret review')
        for field in ('contentSha256', 'redactedMatchSha256'):
            if not re.fullmatch('[a-f0-9]{64}', entry[field]):
                raise ValueError('Invalid disposition digest')
        position = tuple(entry[field] for field in ('startLine', 'endLine', 'startColumn', 'endColumn'))
        if not all(type(value) is int and value >= 0 for value in position):
            raise ValueError('Invalid disposition position')
        key = (entry['contentSha256'], entry['ruleId'], *position,
               entry['redactedMatchSha256'], tuple(sorted(entry.get('tags', []))))
        if key in keys:
            raise ValueError('Duplicate disposition')
        keys.add(key)
    return keys


def partition_findings(findings, source, members, manifest, config_sha256):
    reviewed = reviewed_keys(manifest, config_sha256)
    projections = {}
    for member in members:
        for field in ('pathProjection', 'contentProjection'):
            if field in member:
                projections[str((source / member[field]).resolve())] = member['sha256']
    accepted, unresolved, verified = [], [], set()
    for finding in findings:
        location = str(Path(finding['File']).resolve())
        digest = projections.get(location)
        # Coverage hashes alone cannot authorize changed scan input.
        if digest is not None and location not in verified:
            data = Path(location).read_bytes()
            prefix = b'Publication raw-byte scan projection; original bytes follow.\n'
            if not data.startswith(prefix) or hashlib.sha256(data[len(prefix):]).hexdigest() != digest:
                raise ValueError('Disposition input bytes differ from coverage')
            verified.add(location)
        target = accepted if digest and finding_key(finding, digest) in reviewed else unresolved
        target.append(finding)
    return accepted, unresolved
