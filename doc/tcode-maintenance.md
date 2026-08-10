# Tcode downstream maintenance

Tcode is a public fork of `eclipse-theia/theia` owned by `mrdjango`.
The product branch is `master`; the original project is the read-only `upstream`
remote. The GitHub branch `upstream-master` is an exact mirror of
`eclipse-theia/theia:master`.

## Remote and branch setup

```bash
git remote -v
git fetch upstream master
git switch master
git config rerere.enabled true
```

Product changes are merged into `master` through pull requests. Do not rebase
or force-push `master`: preserving the merge ancestry makes future upstream
comparisons and conflict resolution auditable.

## Automated upstream updates

`.github/workflows/tcode-upstream-sync.yml` runs daily at 03:17 UTC and can be
started with **Actions → Tcode / Sync upstream → Run workflow**. It updates the
`upstream-master` mirror, merges the new upstream commit into
`bot/upstream-sync`, and opens or refreshes one PR titled
`chore: sync eclipse-theia/theia master`.

The workflow never merges the PR automatically. A conflict leaves `master` and
the previous sync PR unchanged and opens an `upstream-conflict` issue. Resolve
it locally, run the checks, push the sync branch, and let the existing PR update:

```bash
git fetch upstream master origin master
git switch -C bot/upstream-sync origin/master
git merge --no-edit --no-ff upstream/master
npm run lint
npm run test --workspace @tcode/tensorgrid-ai
git push --force-with-lease origin bot/upstream-sync
```

`rerere` is intentionally local metadata. It can reuse a resolution on one
checkout, but its cache is not committed or trusted by CI.

## Downstream boundaries

TensorGrid authentication and model registration live in
`packages/tcode-tensorgrid-ai`. The OpenAI manager is consumed through its
existing public interface; Tcode models are registered only after a validated
credential exists. The branded Electron application is
`examples/tcode-electron`, leaving the upstream example app unchanged.

Keep product-specific files in those directories. Generic fixes in upstream
files must be separate commits and should be proposed upstream when useful;
this keeps them easy to drop when Theia accepts an equivalent change.

## Versions and releases

The initial product version is `1.74.0-tcode.1`: the first component tracks the
Theia dependency baseline and the suffix identifies the downstream release.
When moving to a newer Theia baseline, update the package dependencies and the
Tcode app version together, run the full verification workflow, and record the
upstream commit in the release notes.

Before a release, verify the app title (`Tcode`), the registered callback URI
(`tcode://tensorgrid/auth`), credential redaction, and that no build output or
secret is staged.
