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
import { TensorGridAuthServiceImpl } from './tensorgrid-auth-service-impl';

class MemoryKeyStore {
    private readonly values = new Map<string, string>();

    async getPassword(service: string, account: string): Promise<string | undefined> {
        return this.values.get(`${service}:${account}`);
    }

    async setPassword(service: string, account: string, value: string): Promise<void> {
        this.values.set(`${service}:${account}`, value);
    }

    async deletePassword(service: string, account: string): Promise<void> {
        this.values.delete(`${service}:${account}`);
    }
}

describe('TensorGrid auth service implementation', () => {
    let originalFetch: typeof globalThis.fetch;
    let keyStore: MemoryKeyStore;
    let service: TensorGridAuthServiceImpl;

    beforeEach(async () => {
        originalFetch = globalThis.fetch;
        keyStore = new MemoryKeyStore();
        service = new TensorGridAuthServiceImpl();
        (service as unknown as { keyStoreService: MemoryKeyStore }).keyStoreService = keyStore;
        await keyStore.setPassword('theia-tcode', 'tensorgrid-session', JSON.stringify({ apiKey: 'sk-abcd-valid' }));
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('accepts a stored API key after validating the model endpoint', async () => {
        globalThis.fetch = async (input, init) => {
            expect(String(input)).to.equal('https://api.tensorgrid.space/v1/models');
            expect(init?.headers).to.deep.include({ Authorization: 'Bearer sk-abcd-valid' });
            return new Response(JSON.stringify({ object: 'list', data: [] }), { status: 200 });
        };

        const state = await service.validateApiAccess();
        expect(state.isAuthenticated).to.equal(true);
    });

    it('discovers TensorGrid model IDs using the stored API key', async () => {
        globalThis.fetch = async (input, init) => {
            expect(String(input)).to.equal('https://api.tensorgrid.space/v1/models');
            expect(init?.headers).to.deep.include({ Authorization: 'Bearer sk-abcd-valid' });
            return new Response(JSON.stringify({ object: 'list', data: [{ id: 'tensorgrid/fast' }, { id: 'coder' }, { id: 'coder' }] }), { status: 200 });
        };

        expect(await service.getModelIds()).to.deep.equal(['tensorgrid/fast', 'coder']);
    });

    it('generates an authorization URL with the S256 PKCE method', async () => {
        const request = await service.beginLogin();
        const authorizationUrl = new URL(request.authorizationUrl);

        expect(authorizationUrl.origin).to.equal('https://tensorgrid.space');
        expect(authorizationUrl.pathname).to.equal('/tcode/authorize');
        expect(authorizationUrl.searchParams.get('client')).to.equal('tcode');
        expect(authorizationUrl.searchParams.get('code_challenge_method')).to.equal('S256');
        expect(authorizationUrl.searchParams.get('code_challenge')).to.be.a('string').and.not.empty;
        expect(authorizationUrl.searchParams.get('state')).to.equal(request.state);
        expect(authorizationUrl.searchParams.get('redirect_uri')).to.equal('tcode://tensorgrid/auth');
    });

    it('removes stored credentials when the API rejects the key', async () => {
        globalThis.fetch = async () => new Response('invalid key', { status: 401 });

        const state = await service.validateApiAccess();
        expect(state.isAuthenticated).to.equal(false);
        expect(await keyStore.getPassword('theia-tcode', 'tensorgrid-session')).to.equal(undefined);
    });

    it('rejects a callback with a mismatched PKCE state', async () => {
        await keyStore.setPassword('theia-tcode', 'tensorgrid-pending-login', JSON.stringify({ state: 'expected', codeVerifier: 'verifier' }));
        try {
            await service.completeLogin('tcode://tensorgrid/auth?code=code&state=wrong');
            expect.fail('expected callback validation to fail');
        } catch (error) {
            expect(error).to.be.instanceOf(Error);
            expect((error as Error).message).to.contain('state is invalid');
        }
    });
});
