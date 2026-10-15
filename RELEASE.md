# Release instructions

The extension, `@speclynx/api-language-server` and Claude plugin share a version.
Pushing a release tag starts `release.yml`: it builds and retains the artifacts,
publishes npm and the GitHub release after approval, and prepares an immutable plugin
payload. Updating the public Claude catalog is a separate step after runtime testing.
A skipped `promote-plugin` job on the initial tag run is expected.

## Routine release sequence

The npm package and plugin catalog already exist. Use this sequence for the next real
release; the first npm bootstrap and 1.6.0 icon correction below are historical exceptions.

| Step | Executor | Result |
| --- | --- | --- |
| Prepare and merge source | Maintainer and PR reviewer | Confirm version/date, update manifests and notes, pass normal CI |
| Verify npm trust and release authorization | npm maintainer and release operator | Exact repository/workflow/environment trust and working review gates |
| Push one new release tag | Release operator | CI builds/tests/scans once and retains exact TGZ, VSIX and record |
| Approve publishing jobs | Release reviewer | CI publishes npm/GitHub and prepares the frozen Claude payload |
| Test and promote Claude payload | Runtime tester and release reviewer | Fresh install/cached upgrade evidence, then dispatch promotion from the same tag |
| Distribute the retained VSIX | Publisher/operator | Website uploads to both marketplaces, then the editor update |
| Verify and record | Release operator | Public versions/bytes, catalog/main CI, deployment and recovery copy |

Existing workflows automate builds, checks, npm/GitHub publication and plugin preparation/
promotion. Marketplace uploads and the editor update remain operator actions; no new
publishing workflow or marketplace token is required for the website upload route.

## Prepare the source

1. Use `.nvmrc`, install with `npm ci`, and start from a reviewed, clean `main`.
2. Keep upcoming changes under `# Unreleased` while developing. When the release is ready,
   finalize that section as `# X.Y.Z (YYYY-MM-DD)` with the confirmed release date and
   nonempty notes. A tentative schedule is not a completed release date.
3. Run `npm run release:version -- X.Y.Z` and review the changed manifests and lockfile.
4. Open and merge a pull request after `build`, `publication-guardrails`,
   `dependency-audit`, and `codeql` pass. Record browser worker startup, diagnostics,
   completion, JSON/YAML conversions and both preview renderers against the candidate.
5. Tag the merged source commit as `vX.Y.Z` and push that one tag. Never move an
   existing release tag. Release tags and payload refs must already be protected.

Keep the catalog serving the currently tested payload while preparing the next release;
do not empty it or advance its pin during version preparation. Do not create a plugin
lockfile at this stage: `prepare-plugin` resolves the newly published package later.
Historical release tags remain unchanged. Before tagging, also run:

```sh
npm run release:check
GITHUB_REF_NAME=vX.Y.Z npm run release:check -- --tag
```

Replace `X.Y.Z` with the prepared version. These checks do not create or publish a tag.

Version preparation, release-tag validation and release-note extraction share the same
changelog check: exactly one heading for the requested version, a real ISO calendar date,
and nonempty notes. They reject an unreleased entry, duplicate headings, dates in the future
and headings that appear only inside prose, comments or fenced examples. Date comparisons
use UTC. Earlier valid dates remain valid on retries; they do not have to equal the retry day.
The check cannot infer when a release actually happened, so reviewers must confirm the date.
Keep historical entries intact; these strict date checks apply to the release being prepared.

If the schedule changes before tagging, update the date before freezing the source and
building its artifacts. After a tag or package has been published, follow the retained-artifact
recovery rules below; do not move the tag or rebuild a published version to change its date.

## Verify release authorization

Configure the `release` environment with both maintainers eligible to review,
self-review prevented and administrator bypass disabled. Restrict deployments to
release tags with a tag rule matching `v*`. Naming an environment in YAML does not
configure these controls.

