const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '..');
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const electronPackage = JSON.parse(fs.readFileSync(path.join(root, 'examples/electron/package.json'), 'utf8'));
const configPath = path.join(root, 'examples/electron/electron-builder.yml');
const workflowPath = path.join(root, '.github/workflows/release-desktop.yml');

test('desktop packaging exposes production and distribution commands', () => {
    assert.equal(electronPackage.scripts['build:prod'], 'theiaext build && npm run -s bundle:prod');
    assert.equal(electronPackage.scripts['bundle:prod'], 'npm run rebuild && theia build --app-target=electron --mode production');
    assert.equal(electronPackage.scripts.dist, 'npm run clean:dist && npm run build:prod && electron-builder --config electron-builder.yml --publish never');
    assert.equal(electronPackage.devDependencies['electron-builder'], '26.0.12');
    assert.match(rootPackage.scripts['clean:release'], /tsbuildinfo/);
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
    const cleanIndex = stepNames.indexOf('Clear stale TypeScript metadata');
    const compileIndex = stepNames.indexOf('Compile workspaces');
    const pluginsIndex = stepNames.indexOf('Download editor plugins');
    const packageIndex = stepNames.indexOf('Package desktop application');
    assert.ok(cleanIndex >= 0 && cleanIndex < compileIndex);
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
