/*****************************************************************************
 * Copyright (C) 2026 TensorGrid and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 *****************************************************************************/
import { MessageService, nls } from '@theia/core';
import URI from '@theia/core/lib/common/uri';
import { OpenHandler } from '@theia/core/lib/browser/opener-service';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { inject, injectable } from '@theia/core/shared/inversify';
import { TensorGridAuthService } from '../common';
import { TensorGridStartupGate } from './tensorgrid-startup-gate';

@injectable()
export class TensorGridAuthUriHandler implements OpenHandler {
    readonly id = 'tensorgrid-auth-uri-handler';
    protected readonly callbacksInProgress = new Map<string, Promise<void>>();
    protected readonly handledCallbacks = new Set<string>();

    @inject(TensorGridAuthService)
    protected readonly authService: TensorGridAuthService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @inject(TensorGridStartupGate)
    protected readonly startupGate: TensorGridStartupGate;

    canHandle(uri: URI): number {
        return uri.scheme === 'tcode' && uri.authority.toLowerCase() === 'tensorgrid' && uri.path.toString() === '/auth' ? 500 : 0;
    }

    async open(uri: URI): Promise<object | undefined> {
        this.windowService.focus();
        const callbackUrl = uri.toString(true);
        if (this.handledCallbacks.has(callbackUrl)) {
            return undefined;
        }
        const existingCallback = this.callbacksInProgress.get(callbackUrl);
        if (existingCallback) {
            await existingCallback;
            return undefined;
        }
        const callback = this.completeCallback(callbackUrl);
        this.callbacksInProgress.set(callbackUrl, callback);
        try {
            await callback;
            this.handledCallbacks.add(callbackUrl);
            this.startupGate.notifyLoginResult({ success: true });
            this.messageService.info(nls.localize('theia/ai/openai/tensorgrid/loginSucceeded', 'Signed in to TensorGrid.'));
        } catch (error) {
            this.startupGate.notifyLoginResult({ success: false, error: error instanceof Error ? error : new Error(String(error)) });
            this.messageService.error(nls.localize(
                'tcode/tensorgrid/loginFailed',
                'TensorGrid sign-in failed: {0}',
                error instanceof Error ? error.message : String(error)
            ));
        } finally {
            this.callbacksInProgress.delete(callbackUrl);
        }
        return undefined;
    }

    protected async completeCallback(callbackUrl: string): Promise<void> {
        await this.authService.completeLogin(callbackUrl);
    }
}
