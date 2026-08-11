const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '..');
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const rootLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const electronPackage = JSON.parse(fs.readFileSync(path.join(root, 'examples/electron/package.json'), 'utf8'));
const packagerPath = path.join(root, 'tools/desktop-packager');
const packagerPackagePath = path.join(packagerPath, 'package.json');
const packagerLockPath = path.join(packagerPath, 'package-lock.json');
const configPath = path.join(root, 'examples/electron/electron-builder.yml');
const workflowPath = path.join(root, '.github/workflows/release-desktop.yml');
const milestoneWorkflowPath = path.join(root, '.github/workflows/set-milestone-on-pr.yml');

test('desktop packaging exposes production and distribution commands', () => {
    assert.equal(electronPackage.scripts['build:prod'], 'theiaext build && npm run -s bundle:prod');
    assert.equal(electronPackage.scripts['bundle:prod'], 'npm run rebuild && theia build --app-target=electron --mode production');
    assert.equal(electronPackage.scripts.dist, 'npm run clean:dist && npm run build:prod && npm --prefix ../../tools/desktop-packager run package --');
    assert.match(rootPackage.scripts['clean:release'], /tsbuildinfo/);
});

test('desktop packager dependencies are isolated from the application workspace', () => {
    assert.equal(fs.existsSync(packagerPackagePath), true, 'desktop packager package.json must exist');
    assert.equal(fs.existsSync(packagerLockPath), true, 'desktop packager lockfile must exist');

    const packagerPackage = JSON.parse(fs.readFileSync(packagerPackagePath, 'utf8'));
    const packagerLock = JSON.parse(fs.readFileSync(packagerLockPath, 'utf8'));
    assert.equal(electronPackage.devDependencies?.['electron-builder'], undefined);
    assert.equal(packagerPackage.devDependencies['electron-builder'], '26.0.12');
    assert.equal(rootPackage.allowScripts?.['electron-winstaller'], undefined);
    assert.equal(rootLock.packages['node_modules/electron-builder'], undefined);
    assert.equal(rootLock.packages['node_modules/@electron/node-gyp'], undefined);
    assert.equal(packagerLock.packages['node_modules/@electron/node-gyp'].version, '10.2.0-electron.1');
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

test('desktop release workflow builds every supported runner and architecture', () => {
    assert.equal(fs.existsSync(workflowPath), true, 'release-desktop.yml must exist');
    const workflow = yaml.load(fs.readFileSync(workflowPath, 'utf8'));
    assert.deepEqual(workflow.on.push.tags, ['v*']);
    assert.equal(workflow.on.workflow_dispatch.inputs.version.required, true);
    assert.equal(workflow.permissions.contents, 'read');

    const build = workflow.jobs.build;
    assert.equal(build.strategy['fail-fast'], false);
    assert.deepEqual(build.strategy.matrix.include.map(({ os, arch }) => [os, arch]), [
        ['macos-15', 'arm64'],
        ['macos-15-intel', 'x64'],
        ['windows-2022', 'x64'],
        ['ubuntu-22.04', 'x64']
    ]);

    const stepNames = build.steps.map(step => step.name);
    const installIndex = stepNames.indexOf('Install dependencies');
    const packagerInstallIndex = stepNames.indexOf('Install desktop packager');
    const cleanIndex = stepNames.indexOf('Clear stale TypeScript metadata');
    const compileIndex = stepNames.indexOf('Compile workspaces');
    const pluginsIndex = stepNames.indexOf('Download editor plugins');
    const packageIndex = stepNames.indexOf('Package desktop application');
    assert.ok(installIndex >= 0 && installIndex < packagerInstallIndex);
    assert.ok(packagerInstallIndex < cleanIndex && cleanIndex < compileIndex);
    assert.ok(compileIndex < pluginsIndex && pluginsIndex < packageIndex);
    assert.match(build.steps[packageIndex].run, /npm run dist --workspace @theia\/example-electron/);
    assert.ok(build.steps.some(step => String(step.uses).startsWith('actions/upload-artifact@')));
});

test('tag builds aggregate artifacts into a draft GitHub release', () => {
    const workflow = yaml.load(fs.readFileSync(workflowPath, 'utf8'));
    const release = workflow.jobs.release;
    assert.equal(release.needs, 'build');
    assert.equal(release.permissions.contents, 'write');
    assert.match(release.if, /refs\/tags\/v/);
    assert.ok(release.steps.some(step => String(step.uses).startsWith('actions/download-artifact@')));
    const publish = release.steps.find(step => step.name === 'Create draft release');
    assert.match(publish.run, /gh release create/);
    assert.match(publish.run, /--draft/);
    assert.match(publish.run, /SHA256SUMS/);
    assert.match(publish.run, /unsigned/i);
});

test('milestone workflow can read merged package metadata', () => {
    const workflow = yaml.load(fs.readFileSync(milestoneWorkflowPath, 'utf8'));
    assert.equal(workflow.permissions.contents, 'read');
    assert.equal(workflow.permissions.issues, 'write');
    assert.equal(workflow.permissions['pull-requests'], 'write');
});
