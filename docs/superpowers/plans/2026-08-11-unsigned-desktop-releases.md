# Unsigned Desktop Releases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build unsigned/ad-hoc-signed Tcode installers for macOS, Windows, and Ubuntu on native GitHub Actions runners and collect tag builds in one draft GitHub Release.

**Architecture:** The existing `examples/electron` workspace owns production bundling and `electron-builder` configuration. A single matrix workflow builds each native platform independently, uploads workflow artifacts, and delegates tag publication to one least-privilege aggregation job.

**Tech Stack:** Node.js 24.15.0, npm workspaces, Theia 1.74, Electron 42.3.0, electron-builder 26.0.12, GitHub Actions, Node's built-in test runner, js-yaml.

## Global Constraints

- Keep packaging in the private `mrdjango/Tcode` repository under `examples/electron`.
- Build macOS arm64 and x64, Windows x64, and Ubuntu x64 on native runners.
- Use macOS ad-hoc identity `-`; do not notarize.
- Do not sign Windows or Linux artifacts.
- Tag runs create a draft release; manual runs upload workflow artifacts only.
- Never publish a stable GitHub Release automatically.
- Pin Node.js to `24.15.0`, Python to `3.13`, Electron to `42.3.0`, and electron-builder to `26.0.12`.

---

### Task 1: Define and implement the Electron packaging contract

**Files:**
- Create: `scripts/desktop-release-config.spec.js`
- Create: `examples/electron/electron-builder.yml`
- Modify: `examples/electron/package.json`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: the existing `@theia/example-electron` workspace, generated `lib` and `src-gen` bundles, root `plugins` directory, and Electron 42.3.0 distribution.
- Produces: `npm run test:desktop-release-config`, `npm run build:prod --workspace @theia/example-electron`, and `npm run dist --workspace @theia/example-electron -- <electron-builder platform flags>`.

- [ ] **Step 1: Write the failing packaging contract test**

Create `scripts/desktop-release-config.spec.js` with Node's test runner. Parse `examples/electron/package.json` as JSON and `examples/electron/electron-builder.yml` with `js-yaml`. Assert the following independently derived contract:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '..');
const electronPackage = JSON.parse(fs.readFileSync(path.join(root, 'examples/electron/package.json'), 'utf8'));
const configPath = path.join(root, 'examples/electron/electron-builder.yml');

test('desktop packaging exposes production and distribution commands', () => {
    assert.equal(electronPackage.scripts['build:prod'], 'theiaext build && npm run -s bundle:prod');
    assert.equal(electronPackage.scripts['bundle:prod'], 'npm run rebuild && theia build --app-target=electron --mode production');
    assert.equal(electronPackage.scripts.dist, 'npm run clean:dist && npm run build:prod && electron-builder --publish never');
    assert.equal(electronPackage.devDependencies['electron-builder'], '26.0.12');
});

test('desktop packaging produces the required unsigned platform targets', () => {
    assert.equal(fs.existsSync(configPath), true, 'electron-builder.yml must exist');
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    assert.equal(config.appId, 'com.tensorgrid.tcode');
    assert.equal(config.productName, 'Tcode');
    assert.equal(config.electronVersion, '42.3.0');
    assert.equal(config.mac.identity, '-');
    assert.equal(config.mac.notarize, false);
    assert.deepEqual(config.mac.target, ['dmg', 'zip']);
    assert.deepEqual(config.win.target, ['nsis']);
    assert.equal(config.win.signAndEditExecutable, false);
    assert.deepEqual(config.linux.target, ['AppImage', 'deb']);
});
```

- [ ] **Step 2: Run the packaging contract test and verify RED**

Run:

```bash
node --test scripts/desktop-release-config.spec.js
```

Expected: FAIL because `electron-builder.yml`, the production scripts, and `electron-builder` dependency do not exist.

- [ ] **Step 3: Add pinned packaging dependencies**

Run:

```bash
npm install --save-dev js-yaml@4.1.0
npm install --save-dev --workspace @theia/example-electron electron-builder@26.0.12
```

This updates both package manifests and `package-lock.json` through npm rather than manual lockfile editing.

- [ ] **Step 4: Implement production and distribution scripts**

Add these scripts to `examples/electron/package.json` while preserving the existing development scripts:

```json
"build:prod": "theiaext build && npm run -s bundle:prod",
"bundle:prod": "npm run rebuild && theia build --app-target=electron --mode production",
"clean:dist": "rimraf dist",
"dist": "npm run clean:dist && npm run build:prod && electron-builder --publish never"
```

Add the root script:

```json
"test:desktop-release-config": "node --test scripts/desktop-release-config.spec.js"
```

- [ ] **Step 5: Implement `electron-builder.yml`**

Create the configuration with:

```yaml
appId: com.tensorgrid.tcode
productName: Tcode
copyright: Copyright © 2026 TensorGrid
electronDist: ../../node_modules/electron/dist
electronVersion: 42.3.0
asar: true
asarUnpack:
  - "**/lib/backend/native/**"
  - "**/lib/backend/shell-integrations/**"
  - "**/lib/prebuilds/**"
