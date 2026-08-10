/*****************************************************************************
 * Copyright (C) 2026 TensorGrid and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 *****************************************************************************/
import { expect } from 'chai';
import URI from '@theia/core/lib/common/uri';
import { TensorGridAuthUriHandler } from './tensorgrid-auth-uri-handler';

describe('TensorGrid auth URI handler', () => {
    it('processes duplicate callback delivery only once', async () => {
        const handler = new TensorGridAuthUriHandler();
        let completeLoginCalls = 0;
        let successNotifications = 0;
        const authService = {
            completeLogin: async (callbackUrl: string): Promise<void> => {
                completeLoginCalls += 1;
                const parsed = new URL(callbackUrl);
                expect(parsed.searchParams.get('code')).to.equal('code');
                expect(parsed.searchParams.get('state')).to.equal('state');
            }
        };

        (handler as unknown as { authService: typeof authService }).authService = authService;
        (handler as unknown as { windowService: { focus: () => void } }).windowService = { focus: () => undefined };
        (handler as unknown as { startupGate: { notifyLoginResult: (result: { success: boolean }) => void } }).startupGate = {
            notifyLoginResult: result => {
                if (result.success) {
                    successNotifications += 1;
                }
            }
        };
        (handler as unknown as { messageService: { info: (message: string) => void; error: (message: string) => void } }).messageService = {
            info: () => undefined,
            error: message => {
                throw new Error(message);
            }
        };

        const callback = URI.fromComponents({
            scheme: 'tcode',
            authority: 'tensorgrid',
            path: '/auth',
            query: 'code=code&state=state',
            fragment: ''
        });
        await Promise.all([handler.open(callback), handler.open(callback)]);
        await handler.open(callback);

        expect(completeLoginCalls).to.equal(1);
        expect(successNotifications).to.equal(1);
    });
});
