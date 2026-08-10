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
}
export interface TensorGridAuthState { isAuthenticated: boolean; accountLabel?: string; }
export interface TensorGridAuthRequest { authorizationUrl: string; }
export const TENSORGRID_CALLBACK_URI = 'tcode://tensorgrid/auth';
export const TENSORGRID_LOGIN_URL = 'https://tensorgrid.space/tcode/authorize';

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
