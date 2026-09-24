#!/usr/bin/env python3
"""Expand publication archives without executing them; fail on incomplete coverage."""
import hashlib, io, json, os, re, stat, sys, tarfile, zipfile
from pathlib import Path, PurePosixPath

MAX_FILE = 100 * 1024 * 1024
MAX_TOTAL = 2 * 1024 * 1024 * 1024
MAX_MEMBERS = 250000
MAX_DEPTH = 5

def private_path(name):
    parts = PurePosixPath(name).parts
    if name.lower().endswith('.iml'): return True
    return any(p in ('.ftlocal', '.codex', '.git', '.idea') for p in parts) or \
        re.search(r'(^|/)docs/changelog/(01-lsp-server|02-release-automation|03-public-repo)(/|$)', name) is not None or \
        any(p == '.env' or p.startswith('.env.') or p in ('id_rsa', 'id_ed25519') for p in parts)

def safe_name(name):
    p = PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or '\\' in name or re.match(r'^[A-Za-z]:', name) or any(ord(c) < 32 for c in name):
        raise ValueError('Unsafe archive member path')
    if private_path(name): raise ValueError('Private record or credential-file path in scan input')

class Expander:
    def __init__(self, destination):
        self.destination = destination
        self.total = 0
        self.members = []
    def record(self, name, data, depth):
        safe_name(name)
        if len(data) > MAX_FILE: raise ValueError('Member exceeds reviewed per-file scan limit')
        self.total += len(data)
        if self.total > MAX_TOTAL or len(self.members) >= MAX_MEMBERS: raise ValueError('Scan input exceeds reviewed coverage limits')
        digest = hashlib.sha256(data).hexdigest()
        member = {'path': name, 'sha256': digest, 'bytes': len(data), 'depth': depth}
        self.members.append(member)
        return member

    def project(self, member, name, data):
        # An ASCII prefix prevents MIME-based skips without discarding any bytes.
        # Retain original paths and a content-addressed fallback for filenames
        # the pinned scanner mistakes for compressed files (e.g. .browser.js).
        body = b'Publication raw-byte scan projection; original bytes follow.\n' + data
        target = self.destination / name
        if target.exists() and target.read_bytes() != body:
            target = self.destination / 'duplicate-members' / member['sha256'] / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        content_path = self.destination / 'scan-content-by-sha256' / (member['sha256'] + '.txt')
        content_path.parent.mkdir(parents=True, exist_ok=True)
        if not content_path.exists(): content_path.write_bytes(body)
        member['pathProjection'] = str(target.relative_to(self.destination))
        member['contentProjection'] = str(content_path.relative_to(self.destination))

    def add(self, name, data, depth=0):
        member = self.record(name, data, depth)
        archive = None
        if zipfile.is_zipfile(io.BytesIO(data)): archive = 'zip'
        else:
            try:
                with tarfile.open(fileobj=io.BytesIO(data)): archive = 'tar'
            except (tarfile.TarError, EOFError, OSError): pass
        if archive:
            if depth >= MAX_DEPTH: raise ValueError('Archive nesting exceeds reviewed limit')
            # Extraction alone loses preambles, trailers and unused header data.
            # Project the complete original container as well as its members.
            self.project(member, name + '/__archive-container-bytes__', data)
            if archive == 'zip':
                with zipfile.ZipFile(io.BytesIO(data)) as opened:
                    metadata = []
                    if opened.comment: self.add(name + '/archive-comment', opened.comment, depth + 1)
                    for entry in opened.infolist():
                        safe_name(entry.filename)
                        if entry.flag_bits & 1: raise ValueError('Encrypted ZIP member cannot be cleared')
                        mode = entry.external_attr >> 16
                        if stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR): raise ValueError('Nonregular ZIP member cannot be cleared')
                        metadata.append({'name': entry.filename, 'dateTime': entry.date_time,
                                         'mode': mode, 'flags': entry.flag_bits, 'bytes': entry.file_size})
                        if entry.comment: self.add(name + '/' + entry.filename + '-comment', entry.comment, depth + 1)
                        if entry.extra: self.add(name + '/' + entry.filename + '-extra', entry.extra, depth + 1)
                        if entry.is_dir(): continue
                        if entry.file_size > MAX_FILE: raise ValueError('ZIP member exceeds scan limit')
                        self.add(name + '/' + entry.filename, opened.read(entry), depth + 1)
                    self.add(name + '/__archive-metadata__.json', json.dumps(metadata).encode(), depth + 1)
            else:
                with tarfile.open(fileobj=io.BytesIO(data)) as opened:
                    # A compressed TAR can hide data after its end-of-archive
                    # marker. Read the whole decoded stream with a strict bound,
                    # without recursively treating this scan projection as a TAR.
                    opened.fileobj.seek(0)
                    decoded = opened.fileobj.read(MAX_FILE + 1)
                    if len(decoded) > MAX_FILE: raise ValueError('Decoded TAR container exceeds scan limit')
                    if decoded != data:
                        decoded_name = name + '/__decoded-tar-bytes__'
                        decoded_member = self.record(decoded_name, decoded, depth + 1)
                        self.project(decoded_member, decoded_name, decoded)
                    metadata = []
                    for entry in opened:
                        safe_name(entry.name)
                        metadata.append({'name': entry.name, 'type': entry.type.decode('ascii'),
                                         'mode': entry.mode, 'uid': entry.uid, 'gid': entry.gid,
                                         'uname': entry.uname, 'gname': entry.gname, 'mtime': entry.mtime,
                                         'linkname': entry.linkname, 'bytes': entry.size})
                        if entry.pax_headers: self.add(name + '/' + entry.name + '-pax', json.dumps(entry.pax_headers).encode(), depth + 1)
                        if entry.isdir(): continue
                        if not entry.isfile(): raise ValueError('Nonregular TAR member cannot be cleared')
                        if entry.size > MAX_FILE: raise ValueError('TAR member exceeds scan limit')
                        self.add(name + '/' + entry.name, opened.extractfile(entry).read(), depth + 1)
                    self.add(name + '/__archive-metadata__.json', json.dumps(metadata).encode(), depth + 1)
        else:
            # Unknown/corrupt compressed formats cannot silently pass as opaque binaries.
            if data.startswith((b'PK\x03\x04', b'\x1f\x8b', b'BZh', b'\xfd7zXZ', b'7z\xbc\xaf\x27\x1c', b'Rar!')):
                raise ValueError('Unsupported or unreadable compressed member')
            self.project(member, name, data)


def expand(source, destination):
    destination.mkdir(parents=True, exist_ok=True)
    scanner = Expander(destination)
    for file in sorted(source.rglob('*')):
        if file.is_symlink(): raise ValueError('Input symlink cannot be cleared')
        if file.is_file():
            if file.stat().st_size > MAX_FILE: raise ValueError('Input exceeds reviewed file limit')
            scanner.add(str(file.relative_to(source)), file.read_bytes())
    if not scanner.members: raise ValueError('Empty scan input')
    return scanner

if __name__ == '__main__':
    os.umask(0o077)
    try:
        scanner = expand(Path(sys.argv[1]), Path(sys.argv[2]))
        Path(sys.argv[3]).write_text(json.dumps({'members': scanner.members, 'expandedBytes': scanner.total}, indent=2)+'\n')
        print(f'Coverage: {len(scanner.members)} members, {scanner.total} expanded bytes; no skipped archives.')
    except Exception as error:
        print(f'Publication scan stopped: {type(error).__name__}. Inspect inputs privately; no clearance granted.', file=sys.stderr)
        sys.exit(1)
