import { Emitter, Event } from '@theia/core';
import { KeyStoreService } from '@theia/core/lib/common/key-store';
import { inject, injectable } from '@theia/core/shared/inversify';
import { createCodeChallenge, createCodeVerifier, TensorGridAuthRequest, TensorGridAuthState, TensorGridCatalogModel, TensorGridCatalogService, TENSORGRID_CALLBACK_URI, TENSORGRID_LOGIN_URL, TENSORGRID_OPENAI_BASE_URL } from '../common';

interface StoredCredentials { apiKey: string; accountLabel?: string; }
interface PendingLogin { state: string; codeVerifier: string; }
interface CatalogResponse {
    object?: string;
    data?: Array<{
        id?: unknown;
        tensorgrid?: {
            display_name?: unknown;
            category?: unknown;
            endpoint_types?: unknown;
            capabilities?: unknown;
            group?: unknown;
            ordering?: unknown;
        };
    }>;
}
const KEYSTORE_SERVICE = 'theia-tcode';
const KEYSTORE_ACCOUNT = 'tensorgrid-session';
const KEYSTORE_PENDING_ACCOUNT = 'tensorgrid-pending-login';

const nonEmptyString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

export function parseTensorGridCatalogResponse(
    payload: unknown,
    warn: (message: string) => void = message => console.warn(message),
): TensorGridCatalogModel[] {
    const response = payload as CatalogResponse;
    if (response?.object !== 'list' || !Array.isArray(response.data)) {
        throw new Error('TensorGrid returned an invalid model catalog.');
    }
    return response.data.flatMap(row => {
        const metadata = row.tensorgrid;
        const id = nonEmptyString(row.id) ?? '';
        if (!id || !metadata || typeof metadata.category !== 'string' || !Array.isArray(metadata.endpoint_types)
            || !metadata.endpoint_types.every(value => typeof value === 'string')
            || typeof metadata.capabilities !== 'object' || metadata.capabilities === null) {
            warn(`TensorGrid: skipping '${id || 'unknown'}' because catalog metadata is invalid.`);
            return [];
        }
        const model: TensorGridCatalogModel = {
            id,
            category: metadata.category,
            endpointTypes: metadata.endpoint_types,
            capabilities: metadata.capabilities as Record<string, unknown>,
        };
        const displayName = nonEmptyString(metadata.display_name);
        if (displayName) {
            model.displayName = displayName;
        } else if (metadata.display_name !== undefined) {
            warn(`TensorGrid: ignoring invalid display name for '${id}'.`);
        }
        if (metadata.group !== undefined) {
            const group = metadata.group as { id?: unknown; slug?: unknown; name?: unknown; ratio?: unknown };
            const groupId = nonEmptyString(group?.id);
            const slug = nonEmptyString(group?.slug);
            const name = nonEmptyString(group?.name);
            if (groupId && slug && name) {
                model.group = { id: groupId, slug, name };
                if (group.ratio !== undefined && group.ratio !== null) {
                    const ratio = typeof group.ratio === 'number' ? group.ratio : Number(group.ratio);
                    if (Number.isFinite(ratio) && ratio >= 0) {
                        model.group.ratio = ratio;
                    } else {
                        warn(`TensorGrid: ignoring invalid group ratio for '${id}'.`);
                    }
                }
            } else {
                warn(`TensorGrid: ignoring invalid group metadata for '${id}'.`);
            }
        }
        if (metadata.ordering !== undefined && metadata.ordering !== null) {
            if (typeof metadata.ordering === 'number' && Number.isInteger(metadata.ordering) && metadata.ordering >= 0) {
                model.ordering = metadata.ordering;
            } else {
                warn(`TensorGrid: ignoring invalid ordering for '${id}'.`);
            }
        }
        return [model];
    });
}

@injectable()
export class TensorGridCatalogServiceImpl implements TensorGridCatalogService {
    @inject(KeyStoreService) protected readonly keyStoreService: KeyStoreService;
    protected readonly authChanged = new Emitter<TensorGridAuthState>();
    readonly onAuthStateChanged: Event<TensorGridAuthState> = this.authChanged.event;

