import { expect } from 'chai';
import { TensorGridAuthState, TENSORGRID_EXCHANGE_URL } from '../common';
import { parseTensorGridCatalogResponse, TensorGridCatalogServiceImpl } from './tensorgrid-catalog-service-impl';

const key = (service: string, account: string): string => `${service}:${account}`;

function createService(): { service: TensorGridCatalogServiceImpl; values: Map<string, string> } {
    const values = new Map<string, string>();
    const service = new TensorGridCatalogServiceImpl() as unknown as {
        keyStoreService: {
            getPassword(service: string, account: string): Promise<string | undefined>;
            setPassword(service: string, account: string, password: string): Promise<void>;
            deletePassword(service: string, account: string): Promise<void>;
        };
    };
    service.keyStoreService = {
        getPassword: async (serviceName, account) => values.get(key(serviceName, account)),
        setPassword: async (serviceName, account, password) => { values.set(key(serviceName, account), password); },
        deletePassword: async (serviceName, account) => { values.delete(key(serviceName, account)); },
    };
    return { service: service as unknown as TensorGridCatalogServiceImpl, values };
}

describe('TensorGrid catalog selector metadata', () => {
    it('parses complete grouping and ordering metadata', () => {
        const result = parseTensorGridCatalogResponse({
            object: 'list',
            data: [{
                id: 'tg-go:codex:gpt-5-6-sol',
                tensorgrid: {
                    display_name: 'GPT 5.6 Sol',
                    category: 'language',
                    endpoint_types: ['responses'],
                    capabilities: { tools: true },
                    group: { id: 'tg-go:codex', slug: 'codex', name: 'CodexPro', ratio: '0.200' },
                    ordering: 3,
                },
            }],
        });

        expect(result).to.deep.equal([{
            id: 'tg-go:codex:gpt-5-6-sol',
            category: 'language',
            endpointTypes: ['responses'],
            capabilities: { tools: true },
            displayName: 'GPT 5.6 Sol',
            group: { id: 'tg-go:codex', slug: 'codex', name: 'CodexPro', ratio: 0.2 },
            ordering: 3,
        }]);
    });

    it('keeps older routable catalog entries without selector metadata', () => {
        const result = parseTensorGridCatalogResponse({
            object: 'list',
            data: [{
                id: 'tg-go:auto:gpt',
                tensorgrid: { category: 'language', endpoint_types: ['chat.completions'], capabilities: {} },
            }],
        });

        expect(result).to.deep.equal([{
            id: 'tg-go:auto:gpt',
            category: 'language',
            endpointTypes: ['chat.completions'],
            capabilities: {},
        }]);
    });

    it('drops invalid optional ratio and ordering without dropping a routable model', () => {
        const result = parseTensorGridCatalogResponse({
            object: 'list',
            data: [{
                id: 'tg-go:codex:gpt',
                tensorgrid: {
                    display_name: 'GPT',
                    category: 'language',
                    endpoint_types: ['responses'],
                    capabilities: {},
                    group: { id: 'tg-go:codex', slug: 'codex', name: 'Codex', ratio: '-0.2x' },
                    ordering: 1.5,
                },
            }],
        });

        expect(result).to.have.length(1);
        expect(result[0].group).to.deep.equal({ id: 'tg-go:codex', slug: 'codex', name: 'Codex' });
        expect(result[0].ordering).to.equal(undefined);
    });
});

describe('TensorGrid desktop credentials', () => {
    it('accepts only a scoped, non-expired exchange response and clears the pending login', async () => {
        const { service, values } = createService();
        values.set(key('theia-tcode', 'tensorgrid-pending-login'), JSON.stringify({
            state: 's'.repeat(32),
            codeVerifier: 'v'.repeat(43),
        }));
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async input => {
            expect(String(input)).to.equal(TENSORGRID_EXCHANGE_URL);
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    id: 'key-1',
                    token: 'sk-prefix-secret',
                    scopes: ['inference:invoke'],
                    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    user: { email: 'user@tensorgrid.space' },
                }),
            } as Response;
        };
        try {
            const state: TensorGridAuthState = await service.completeLogin(
                'tcode://tensorgrid/auth?code=' + 'c'.repeat(43) + '&state=' + 's'.repeat(32),
            );
            expect(state.isAuthenticated).to.equal(true);
            expect(state.accountLabel).to.equal('user@tensorgrid.space');
            expect(await service.getApiKey()).to.equal('sk-prefix-secret');
            expect(values.has(key('theia-tcode', 'tensorgrid-pending-login'))).to.equal(false);
        } finally {
            globalThis.fetch = previousFetch;
        }
    });

    it('does not treat an expired stored credential as authenticated', async () => {
        const { service, values } = createService();
        values.set(key('theia-tcode', 'tensorgrid-session'), JSON.stringify({
            apiKey: 'sk-prefix-secret',
            keyId: 'key-1',
            scopes: ['inference:invoke'],
            expiresAt: new Date(Date.now() - 1000).toISOString(),
        }));

        expect(await service.getApiKey()).to.equal(undefined);
        expect(await service.getAuthState()).to.deep.equal({ isAuthenticated: false });
    });

    it('validates state before accepting a cancelled browser callback', async () => {
        const { service, values } = createService();
        values.set(key('theia-tcode', 'tensorgrid-pending-login'), JSON.stringify({
            state: 's'.repeat(32),
            codeVerifier: 'v'.repeat(43),
        }));

        try {
            await service.completeLogin('tcode://tensorgrid/auth?error=access_denied&state=' + 'x'.repeat(32));
            expect.fail('expected a state validation error');
        } catch (error) {
            expect(error).to.be.instanceOf(Error);
            expect((error as Error).message).to.contain('state is invalid');
        }
        expect(values.has(key('theia-tcode', 'tensorgrid-pending-login'))).to.equal(true);

        try {
            await service.completeLogin('tcode://tensorgrid/auth?error=access_denied&state=' + 's'.repeat(32));
            expect.fail('expected a cancellation error');
        } catch (error) {
            expect((error as Error).message).to.contain('cancelled');
        }
        expect(values.has(key('theia-tcode', 'tensorgrid-pending-login'))).to.equal(false);
    });
});
