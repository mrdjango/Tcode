import { Emitter, Event } from '@theia/core';
import { KeyStoreService } from '@theia/core/lib/common/key-store';
import { inject, injectable } from '@theia/core/shared/inversify';
import { createCodeChallenge, createCodeVerifier, TensorGridAuthRequest, TensorGridAuthState, TensorGridCatalogModel, TensorGridCatalogService, TENSORGRID_CALLBACK_URI, TENSORGRID_EXCHANGE_URL, TENSORGRID_LOGIN_URL, TENSORGRID_OPENAI_BASE_URL, TENSORGRID_REVOKE_URL } from '../common';

interface StoredCredentials { apiKey: string; accountLabel?: string; keyId?: string; scopes?: string[]; expiresAt?: string; }
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
const REVOKE_TIMEOUT_MS = 5_000;

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
        const credentials = await this.readCredentials();
        if (!credentials || !this.isCredentialUsable(credentials)) { return undefined; }
        return credentials.apiKey;
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
        let pending: PendingLogin | undefined;
        try { pending = pendingRaw ? JSON.parse(pendingRaw) as PendingLogin : undefined; } catch { pending = undefined; }
        const state = callback.searchParams.get('state');
        if (!pending || state !== pending.state) throw new Error('TensorGrid authentication state is invalid or expired.');
        const callbackError = callback.searchParams.get('error');
        if (callbackError) {
            try { await this.keyStoreService.deletePassword(KEYSTORE_SERVICE, KEYSTORE_PENDING_ACCOUNT); } catch { /* best effort cleanup */ }
            throw new Error(callbackError === 'access_denied' ? 'TensorGrid authorization was cancelled.' : 'TensorGrid authorization failed.');
        }
        const code = callback.searchParams.get('code');
        if (!code) throw new Error('TensorGrid authentication state is invalid or expired.');
        try {
            const response = await fetch(TENSORGRID_EXCHANGE_URL, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ code, code_verifier: pending.codeVerifier }) });
            if (!response.ok) {
                throw new Error(response.status === 400 ? 'The TensorGrid authorization code is invalid or expired.' : `TensorGrid sign-in failed (${response.status}).`);
            }
            const data = await response.json() as { id?: unknown; token?: unknown; scopes?: unknown; expires_at?: unknown; user?: { email?: unknown } };
            const token = typeof data.token === 'string' ? data.token : undefined;
            const keyId = typeof data.id === 'string' && data.id ? data.id : undefined;
            const scopes = Array.isArray(data.scopes) && data.scopes.every(scope => typeof scope === 'string') ? data.scopes as string[] : undefined;
            const expiresAt = typeof data.expires_at === 'string' && data.expires_at ? data.expires_at : undefined;
            const accountLabel = typeof data.user?.email === 'string' && data.user.email ? data.user.email : undefined;
            if (!token || !/^sk-[A-Za-z0-9_-]+-[A-Za-z0-9_-]+$/.test(token) || !keyId || !scopes?.includes('inference:invoke') || !expiresAt || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
                throw new Error('TensorGrid authentication did not return a valid scoped credential.');
            }
            await this.keyStoreService.setPassword(KEYSTORE_SERVICE, KEYSTORE_ACCOUNT, JSON.stringify({ apiKey: token, keyId, scopes, expiresAt, accountLabel } satisfies StoredCredentials));
            const result = { isAuthenticated: true, accountLabel, expiresAt };
            this.authChanged.fire(result); return result;
        } finally {
            try { await this.keyStoreService.deletePassword(KEYSTORE_SERVICE, KEYSTORE_PENDING_ACCOUNT); } catch { /* best effort cleanup */ }
        }
    }

    async getAuthState(): Promise<TensorGridAuthState> {
        const credentials = await this.readCredentials();
        if (!credentials || !this.isCredentialUsable(credentials)) return { isAuthenticated: false };
        return { isAuthenticated: true, accountLabel: credentials.accountLabel, expiresAt: credentials.expiresAt };
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
        let credentials: StoredCredentials | undefined;
        try { credentials = await this.readCredentials(); } catch { /* local cleanup still takes priority */ }
        if (credentials && this.isCredentialShapeValid(credentials)) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), REVOKE_TIMEOUT_MS);
            try {
                await fetch(TENSORGRID_REVOKE_URL, { method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${credentials.apiKey}` }, signal: controller.signal });
            } catch {
                // Local sign-out must complete even when the network is unavailable.
            } finally {
                clearTimeout(timeout);
            }
        }
        await Promise.allSettled([
            this.keyStoreService.deletePassword(KEYSTORE_SERVICE, KEYSTORE_ACCOUNT),
            this.keyStoreService.deletePassword(KEYSTORE_SERVICE, KEYSTORE_PENDING_ACCOUNT),
        ]);
        this.authChanged.fire({ isAuthenticated: false });
    }

    protected async readCredentials(): Promise<StoredCredentials | undefined> {
        const raw = await this.keyStoreService.getPassword(KEYSTORE_SERVICE, KEYSTORE_ACCOUNT);
        if (!raw) { return undefined; }
        try {
            const value = JSON.parse(raw) as StoredCredentials;
            return this.isCredentialShapeValid(value) ? value : undefined;
        } catch { return undefined; }
    }

    protected isCredentialShapeValid(value: StoredCredentials): boolean {
        return typeof value.apiKey === 'string' && /^sk-[A-Za-z0-9_-]+-[A-Za-z0-9_-]+$/.test(value.apiKey);
    }

    protected isCredentialUsable(value: StoredCredentials): boolean {
        if (!this.isCredentialShapeValid(value)) { return false; }
        return typeof value.expiresAt === 'string' && Number.isFinite(Date.parse(value.expiresAt)) && Date.parse(value.expiresAt) > Date.now();
    }
}
