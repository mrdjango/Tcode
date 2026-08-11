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
