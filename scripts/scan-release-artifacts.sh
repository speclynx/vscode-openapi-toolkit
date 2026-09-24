#!/usr/bin/env bash
set -euo pipefail
umask 077
source_dir="${1:?Pass the directory of explicit release deliverables or plugin files}"
scan_tools="$(mktemp -d "${RUNNER_TEMP:-/tmp}/speclynx-scan-tools.XXXXXX")"
scan_evidence="$(mktemp -d "${RUNNER_TEMP:-/tmp}/speclynx-scan-evidence.XXXXXX")"
trap 'rm -rf "$scan_tools"' EXIT
# Fetch the pinned tool only; a mutable checksum URL cannot authorize different bytes.
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
  'https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz' \
  --output "$scan_tools/gitleaks_8.30.1_linux_x64.tar.gz"
cp config/gitleaks-linux-x64.sha256 "$scan_tools/checksums.txt"
(cd "$scan_tools" && sha256sum --check checksums.txt > /dev/null)
tar -xzf "$scan_tools/gitleaks_8.30.1_linux_x64.tar.gz" -C "$scan_tools" gitleaks
[[ "$("$scan_tools/gitleaks" version)" == '8.30.1' ]]
python3 scripts/expand-scan-input.py "$source_dir" "$scan_evidence/expanded" "$scan_evidence/coverage.json"
python3 scripts/run-secret-scan.py "$scan_tools/gitleaks" "$scan_evidence/expanded" \
  "$scan_evidence/coverage.json" "$scan_evidence" config/secret-scan-dispositions.json
# Reports and extracted files intentionally never become workflow artifacts.
echo 'Pinned secret scan passed. Confidentiality and binary-media review remain separate release gates.'