For an existing npm package, configure its trusted publisher with the exact repository
`speclynx/vscode-openapi-toolkit`, workflow filename `release.yml`, environment `release`,
and permission for direct `npm publish`. If the package does not exist yet, follow
[Historical first npm publication](#historical-first-npm-publication) before configuring trust.
The hosted runner uses the Node version in `.nvmrc`; trusted publication requires
Node 22.14 or later and npm 11.5.1 or later. Only `publish-npm` receives
`id-token: write`; no `NPM_TOKEN` is used. See the
[npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

Configure or recreate trust close to the next real publication: a new configuration
expires unless its first successful publish occurs within two days. The 1.6.0 manual
bootstrap and subsequent identical-version skip did not exercise OIDC. The next genuine
npm release must verify OIDC publication and provenance; do not cut a dummy release to
exercise authentication. An expired configuration must be deleted and recreated.

`RELEASE_PAT` is an environment secret used only for plugin payload/catalog writes.
Use a fine-grained token restricted to this repository, with the needed contents
permission and a release identity explicitly allowed by the applicable rulesets.
Record its owner and expiry privately. Never place it in a Git remote URL.
GitHub release assets use the repository's `GITHUB_TOKEN`.

Verify repository artifact retention permits 90 days. Environment reviewers must
inspect the exact source, artifacts, runtime evidence and requested operation before
approval. Workflow checks do not replace confidentiality or attribution review.

The release secret scan runs after packaging and before uploading new retained npm/VSIX
artifacts. Plugin preparation uses the same scan on payload files and commit metadata
before pushing the payload ref. Retried releases that restore retained artifacts verify
their recorded identities instead of rebuilding or rescanning them.

The scan covers file contents, recursively extracted archive members and structured
archive metadata, including member names, ownership fields, comments, ZIP extra fields
and TAR extended headers. It rejects private/unsafe paths, unsupported member types,
encrypted ZIP entries and unreadable archives, and enforces size and nesting limits.
It does not also scan whole compressed containers or raw decoded TAR streams: preambles,
padding, unused header bytes and trailing data outside extracted members/metadata are
outside its scope. Archive hashes and source-commit checks remain unchanged. Reviewed
findings bind the individual file or metadata input, so changing package provenance does
not invalidate reviews of unchanged bundled code through a whole-container hash.

The scan keeps the specific credential and private-key rules. The broad
`generic-api-key` heuristic is disabled because it matches ordinary bundled code and
examples; unknown/custom credential formats lose that generic detection. New findings
from the remaining rules still stop the release and require review.
`config/secret-scan-dispositions.json` accepts individual verified non-secret findings only: exact input SHA-256, scanner configuration SHA-256, rule,
location, redacted-match SHA-256, decoding tags, reviewer and reason. It contains no
raw candidate values. Changed bytes, new findings or a changed scanner configuration
require another review. There are no path-wide or package-wide exemptions, and an
empty disposition list grants no exceptions. Never add an exception for a real secret
or use a non-secret classification as confidentiality clearance of the whole file.

## Retained artifacts and retry behavior

The first run records `gitHead` before packing, builds the production targets, packs
once, and tests that same npm archive in independent runtime/type consumers and the
plugin. It retains the npm tarball and VSIX in the immutable Actions artifact
`release-deliverables-<source SHA>`. The separate
`release-record-<source SHA>` artifact contains `release-record.json`, identifying:

- Source commit and version.
- Originating workflow run and attempt.
- The deliverables' immutable artifact ID and exact filenames.
- SHA-256 for each file and SHA-512 SRI for the npm tarball.

The source SHA is the stable record lookup key. Lookup requires exactly one record
from `release.yml` at that source SHA and uses the artifact ID inside it. It never
selects the newest artifact with a matching name. Download IDs appear in the Actions
job summary; retain a private recovery copy before publication.

Whole-run retries restore the original files and verify every digest. Failed publish
job retries reevaluate the registry using those same files. Both manual and CI npm
publication must consume the retained tarball; neither repacks the workspace.

| Registry state | Result |
| --- | --- |
| Definite 404 | The retained npm archive may be published after environment approval. |
| Existing version with matching `gitHead`, SHA-512 SRI and downloaded SHA-256 | Skip npm publication and continue. |
| Any identity mismatch | Stop; use a new version for changed bytes. |
| Network error or incomplete metadata | Bounded retries, then stop. |

GitHub release uploads also verify existing asset bytes and refuse to clobber a
mismatch. After completion, the release retains both archives and their record.

Use the normal GitHub rerun facility within 30 days. If the original artifact expired,
the record is missing, an upload was interrupted before record finalization, or the
workflow changed, stop for a separately reviewed recovery. An operator must recover
and verify the original bytes/IDs from the retained private copy or completed release;
never rebuild an already-published version or move its tag. A recordless failed build
retry also requires explicit recovery review, since an absent record cannot prove
whether an original archive was lost. See
[GitHub artifact retention](https://docs.github.com/en/actions/tutorials/store-and-share-data).

## Historical first npm publication

The package already exists after the 1.6.0 bootstrap. Do not repeat this manual
publication for routine releases; the following describes the one-time bootstrap.

A trusted publisher cannot be configured for a package name that does not yet exist.
For the first version, let the tag's `preflight` and `artifacts` jobs complete, then
leave `publish-npm` waiting for release-environment approval. Download the deliverables
and record by their recorded artifact IDs, verify their digests, retain a private recovery
copy, and complete confidentiality and attribution review of those exact files.

The designated npm maintainer then uses interactive 2FA to publish exactly that archive:

```sh
npm publish ./speclynx-api-language-server-1.6.0.tgz --access public --provenance=false
```

Do not build locally or use `npm publish --workspace=server`. Verify the registry's
`gitHead`, SHA-512 SRI and downloaded SHA-256 against the retained record, and test
installation of the published version. Then approve the waiting `publish-npm` job
(or rerun it if a previous attempt failed). It verifies and skips the identical version
and allows the GitHub release jobs to continue; an intentional failed attempt is unnecessary.

This manual bootstrap has no npm provenance, and the subsequent skip does not exercise
OIDC. The next genuine npm publication must verify the OIDC/provenance path; a dry run
cannot prove authentication. Configure the package's trusted publisher shortly before
that publication using the repository/workflow/environment tuple above. A new configuration
expires unless its first successful publish occurs within two days; delete and recreate
an expired configuration. Record this outstanding verification after the bootstrap release.
See [npm's configuration expiry rules](https://docs.npmjs.com/trusted-publishers/#trusted-publisher-configuration-expiry).

## Plugin payload and runtime verification

After npm identity verification, `prepare-plugin` freezes the dependency from the
release source into `plugins/speclynx-lsp/package-lock.json`. The payload commit is
retained at `refs/heads/plugin-releases/vX.Y.Z`. Only the generated lockfile differs
from the release source; the development plugin on `main` is never overwritten.
The payload files, registry URLs, integrity and new commit metadata are checked and
scanned before the ref is pushed. Existing payload refs must retain their original SHA.

Before advertising that payload, create a temporary local marketplace with
`.claude-plugin/marketplace.json` containing:

```json
{
  "name": "speclynx-verification",
  "owner": { "name": "SpecLynx" },
  "plugins": [{
    "name": "speclynx-lsp",
    "source": {
      "source": "git-subdir",
      "url": "https://github.com/speclynx/vscode-openapi-toolkit.git",
      "path": "plugins/speclynx-lsp",
      "sha": "REPLACE_WITH_THE_EXACT_40_CHARACTER_PAYLOAD_SHA"
    }
  }]
}
```

Use isolated Claude configuration/cache, install from this temporary marketplace, and
verify LSP initialization and diagnostics. Test updating a cached predecessor as well
as a fresh install. For the first release, seed a local predecessor fixture and record
that setup privately. Record Node, npm and Claude versions and installation time; an
installation exceeding Claude's 60-second limit does not pass. See the official
[plugin package dependency behavior](https://code.claude.com/docs/en/plugins/loading#nodejs-package-dependencies)
and [plugin sources](https://code.claude.com/docs/en/plugins/marketplace-reference#plugin-sources).

Prepare a public-safe `plugin-runtime-evidence.json` with exactly these fields:

```json
{
  "schemaVersion": 1,
  "sourceSha": "RELEASE_SOURCE_SHA",
  "payloadSha": "PAYLOAD_SHA",
  "previousPayloadSha": null,
  "version": "1.6.0",
  "nodeVersion": "24.10.0",
  "npmVersion": "11.6.1",
  "claudeVersion": "REPLACE_WITH_TESTED_VERSION",
  "installMs": 1000,
  "diagnosticsVerified": true,
  "cachedUpgradeVerified": true,
  "reviewer": "REVIEWER_GITHUB_LOGIN",
  "reviewedAt": "REPLACE_WITH_ACTUAL_ISO_TIMESTAMP"
}
```

The example is a schema illustration, not evidence of a completed test. Use the
currently served catalog SHA for `previousPayloadSha`, or `null` for the first release.
Keep raw logs, screenshots with private content and review notes private. After review,
upload this public-safe evidence file as a release asset, calculate its SHA-256, and
run `release.yml` manually **from the same release tag**, with `promote_plugin` enabled
and `runtime_evidence_sha256` set to that digest. Environment approval is still required.

For example, after replacing the version and evidence digest:

```sh
gh workflow run release.yml --repo speclynx/vscode-openapi-toolkit \
  --ref vX.Y.Z -f promote_plugin=true -f runtime_evidence_sha256=EVIDENCE_SHA256
```

For a later release, use the currently published payload as the tested predecessor;
the synthetic predecessor fixture was only needed for the first release.

Promotion rechecks the registry, evidence digest, payload identity and tested predecessor.
It compares versions against the manifest at the catalog's existing pin, preserving other
entries and unrelated development changes. Concurrent pushes trigger a bounded reread/retry.
An older release cannot roll back the catalog, and a changed payload at the same version
is rejected because cached Claude clients require a version increase to update.

Verify installation from the default public marketplace after promotion, then announce
the release. If a plugin payload is faulty, withdrawing its entry prevents new installs;
ship a corrected patch version for cached clients. Changing only a SHA does not update them.

## Distribution after verification

Use the **retained VSIX from the GitHub release** for the VS Code Marketplace, Open VSX
and `speclynx-editor`. Rebuilding would create an untested artifact identity even though
obfuscation has been removed. These uploads and the announcement remain maintainer actions.

For the marketplaces, upload the existing archive through the publisher websites.
The internal manifest provides publisher/name/version; the local filename does not
change them. Open VSX requires the publisher agreement and the applicable namespace
ownership. Let registry processing finish, then verify the public version and downloaded
archive, plus README/changelog listing content. Website uploads require no CLI PAT.
See [VS Code publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
and [Open VSX publishing](https://github.com/EclipseFdn/open-vsx.org/wiki/Publishing-Extensions).

The browser editor bundles its own archive; marketplace publication does not update it.
In `speclynx/speclynx-editor`, replace `extensions/speclynx-openapi-toolkit.vsix` with the
same retained file, build and test the editor, and open a reviewed PR. Its existing main
push workflow deploys to GitHub Pages after merge. Verify that deployment before marking
editor distribution complete. Do not rebuild the extension or reset user storage merely
to replace the bundled archive.

### 1.6.0 icon-only distribution correction

For 1.6.0, use `vscode-openapi-toolkit-1.6.0-marketplace.vsix` from the GitHub
release for extension distribution. The original archive has a 1100x1100 icon that
Marketplace rejected; the corrected archive uses a 256x256 PNG rendered from the
unchanged `images/icon.svg`. Only `extension/images/icon.png` differs among the
extracted files. Runtime bundles, version metadata, README, changelog and notices
are unchanged; ZIP compression and bookkeeping can differ after repackaging.

This is an explicitly approved, one-time icon-only exception to the retained-artifact
rule, not a rebuild or replacement of the original release. Preserve the original
`vscode-openapi-toolkit-1.6.0.vsix` filename, asset and bytes, plus the original
`release-record.json`. The corrected archive has a separate filename and SHA-256;
its identity and verification are documented in
[vsix-correction.md](https://github.com/speclynx/vscode-openapi-toolkit/releases/download/v1.6.0/vsix-correction.md)
and highlighted in the v1.6.0 release notes. The original record continues to describe
only the original CI artifacts; release CI retries continue using those originals.

The extension version remains 1.6.0 because that version had not been published to
Marketplace when the correction was prepared. Do not move the tag, republish npm,
change the Claude payload/catalog or overwrite existing assets for this correction.
Future releases package the corrected source icon through the normal release workflow.
