# Release instructions

One source tag releases the VS Code extension, `@speclynx/api-language-server`, and
its Claude Code plugin. The development manifests share a version. The public plugin
catalog serves a separately retained payload commit, so development can advance while
a release is being verified.

## Prepare the source

1. Use `.nvmrc`, install with `npm ci`, and start from a reviewed, clean `main`.
2. Keep upcoming changes under `# Unreleased` while developing. When the release is ready,
   finalize that section as `# X.Y.Z (YYYY-MM-DD)` with the confirmed release date and
   nonempty notes. A tentative schedule is not a completed release date.
3. Run `npm run release:version X.Y.Z` and review the changed manifests and lockfile.
4. Open and merge a pull request after `build`, `publication-guardrails`,
   `dependency-audit`, and `codeql` pass. Record browser worker startup, diagnostics,
   completion, JSON/YAML conversions and both preview renderers against the candidate.
5. Tag the merged source commit as `vX.Y.Z` and push that one tag. Never move an
   existing release tag. Release tags and payload refs must already be protected.

The first source publication deliberately has an empty marketplace catalog. The first
server publication is planned for 1.6.0. Historical release tags remain unchanged.

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

## Configure authorization before the first tag

Configure the `release` environment with both maintainers eligible to review,
self-review prevented and administrator bypass disabled. Restrict deployments to
release tags with a tag rule matching `v*`. Naming an environment in YAML does not
configure these controls.

Give npm's trusted publisher the exact repository `speclynx/vscode-openapi-toolkit`,
workflow filename `release.yml`, environment `release`, and permission to publish.
The hosted runner uses the Node version in `.nvmrc`; trusted publication requires
Node 22.14 or later and npm 11.5.1 or later. Only `publish-npm` receives
`id-token: write`; no `NPM_TOKEN` is used. See the
[npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

`RELEASE_PAT` is an environment secret used only for plugin payload/catalog writes.
Use a fine-grained token restricted to this repository, with the needed contents
permission and a release identity explicitly allowed by the applicable rulesets.
Record its owner and expiry privately. Never place it in a Git remote URL.
GitHub release assets use the repository's `GITHUB_TOKEN`.

Verify repository artifact retention permits 90 days. Environment reviewers must
inspect the exact source, artifacts, runtime evidence and requested operation before
approval. Workflow checks do not replace confidentiality or attribution review.

The strict secret scan may flag ordinary dependency code. Review candidates privately
before tagging. `config/secret-scan-dispositions.json` accepts individual verified
non-secret findings only: exact input SHA-256, scanner configuration SHA-256, rule,
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

## First npm publication

A trusted publisher cannot be configured for a package name that does not yet exist.
For the first version, the designated npm maintainer uses interactive 2FA to publish
exactly the downloaded and digest-verified archive:

```sh
npm publish ./speclynx-api-language-server-1.6.0.tgz --access public --provenance=false
```

Do not build locally or use `npm publish --workspace=server`. Configure the trusted
publisher for the newly created package, then rerun the failed publish job. It will
verify and skip the identical existing version. The next patch release verifies the
OIDC/provenance path; a dry run cannot prove that authentication works.

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
[plugin package dependency behavior](https://code.claude.com/docs/en/plugins-reference#nodejs-package-dependencies)
and [marketplace sources](https://code.claude.com/docs/en/plugin-marketplaces).

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
