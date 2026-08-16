// *****************************************************************************
// Copyright (C) 2017 Ericsson and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import * as chai from 'chai';
import * as path from 'path';
import * as http from 'http';
import { AddressInfo } from 'net';
import { app, BrowserWindow } from 'electron';

const expect = chai.expect;

const electronExampleDir = path.resolve(__dirname, '..', '..', '..');

describe('basic-example-spec', function (): void {
    this.timeout(120_000);

    let server: http.Server | undefined;
    let mainWindow: BrowserWindow | undefined;

    after(async () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.destroy();
        }
        if (server) {
            await new Promise<void>(resolve => server!.close(() => resolve()));
        }
        // Remove all 'exit' listeners to prevent BackendApplication.onStop from
        // calling terminateProcessTree, which crashes Chromium's GPU process on shutdown.
        process.removeAllListeners('exit');
        process.exit(0);
    });

    it('should start the backend server', async () => {
        if (!app.isReady()) {
            await app.whenReady();
        }

        // Set the backend config before loading the server module, matching what main.js does
        const { BackendApplicationConfigProvider } = require('@theia/core/lib/node/backend-application-config-provider');
        BackendApplicationConfigProvider.set({
            singleInstance: false,
            configurationFolder: '.theia'
        });

        // eslint-disable-next-line import/no-dynamic-require
        const serverModule = require(path.join(electronExampleDir, 'src-gen', 'backend', 'server'));
        server = await serverModule(0, 'localhost');
        expect(server).to.not.be.undefined;

        const address = server!.address() as AddressInfo;
        expect(address).to.not.be.null;
        expect(address.port).to.be.a('number').and.to.be.greaterThan(0);
    });

    it('should load the frontend in an Electron window', async () => {
        expect(server).to.not.be.undefined;
        const address = server!.address() as AddressInfo;

        mainWindow = new BrowserWindow({
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(electronExampleDir, 'lib', 'frontend', 'preload.js')
            }
        });

        const url = `http://127.0.0.1:${address.port}`;
        await mainWindow.loadURL(url);

        const title = mainWindow.webContents.getTitle();
        expect(title).to.include('Tcode');

        const branding = await mainWindow.webContents.executeJavaScript(`new Promise(resolve => {
            const deadline = Date.now() + 30_000;
            const inspect = () => {
                const logo = document.querySelector('.theia-icon');
                const gateLogo = document.querySelector('.tensorgrid-auth-gate .tensorgrid-brand-mark');
                const visibleLogo = logo || gateLogo;
                if (visibleLogo || Date.now() >= deadline) {
                    resolve({
                        exists: !!visibleLogo,
                        navbarExists: !!logo,
                        backgroundImage: visibleLogo ? getComputedStyle(visibleLogo).backgroundImage : ''
                    });
                    return;
                }
                setTimeout(inspect, 50);
            };
            inspect();
        })`);

        expect(branding.exists).to.equal(true);
        expect(branding.backgroundImage).to.match(/data:image\/png;base64|url\(/);

        const authGate = await mainWindow.webContents.executeJavaScript(`new Promise(resolve => {
            const deadline = Date.now() + 30_000;
            const inspect = () => {
                const gate = document.querySelector('.tensorgrid-auth-gate');
                const shell = document.querySelector('.theia-ApplicationShell');
                if (gate || Date.now() >= deadline) {
                    resolve({
                        exists: !!gate,
                        locked: document.documentElement.classList.contains('tensorgrid-auth-locked'),
                        shellInert: !shell || shell.inert === true
                    });
                    return;
                }
                setTimeout(inspect, 50);
            };
            inspect();
        })`);

        expect(authGate.exists).to.equal(true);
        expect(authGate.locked).to.equal(true);
        expect(authGate.shellInert).to.equal(true);
    });
});
