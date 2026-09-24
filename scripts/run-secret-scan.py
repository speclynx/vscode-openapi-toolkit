#!/usr/bin/env python3
"""Run pinned Gitleaks with fail-closed file coverage and redacted evidence only."""
import hashlib, importlib.util, json, os, re, subprocess, sys
from pathlib import Path
os.umask(0o077)
binary, source, coverage, evidence = map(Path, sys.argv[1:5])
dispositions = Path(sys.argv[5]) if len(sys.argv) == 6 else None
if len(sys.argv) not in (5, 6):
    sys.exit('Pass scanner, source, coverage, evidence and optional reviewed dispositions.')
evidence.mkdir(parents=True, exist_ok=True)
ignore = evidence / 'empty-ignore'
ignore.write_text('')
report = evidence / 'findings.json'
command = [str(binary), 'dir', str(source), '--config', 'config/gitleaks.toml',
           '--gitleaks-ignore-path', str(ignore), '--ignore-gitleaks-allow',
           '--redact=100', '--max-decode-depth=10', '--max-target-megabytes=0',
           '--log-level', 'trace', '--no-banner', '--no-color',
           '--report-format', 'json', '--report-path', str(report)]
seen, events = set(), []
process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                           text=True, errors='replace')
# Decoder/debug messages can expose source despite --redact. Never retain them.
for line in process.stdout:
    match = re.search(r'path=(.*)', line)
    path = match[1].strip().strip('"') if match else None
    if 'scanning path' in line and path:
        seen.add(path)
    elif 'skipping finding:' in line or 'skipping duplicate finding' in line or 'skipping generic-api-key finding' in line:
        continue  # Detector entropy thresholds are not skipped files.
    elif 'skipping' in line or ' ERR ' in line:
        events.append({'path': path, 'archiveNameMisclassification':
                       'skipping archive: exceeds max archive depth' in line})
status = process.wait()
expected = {str(file) for file in source.rglob('*') if file.is_file()}
members = json.loads(coverage.read_text())['members']
projections = {str(source / m['pathProjection']): str(source / m['contentProjection'])
               for m in members if 'pathProjection' in m}
uncovered = [e for e in events if not e['archiveNameMisclassification'] or
             projections.get(e['path']) not in seen]
result = {'configSha256': hashlib.sha256(Path('config/gitleaks.toml').read_bytes()).hexdigest(),
          'expectedFiles': len(expected), 'visitedFiles': len(seen),
          'notVisited': sorted(expected - seen), 'uncoveredEvents': uncovered,
          'filenameMisclassificationsCovered': len(events) - len(uncovered), 'scannerStatus': status}
(evidence / 'scanner-coverage.json').write_text(json.dumps(result, indent=2) + '\n')
if status not in (0, 1) or expected - seen or uncovered or not report.exists():
    sys.exit('Secret scan coverage failed; inspect private evidence. Nothing was cleared.')
findings = json.loads(report.read_text())
if not all(item['Secret'] == 'REDACTED' for item in findings):
    report.unlink()  # Never retain an unexpectedly unredacted report.
    sys.exit('Scanner report redaction failed. Nothing was cleared.')
unresolved = findings
if dispositions:
    try:
        spec = importlib.util.spec_from_file_location('dispositions', Path(__file__).with_name('secret-scan-dispositions.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        accepted, unresolved = module.partition_findings(findings, source, members,
            json.loads(dispositions.read_text()), result['configSha256'])
        (evidence / 'disposition-summary.json').write_text(json.dumps({
            'manifestSha256': hashlib.sha256(dispositions.read_bytes()).hexdigest(),
            'reviewedNonSecretOccurrences': len(accepted),
            'unresolvedOccurrences': len(unresolved),
        }, indent=2) + '\n')
    except Exception:
        sys.exit('Invalid reviewed dispositions; nothing was cleared.')
if unresolved or (status == 1 and not findings):
    sys.exit('Secret candidates require private review; nothing was cleared.')
print(f'Secret scan passed with complete content coverage for {len(expected)} projections.')
