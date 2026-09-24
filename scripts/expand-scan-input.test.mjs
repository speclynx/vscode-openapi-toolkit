import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

test('archive scanner fails closed on private members, traversal, symlinks and oversized content', () => {
  const script = `
import importlib.util, tempfile, pathlib, zipfile, io
spec=importlib.util.spec_from_file_location('scan','scripts/expand-scan-input.py'); scan=importlib.util.module_from_spec(spec);spec.loader.exec_module(scan)
with tempfile.TemporaryDirectory() as root:
 d=pathlib.Path(root)
 for name in ['../escape', 'extension/.ftlocal/private.md', 'extension/.codex/settings.json', 'extension/.idea/workspace.xml', 'extension/project.iml', 'extension/docs/changelog/01-lsp-server/plan.md', 'extension/docs/changelog/02-release-automation/plan.md', 'extension/docs/changelog/03-public-repo/plan.md', '/absolute']:
  data=io.BytesIO()
  with zipfile.ZipFile(data,'w') as z:z.writestr(name,'synthetic fixture')
  try:scan.Expander(d).add('fixture.zip',data.getvalue());raise AssertionError('accepted forbidden path')
  except ValueError:pass
 data=io.BytesIO()
 with zipfile.ZipFile(data,'w') as z:
  info=zipfile.ZipInfo('link');info.external_attr=0o120777<<16;z.writestr(info,'target')
 try:scan.Expander(d).add('symlink.zip',data.getvalue());raise AssertionError('accepted symlink')
 except ValueError:pass
 scan.MAX_FILE=8
 try:scan.Expander(d).add('oversize.txt',b'123456789');raise AssertionError('accepted oversize')
 except ValueError:pass
`;
  assert.doesNotThrow(() => execFileSync('python3', ['-c', script], { stdio: 'pipe' }));
});

test('scanner preserves duplicate members, binary bytes and archive metadata', () => {
  const script = `
import importlib.util, tempfile, pathlib, zipfile, io, warnings
spec=importlib.util.spec_from_file_location('scan','scripts/expand-scan-input.py'); scan=importlib.util.module_from_spec(spec);spec.loader.exec_module(scan)
with tempfile.TemporaryDirectory() as root:
 d=pathlib.Path(root); data=io.BytesIO()
 with warnings.catch_warnings():
  warnings.simplefilter('ignore')
  with zipfile.ZipFile(data,'w') as z:
   z.writestr('same.txt','first');z.writestr('same.txt','second');z.comment=b'archive metadata'
 scan.Expander(d).add('archive.zip',data.getvalue())
 bodies=[p.read_bytes() for p in d.rglob('*') if p.is_file()]
 assert any(b.endswith(b'first') for b in bodies) and any(b.endswith(b'second') for b in bodies)
 assert any(b.endswith(b'archive metadata') for b in bodies)
 scan.Expander(d).add('opaque.bin',b'\\x00binary fixture')
 assert (d/'opaque.bin').read_bytes().endswith(b'\\x00binary fixture')
 for b in [b'PK\\x03\\x04broken',b'\\x1f\\x8bbroken']:
  try:scan.Expander(d).add('broken.zip',b);raise AssertionError('accepted unreadable archive')
  except ValueError:pass
`;
  assert.doesNotThrow(() => execFileSync('python3', ['-c', script], { stdio: 'pipe' }));
});

test('archive coverage includes ZIP preambles and trailers and decoded TAR headers and padding', () => {
  const script = `
import importlib.util,tempfile,pathlib,zipfile,tarfile,io,gzip,json
spec=importlib.util.spec_from_file_location('scan','scripts/expand-scan-input.py');scan=importlib.util.module_from_spec(spec);spec.loader.exec_module(scan)
with tempfile.TemporaryDirectory() as root:
 d=pathlib.Path(root);zipped=io.BytesIO()
 with zipfile.ZipFile(zipped,'w') as z:z.writestr('file.txt','zip payload')
 raw=b'ZIP preamble fixture\\n'+zipped.getvalue()+b'\\nZIP trailer fixture'
 scanner=scan.Expander(d);scanner.add('fixture.zip',raw)
 assert (d/'fixture.zip/__archive-container-bytes__').read_bytes().endswith(raw)
 assert (d/'fixture.zip/file.txt').read_bytes().endswith(b'zip payload')
 tarred=io.BytesIO()
 with tarfile.open(fileobj=tarred,mode='w',format=tarfile.USTAR_FORMAT) as t:
  info=tarfile.TarInfo('file.txt');info.uname='header-owner-fixture';info.gname='header-group-fixture';info.size=11;t.addfile(info,io.BytesIO(b'tar payload'))
 decoded=tarred.getvalue()+b'TAR padding fixture'
 scanner.add('fixture.tgz',gzip.compress(decoded))
 assert (d/'fixture.tgz/__decoded-tar-bytes__').read_bytes().endswith(decoded)
 assert (d/'fixture.tgz/file.txt').read_bytes().endswith(b'tar payload')
 metadata=(d/'fixture.tgz/__archive-metadata__.json').read_bytes().split(b'\\n',1)[1]
 assert json.loads(metadata)[0]['uname']=='header-owner-fixture'
 for member in scanner.members:
  assert (d/member['pathProjection']).is_file() and (d/member['contentProjection']).is_file()
 # A small compressed container must not bypass the decoded size limit.
 scan.MAX_FILE=1024
 try:scan.Expander(d/'oversize').add('oversize.tgz',gzip.compress(decoded));raise AssertionError('accepted oversized decoded TAR')
 except ValueError:pass
`;
  assert.doesNotThrow(() => execFileSync('python3', ['-c', script], { stdio: 'pipe' }));
});

