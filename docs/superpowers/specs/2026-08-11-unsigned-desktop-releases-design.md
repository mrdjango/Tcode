# Unsigned Desktop Releases Design

## Goal

Produce downloadable Tcode desktop installers for macOS, Windows, and Ubuntu from the private `mrdjango/Tcode` repository and attach them to a single draft GitHub Release.

## Repository Boundary

Tcode is treated as a standalone private product repository. Packaging remains in this repository and uses the existing Electron application under `examples/electron`; extracting the product into another repository is outside this change.

## Release Inputs

The release workflow supports two entry points:

- A pushed tag matching `v*`, using the tag as the release version.
- A manual `workflow_dispatch`, using a required version input and building artifacts without creating or moving a Git tag.

Tag-triggered runs create or update a draft GitHub Release for that exact tag. Manual runs upload workflow artifacts only, so an operator can validate packaging without publishing a release.

Only one release workflow for a given git reference may run at a time. A newer run for the same reference cancels an older in-progress run.

## Native Build Matrix

Each package is built on its native GitHub-hosted runner so Electron native modules are rebuilt for the correct operating system and architecture:

| Runner | Architecture | Release assets |
| --- | --- | --- |
| `macos-15` | arm64 | DMG and ZIP |
| `macos-15-intel` | x64 | DMG and ZIP |
| `windows-2022` | x64 | NSIS EXE |
| `ubuntu-22.04` | x64 | AppImage and DEB |

The workflow pins Node.js to `24.15.0` and Python to `3.13`, matching the repository's existing native-dependency workflow.

## Application Packaging

The Electron application gains an explicit production build and packaging configuration:

- The Theia frontend and backend bundles are generated in production mode.
- Electron native dependencies are rebuilt before packaging.
- `electron-builder` produces platform-specific installers into `examples/electron/dist`.
- Artifact names include the product version, operating system, and CPU architecture.
- The application ID is `com.tensorgrid.tcode` and the product name is `Tcode`.
- The existing `tcode` URL protocol remains registered.

Packaging configuration lives in `examples/electron/electron-builder.yml`. Package scripts in `examples/electron/package.json` expose separate production-build and distribution commands so the workflow does not duplicate build logic.

## Signing Policy

This first release pipeline does not require production signing credentials:

- macOS uses an ad-hoc signature (`identity: "-"`) and does not submit builds for notarization.
- Windows installers are unsigned.
- Linux packages are unsigned.

The GitHub Release notes must explicitly identify these builds as unsigned/ad-hoc signed and describe the expected operating-system warnings. Production certificate signing and macOS notarization remain a later change.

## Artifact and Release Flow

Each matrix job installs dependencies, performs the production build, packages its target, validates that the expected files exist, and uploads a short-lived workflow artifact. The jobs never publish to GitHub Releases directly.

After all tag-triggered matrix jobs succeed, one Ubuntu aggregation job downloads every artifact, generates a `SHA256SUMS.txt` file, and creates or updates one draft GitHub Release. Keeping publication in one job avoids concurrent release-asset races.

The workflow uses least-privilege permissions: matrix jobs receive `contents: read`; only the aggregation job receives `contents: write`.

## Failure Handling

- Matrix fail-fast is disabled so failures from one platform do not hide results from the others.
- A missing expected installer fails that platform job before upload.
- The release aggregation job runs only when every required platform job succeeds.
- Existing assets with the same names are replaced only on a rerun for the same draft release and tag.
- A stable release is never published automatically; a maintainer reviews and publishes the draft in GitHub.

## Verification

Static verification checks the JSON package configuration, validates the workflow YAML, and inspects the resolved `electron-builder` configuration. A local production bundle verifies the new package scripts. Full installer verification is performed by the GitHub Actions matrix because native packages cannot be reliably produced for every target from one development machine.

## Out of Scope

- Apple Developer ID signing and notarization
- Windows Authenticode or Azure Trusted Signing
- Automatic updates through `electron-updater`
- Windows ARM64 and Linux ARM64 packages
- Publishing a stable GitHub Release without maintainer approval
- Moving Tcode packaging to a separate repository
