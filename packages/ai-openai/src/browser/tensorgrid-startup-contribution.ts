/*****************************************************************************
 * Copyright (C) 2026 TensorGrid and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 *****************************************************************************/
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { inject, injectable } from '@theia/core/shared/inversify';
import { PreferenceService } from '@theia/core';
import { TensorGridAuthService } from '../common';
import { TCODE_BASE_URL_PREF, TCODE_ENABLED_PREF } from '../common/openai-preferences';
import { TensorGridStartupGate } from './tensorgrid-startup-gate';

@injectable()
export class TensorGridStartupContribution implements FrontendApplicationContribution {
    @inject(PreferenceService)
    protected readonly preferenceService: PreferenceService;

    @inject(TensorGridAuthService)
    protected readonly authService: TensorGridAuthService;

    @inject(TensorGridStartupGate)
    protected readonly startupGate: TensorGridStartupGate;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    onStart(): void {
        this.initializeAuthentication().catch(error => console.error('Failed to initialize Tcode authentication', error));
    }

    protected async initializeAuthentication(): Promise<void> {
        await this.preferenceService.ready;
        if (!this.preferenceService.get<boolean>(TCODE_ENABLED_PREF, true)) {
            return;
        }
        const baseUrl = this.preferenceService.get<string>(TCODE_BASE_URL_PREF, '');
        if (!this.isTensorGridBaseUrl(baseUrl)) {
            return;
        }

        const overlay = this.createOverlay();
        try {
            while (true) {
                try {
                    const state = await this.authService.validateApiAccess();
                    if (state.isAuthenticated) {
                        return;
                    }
                } catch (error) {
                    this.setOverlayMessage(overlay, error instanceof Error ? error.message : String(error));
                    await this.waitForRetry(overlay);
                    continue;
                }

                try {
                    this.setOverlayMessage(overlay, 'Sign in to TensorGrid to continue.');
                    const request = await this.authService.beginLogin();
                    this.startLogin(request.authorizationUrl);
                    const result = await this.startupGate.waitForLogin();
                    if (result.success) {
                        const validated = await this.authService.validateApiAccess();
                        if (validated.isAuthenticated) {
                            return;
                        }
                    }
                    this.setOverlayMessage(overlay, result.error?.message || 'TensorGrid sign-in could not be verified.');
                } catch (error) {
                    this.setOverlayMessage(overlay, error instanceof Error ? error.message : String(error));
                }
                await this.waitForRetry(overlay);
            }
        } finally {
            overlay.remove();
        }
    }

    protected startLogin(authorizationUrl: string): Promise<void> {
        this.windowService.openNewWindow(authorizationUrl, { external: true });
        return Promise.resolve();
    }

    protected isTensorGridBaseUrl(baseUrl: string): boolean {
        try {
            return new URL(baseUrl).origin === 'https://api.tensorgrid.space';
        } catch {
            return false;
        }
    }

    protected createOverlay(): HTMLDivElement {
        const overlay = document.createElement('div');
        overlay.style.cssText = [
            'position: fixed', 'inset: 0', 'z-index: 10000', 'display: flex', 'align-items: center',
            'justify-content: center', 'background: #1e1e1e', 'color: #f5f5f5', 'font-family: sans-serif'
        ].join(';');
        document.body.appendChild(overlay);
        return overlay;
    }

    protected setOverlayMessage(overlay: HTMLDivElement, message: string): void {
        overlay.innerHTML = '';
        const panel = document.createElement('div');
        panel.style.cssText = 'max-width: 420px; padding: 32px; text-align: center';
        const title = document.createElement('h1');
        title.textContent = 'Tcode';
        const text = document.createElement('p');
        text.textContent = message;
        panel.append(title, text);
        overlay.appendChild(panel);
    }

    protected waitForRetry(overlay: HTMLDivElement): Promise<void> {
        return new Promise(resolve => {
            const button = document.createElement('button');
            button.textContent = 'Retry sign-in';
            button.onclick = () => {
                button.remove();
                resolve();
            };
            overlay.firstElementChild?.appendChild(button);
        });
    }
}