nodeGypRebuild: false
npmRebuild: false

directories:
  buildResources: resources
  output: dist

files:
  - src-gen
  - lib
  - resources
  - package.json
  - "!**/node_modules/**"

extraResources:
  - from: ../../plugins
    to: app/plugins

mac:
  identity: "-"
  notarize: false
  category: public.app-category.developer-tools
  protocols:
    - name: Tcode
      schemes:
        - tcode
  target:
    - dmg
    - zip
  artifactName: "${productName}-${version}-mac-${arch}.${ext}"

win:
  signAndEditExecutable: false
  target:
    - nsis
  artifactName: "${productName}-${version}-windows-${arch}.${ext}"

linux:
  category: Development
  vendor: TensorGrid
  target:
    - AppImage
    - deb
  artifactName: "${productName}-${version}-linux-${arch}.${ext}"

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  runAfterFinish: false
```

- [ ] **Step 6: Run the packaging contract test and verify GREEN**

Run:

```bash
npm run test:desktop-release-config
```

Expected: 2 tests pass, 0 fail.

- [ ] **Step 7: Resolve the electron-builder configuration**

Run:

```bash
npm exec --workspace @theia/example-electron electron-builder -- --dir --config electron-builder.yml --config.directories.output=/tmp/tcode-package-preview
```

Expected: electron-builder accepts the schema and creates an unpackaged application for the host platform. If the command reaches packaging but fails because `plugins` or production bundles are absent, run `npm run download:plugins` and `npm run build:prod --workspace @theia/example-electron`, then rerun it.

- [ ] **Step 8: Commit the packaging contract**

```bash
git add package.json package-lock.json examples/electron/package.json examples/electron/electron-builder.yml scripts/desktop-release-config.spec.js
git commit -m "build(electron): add desktop packaging"
```

---

### Task 2: Define and implement the native GitHub release workflow

**Files:**
- Modify: `scripts/desktop-release-config.spec.js`
- Create: `.github/workflows/release-desktop.yml`

**Interfaces:**
- Consumes: the `dist` workspace script from Task 1, tag refs matching `v*`, and a manual `version` input.
- Produces: workflow artifacts named `tcode-macos-arm64`, `tcode-macos-x64`, `tcode-windows-x64`, and `tcode-linux-x64`; tag runs additionally produce one draft GitHub Release with `SHA256SUMS.txt`.

- [ ] **Step 1: Extend the contract test for workflow behavior**

Parse `.github/workflows/release-desktop.yml` with `js-yaml` and assert:

```js
const workflowPath = path.join(root, '.github/workflows/release-desktop.yml');

