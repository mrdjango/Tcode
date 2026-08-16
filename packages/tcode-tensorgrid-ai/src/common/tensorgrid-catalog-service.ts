import { Event } from '@theia/core';

export const TENSORGRID_CATALOG_SERVICE_PATH = '/services/tensorgrid/catalog';
export const TensorGridCatalogService = Symbol('TensorGridCatalogService');
export const TENSORGRID_OPENAI_BASE_URL = 'https://api.tensorgrid.space/v1';
export const TENSORGRID_GOOGLE_BASE_URL = 'https://api.tensorgrid.space';

export interface TensorGridCatalogModel {
    id: string;
    category: string;
    endpointTypes: string[];
    capabilities: Record<string, unknown>;
    displayName?: string;
    group?: {
        id: string;
        slug: string;
        name: string;
        ratio?: number;
    };
    ordering?: number;
}
export interface TensorGridAuthState { isAuthenticated: boolean; accountLabel?: string; expiresAt?: string; }
export interface TensorGridAuthRequest { authorizationUrl: string; }
export const TENSORGRID_CALLBACK_URI = 'tcode://tensorgrid/auth';
export const TENSORGRID_LOGIN_URL = 'https://tensorgrid.space/tcode/authorize';
export const TENSORGRID_EXCHANGE_URL = 'https://tensorgrid.space/api/model-hub/tcode/exchange/';
export const TENSORGRID_REVOKE_URL = 'https://tensorgrid.space/api/model-hub/tcode/revoke/';

export function createCodeVerifier(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function createCodeChallenge(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface TensorGridCatalogService {
    getCatalog(): Promise<TensorGridCatalogModel[]>;
    getApiKey(): Promise<string | undefined>;
    beginLogin(): Promise<TensorGridAuthRequest>;
    completeLogin(callbackUrl: string): Promise<TensorGridAuthState>;
    getAuthState(): Promise<TensorGridAuthState>;
    logout(): Promise<void>;
    readonly onAuthStateChanged: Event<TensorGridAuthState>;
}