    async getApiKey(): Promise<string | undefined> {
        const raw = await this.keyStoreService.getPassword(KEYSTORE_SERVICE, KEYSTORE_ACCOUNT);
        if (!raw) { return undefined; }
        try { return (JSON.parse(raw) as StoredCredentials).apiKey; } catch { return undefined; }
    }

    async beginLogin(): Promise<TensorGridAuthRequest> {
        const codeVerifier = createCodeVerifier();
        const state = createCodeVerifier();
        const codeChallenge = await createCodeChallenge(codeVerifier);
        await this.keyStoreService.setPassword(KEYSTORE_SERVICE, KEYSTORE_PENDING_ACCOUNT, JSON.stringify({ state, codeVerifier } satisfies PendingLogin));
        const url = new URL(TENSORGRID_LOGIN_URL);
        url.searchParams.set('client', 'tcode'); url.searchParams.set('code_challenge', codeChallenge);
        url.searchParams.set('code_challenge_method', 'S256'); url.searchParams.set('state', state); url.searchParams.set('redirect_uri', TENSORGRID_CALLBACK_URI);
        return { authorizationUrl: url.toString() };
    }

    async completeLogin(callbackUrl: string): Promise<TensorGridAuthState> {
        const callback = new URL(callbackUrl);
        if (callback.protocol !== 'tcode:' || callback.hostname.toLowerCase() !== 'tensorgrid' || callback.pathname !== '/auth') throw new Error('Unexpected TensorGrid authentication callback.');
        const pendingRaw = await this.keyStoreService.getPassword(KEYSTORE_SERVICE, KEYSTORE_PENDING_ACCOUNT);
        const pending = pendingRaw ? JSON.parse(pendingRaw) as PendingLogin : undefined;
        const code = callback.searchParams.get('code'); const state = callback.searchParams.get('state');
        if (!code || !pending || state !== pending.state) throw new Error('TensorGrid authentication state is invalid or expired.');
        const response = await fetch('https://tensorgrid.space/api/model-hub/tcode/exchange/', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ code, code_verifier: pending.codeVerifier }) });
        await this.keyStoreService.deletePassword(KEYSTORE_SERVICE, KEYSTORE_PENDING_ACCOUNT);
        if (!response.ok) throw new Error(`TensorGrid sign-in failed (${response.status}).`);
        const data = await response.json() as { token?: string; user?: { email?: string } };
        if (!data.token?.startsWith('sk-')) throw new Error('TensorGrid authentication did not return a usable API key.');
        await this.keyStoreService.setPassword(KEYSTORE_SERVICE, KEYSTORE_ACCOUNT, JSON.stringify({ apiKey: data.token, accountLabel: data.user?.email } satisfies StoredCredentials));
        const result = { isAuthenticated: true, accountLabel: data.user?.email };
        this.authChanged.fire(result); return result;
    }

    async getAuthState(): Promise<TensorGridAuthState> {
        const raw = await this.keyStoreService.getPassword(KEYSTORE_SERVICE, KEYSTORE_ACCOUNT);
        if (!raw) return { isAuthenticated: false };
        try { const value = JSON.parse(raw) as StoredCredentials; return { isAuthenticated: !!value.apiKey, accountLabel: value.accountLabel }; } catch { return { isAuthenticated: false }; }
    }

    async getCatalog(): Promise<TensorGridCatalogModel[]> {
        const apiKey = await this.getApiKey();
        if (!apiKey) { return []; }
        const response = await fetch(`${TENSORGRID_OPENAI_BASE_URL}/models`, { headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` } });
        if (response.status === 401 || response.status === 403) {
            await this.logout();
            throw new Error('TensorGrid authentication expired.');
        }
        if (!response.ok) { throw new Error(`TensorGrid catalog request failed (${response.status}).`); }
        return parseTensorGridCatalogResponse(await response.json());
    }

    async logout(): Promise<void> {
        await this.keyStoreService.deletePassword(KEYSTORE_SERVICE, KEYSTORE_ACCOUNT);
        await this.keyStoreService.deletePassword(KEYSTORE_SERVICE, KEYSTORE_PENDING_ACCOUNT);
        this.authChanged.fire({ isAuthenticated: false });
    }
}