test('scan runner rejects missing coverage, unknown skips and unredacted output', () => {
  const script = `
import tempfile,pathlib,json,subprocess,sys
with tempfile.TemporaryDirectory() as root:
 p=pathlib.Path(root);s=p/'input';s.mkdir();(s/'plain.txt').write_text('ordinary text')
 coverage=p/'coverage.json';coverage.write_text(json.dumps({'members':[]}))
 fake=p/'scanner';e=p/'evidence'
 def run(body):
  fake.write_text('#!/usr/bin/env python3\\nimport sys,json,pathlib\\n'+body);fake.chmod(0o700)
  return subprocess.run([sys.executable,'scripts/run-secret-scan.py',str(fake),str(s),str(coverage),str(e)],capture_output=True).returncode
 report="pathlib.Path(sys.argv[sys.argv.index('--report-path')+1]).write_text('[]')\\n"
 visited="print('TRC scanning path path='+str(pathlib.Path(sys.argv[2])/'plain.txt'))\\n"
 assert run(report)!=0
 assert run(visited+report)==0
 assert run(visited+report+"print('00:00 ERR unreadable file')\\n")!=0
 bad="pathlib.Path(sys.argv[sys.argv.index('--report-path')+1]).write_text(json.dumps([{'Secret':'synthetic unredacted fixture'}]))\\n"
 assert run(visited+bad)!=0 and not (e/'findings.json').exists()
`;
  assert.doesNotThrow(() => execFileSync('python3', ['-c', script], { stdio: 'pipe' }));
});

test('reviewed findings never exempt changed bytes, new locations or changed detector configuration', () => {
  const script = `
import importlib.util,tempfile,pathlib,hashlib,copy
spec=importlib.util.spec_from_file_location('review','scripts/secret-scan-dispositions.py');review=importlib.util.module_from_spec(spec);spec.loader.exec_module(review)
with tempfile.TemporaryDirectory() as root:
 p=pathlib.Path(root);data=b'ordinary synthetic fixture';sha=hashlib.sha256(data).hexdigest()
 f=p/'file.txt';f.write_bytes(b'Publication raw-byte scan projection; original bytes follow.\\n'+data)
 finding={'File':str(f),'RuleID':'generic-api-key','StartLine':2,'EndLine':2,'StartColumn':1,'EndColumn':20,'Match':'key=REDACTED','Tags':[]}
 members=[{'sha256':sha,'pathProjection':'file.txt'}];config='a'*64
 entry={'contentSha256':sha,'ruleId':finding['RuleID'],'startLine':2,'endLine':2,'startColumn':1,'endColumn':20,'redactedMatchSha256':hashlib.sha256(finding['Match'].encode()).hexdigest(),'tags':[],'decision':'non-secret','reviewer':'synthetic test reviewer','reason':'synthetic ordinary text'}
 manifest={'schemaVersion':1,'configSha256':config,'findings':[entry]}
 def run(items,doc=manifest,cfg=config):return review.partition_findings(items,p,members,doc,cfg)
 accepted,unresolved=run([finding]);assert len(accepted)==1 and not unresolved
 for change in [{'StartColumn':3},{'Match':'another=REDACTED'},{'RuleID':'another-rule'},{'Tags':['decoded:base64']},{'File':str(p/'unknown.txt')}]:
  accepted,unresolved=run([finding,{**finding,**change}]);assert len(accepted)==1 and len(unresolved)==1
 assert len(run([finding],{**manifest,'findings':[]})[1])==1
 for doc,cfg in [({**manifest,'findings':[entry,entry]},config),(manifest,'b'*64),({**manifest,'findings':[{**entry,'decision':'pending'}]},config)]:
  try:run([finding],doc,cfg);raise AssertionError('accepted unreviewed input')
  except ValueError:pass
 f.write_bytes(b'Publication raw-byte scan projection; original bytes follow.\\nchanged fixture')
 try:run([finding]);raise AssertionError('accepted changed bytes')
 except ValueError:pass
`;
  assert.doesNotThrow(() => execFileSync('python3', ['-c', script], { stdio: 'pipe' }));
});
