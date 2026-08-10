/*****************************************************************************
 * Copyright (C) 2026 TensorGrid and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 *****************************************************************************/
import { Emitter, Event } from '@theia/core';
import { injectable } from '@theia/core/shared/inversify';

export interface TensorGridStartupLoginResult {
    success: boolean;
    error?: Error;
}

@injectable()
export class TensorGridStartupGate {
    protected readonly resultEmitter = new Emitter<TensorGridStartupLoginResult>();
    readonly onLoginResult: Event<TensorGridStartupLoginResult> = this.resultEmitter.event;
    protected pendingResult: TensorGridStartupLoginResult | undefined;
    protected pendingLogin: Promise<TensorGridStartupLoginResult> | undefined;
    protected resolvePendingLogin: ((result: TensorGridStartupLoginResult) => void) | undefined;

    notifyLoginResult(result: TensorGridStartupLoginResult): void {
        if (this.resolvePendingLogin) {
            const resolve = this.resolvePendingLogin;
            this.resolvePendingLogin = undefined;
            this.pendingLogin = undefined;
            resolve(result);
        } else {
            this.pendingResult = result;
        }
        this.resultEmitter.fire(result);
    }

    waitForLogin(): Promise<TensorGridStartupLoginResult> {
        if (this.pendingResult) {
            const result = this.pendingResult;
            this.pendingResult = undefined;
            return Promise.resolve(result);
        }
        if (this.pendingLogin) {
            return this.pendingLogin;
        }
        this.pendingLogin = new Promise(resolve => {
            this.resolvePendingLogin = resolve;
        });
        return this.pendingLogin;
    }
}