test('desktop release workflow builds native artifacts and drafts tag releases', () => {
    assert.equal(fs.existsSync(workflowPath), true, 'release-desktop.yml must exist');
    const workflow = yaml.load(fs.readFileSync(workflowPath, 'utf8'));
    const trigger = workflow.on;
    assert.deepEqual(trigger.push.tags, ['v*']);
    assert.equal(trigger.workflow_dispatch.inputs.version.required, true);
    assert.equal(workflow.jobs.build.strategy['fail-fast'], false);
    assert.deepEqual(
        workflow.jobs.build.strategy.matrix.include.map(entry => [entry.runner, entry.arch]),
        [
            ['macos-15', 'arm64'],
            ['macos-15-intel', 'x64'],
            ['windows-2022', 'x64'],
            ['ubuntu-22.04', 'x64'],
        ],
    );
    assert.equal(workflow.jobs.release.needs, 'build');
    assert.equal(workflow.jobs.release.permissions.contents, 'write');
});
```

- [ ] **Step 2: Run the workflow contract test and verify RED**

Run:

```bash
npm run test:desktop-release-config
```

Expected: the two packaging tests pass and the workflow test fails because `.github/workflows/release-desktop.yml` is absent.

- [ ] **Step 3: Implement the matrix workflow**

Create `.github/workflows/release-desktop.yml` with:

- `push.tags: ['v*']` and a required manual `version` input.
- concurrency group `desktop-release-${{ github.ref }}` with cancellation enabled.
- top-level `contents: read` permission.
- a four-entry native matrix carrying `runner`, `platform`, `arch`, `artifact`, and `artifact_glob` values.
- checkout, Node 24.15.0, Python 3.13, `npm ci`, `npm run download:plugins`, and the platform-specific `dist` command.
- a shell validation step using each matrix entry's explicit artifact glob.
- `actions/upload-artifact` with 14-day retention.
- a tag-only Ubuntu release job with `contents: write` that downloads all matrix artifacts, generates SHA256 checksums, creates a draft release when absent, and uploads assets with `gh release upload --clobber`.
- release notes that state macOS is ad-hoc signed and Windows/Linux are unsigned.

- [ ] **Step 4: Run the workflow contract test and verify GREEN**

Run:

```bash
npm run test:desktop-release-config
```

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Validate workflow syntax independently**

Run Ruby's YAML parser with YAML 1.2-compatible handling disabled only for aliases:

```bash
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/release-desktop.yml', aliases: true); puts 'workflow YAML parsed'"
```

Expected: `workflow YAML parsed` and exit code 0.

- [ ] **Step 6: Commit the release workflow**

```bash
git add .github/workflows/release-desktop.yml scripts/desktop-release-config.spec.js
git commit -m "ci: build unsigned desktop releases"
```

---

### Task 3: Verify the integrated release pipeline

**Files:**
- Modify only if verification exposes a defect in Task 1 or Task 2 files.

**Interfaces:**
- Consumes: all packaging and workflow files from Tasks 1 and 2.
- Produces: fresh evidence that configuration tests, production bundling, package schema resolution, and repository integrity pass.

- [ ] **Step 1: Run the focused contract tests**

```bash
npm run test:desktop-release-config
```

Expected: 3 tests pass, 0 fail.

- [ ] **Step 2: Run the production Electron bundle**

```bash
npm run build:prod --workspace @theia/example-electron
```

Expected: exit code 0 with production bundles in `examples/electron/lib` and `examples/electron/src-gen`.

- [ ] **Step 3: Build an unpackaged host preview**

```bash
npm exec --workspace @theia/example-electron electron-builder -- --dir --publish never
```

Expected: exit code 0 and an unpackaged host application under `examples/electron/dist`.

- [ ] **Step 4: Run repository checks**

```bash
git diff --check
npm run compile
```

Expected: both commands exit 0.

- [ ] **Step 5: Refresh the project graph**

```bash
graphify update .
```

Expected: graph update exits 0 and records the new workflow/configuration relationships.

- [ ] **Step 6: Review the final diff and status**

```bash
git status --short
git diff HEAD~2 -- .github/workflows/release-desktop.yml examples/electron/electron-builder.yml examples/electron/package.json package.json scripts/desktop-release-config.spec.js
```

Expected: only the intended release-pipeline files, lockfile, plan, and graph refresh outputs are changed.

- [ ] **Step 7: Commit verification-only corrections if needed**

If verification required corrections, stage only the corrected release files and commit:

```bash
git add .github/workflows/release-desktop.yml examples/electron/electron-builder.yml examples/electron/package.json package.json package-lock.json scripts/desktop-release-config.spec.js
git commit -m "fix(ci): validate desktop release packaging"
```
