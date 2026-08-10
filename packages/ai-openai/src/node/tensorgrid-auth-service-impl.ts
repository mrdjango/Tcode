/*****************************************************************************
 * Copyright (C) 2026 TensorGrid and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 *****************************************************************************/
import { inject, injectable } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core';
import { KeyStoreService } from '@theia/core/lib/common/key-store';
import {
    TensorGridAuthRequest, TensorGridAuthService, TensorGridAuthState, TENSORGRID_CALLBACK_URI, TENSORGRID_LOGIN_URL,
    createCodeChallenge, createCodeVerifier, createTensorGridAuthUrls, redactTensorGridError
} from '../common';

interface StoredCredentials {
    apiKey: string;
    accountLabel?: string;
}

interface PendingLogin {
    state: string;
    codeVerifier: string;
}

const KEYSTORE_SERVICE = 'theia-tcode';
const KEYSTORE_ACCOUNT = 'tensorgrid-session';
const KEYSTORE_PENDING_ACCOUNT = 'tensorgrid-pending-login';
const DEFAULT_BASE_URL = 'https://api.tensorgrid.space/v1';

@injectable()
export class TensorGridAuthServiceImpl implements TensorGridAuthService {
    @inject(KeyStoreService)
    protected readonly keyStoreService: KeyStoreService;

    protected readonly onAuthStateChangedEmitter = new Emitter<TensorGridAuthState>();
    readonly onAuthStateChanged: Event<TensorGridAuthState> = this.onAuthStateChangedEmitter.event;

    protected async readCredentials(): Promise<StoredCredentials | undefined> {
        const value = await this.keyStoreService.getPassword(KEYSTORE_SERVICE, KEYSTORE_ACCOUNT);
        return value ? JSON.parse(value) as StoredCredentials : undefined;
    }

    async beginLogin(): Promise<TensorGridAuthRequest> {
        const codeVerifier = createCodeVerifier();
        const state = createCodeVerifier();
        const codeChallenge = await createCodeChallenge(codeVerifier);
        await this.keyStoreService.setPassword(KEYSTORE_SERVICE, KEYSTORE_PENDING_ACCOUNT, JSON.stringify({ state, codeVerifier } satisfies PendingLogin));
        const loginUrl = new URL(TENSORGRID_LOGIN_URL);
        loginUrl.searchParams.set('client', 'tcode');
        loginUrl.searchParams.set('code_challenge', codeChallenge);
        loginUrl.searchParams.set('code_challenge_method', 'S256');
        loginUrl.searchParams.set('state', state);
        loginUrl.searchParams.set('redirect_uri', TENSORGRID_CALLBACK_URI);
        return { authorizationUrl: loginUrl.toString(), state };
    }

    async completeLogin(callbackUrl: string): Promise<TensorGridAuthState> {
        const callback = new URL(callbackUrl);
        if (callback.protocol !== 'tcode:' || callback.hostname.toLowerCase() !== 'tensorgrid' || callback.pathname !== '/auth') {
            throw new Error('Unexpected TensorGrid authentication callback.');
        }
        const code = callback.searchParams.get('code');
        const state = callback.searchParams.get('state');
        const pendingValue = await this.keyStoreService.getPassword(KEYSTORE_SERVICE, KEYSTORE_PENDING_ACCOUNT);
        const pending = pendingValue ? JSON.parse(pendingValue) as PendingLogin : undefined;
        if (!code || !state || !pending || state !== pending.state) {
            throw new Error('TensorGrid authentication state is invalid or expired.');
        }
        const response = await fetch(createTensorGridAuthUrls(DEFAULT_BASE_URL).exchange, {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, code_verifier: pending.codeVerifier })
        });
        await this.keyStoreService.deletePassword(KEYSTORE_SERVICE, KEYSTORE_PENDING_ACCOUNT);
        if (!response.ok) {
            throw new Error(redactTensorGridError(await response.text()));
        }
        const data = await response.json() as { token?: string; user?: { email?: string } };
        if (!data.token || !data.token.startsWith('sk-')) {
            throw new Error('TensorGrid authentication did not return a usable API key.');
        }
        await this.validateApiAccessKey(data.token);
        await this.keyStoreService.setPassword(KEYSTORE_SERVICE, KEYSTORE_ACCOUNT, JSON.stringify({
            apiKey: data.token,
            accountLabel: data.user?.email
        } satisfies StoredCredentials));
        return this.updateState({ isAuthenticated: true, accountLabel: data.user?.email });
    }

    async getAuthState(): Promise<TensorGridAuthState> {
        return this.validateApiAccess();
    }

    async validateApiAccess(): Promise<TensorGridAuthState> {
        const credentials = await this.readCredentials();
        if (!credentials) {
            return this.updateState({ isAuthenticated: false });
        }
        try {
            await this.validateApiAccessKey(credentials.apiKey);
            return this.updateState({ isAuthenticated: true, accountLabel: credentials.accountLabel });
        } catch (error) {
            if (error instanceof TensorGridApiAuthenticationError) {
                await this.keyStoreService.deletePassword(KEYSTORE_SERVICE, KEYSTORE_ACCOUNT);
                this.updateState({ isAuthenticated: false });
                return { isAuthenticated: false };
            }
            throw error;
        }
    }

    async getApiKey(): Promise<string | undefined> {
        return (await this.readCredentials())?.apiKey;
    }

    async getModelIds(): Promise<string[]> {
        const credentials = await this.readCredentials();
        if (!credentials) {
            return [];
        }
        const response = await fetch(`${DEFAULT_BASE_URL}/models`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${credentials.apiKey}` }
        });
        if (!response.ok) {
            throw new Error(redactTensorGridError(await response.text()));
        }
        const data = await response.json() as { object?: string; data?: Array<{ id?: unknown }> };
        if (data.object !== 'list' || !Array.isArray(data.data)) {
            throw new Error('TensorGrid API returned an invalid model list.');
        }
        return data.data
            .map(model => typeof model.id === 'string' ? model.id.trim() : '')
            .filter((id, index, ids) => id.length > 0 && ids.indexOf(id) === index);
    }

    async logout(): Promise<void> {
        await this.keyStoreService.deletePassword(KEYSTORE_SERVICE, KEYSTORE_ACCOUNT);
        await this.keyStoreService.deletePassword(KEYSTORE_SERVICE, KEYSTORE_PENDING_ACCOUNT);
        this.updateState({ isAuthenticated: false });
    }

    protected async validateApiAccessKey(apiKey: string): Promise<void> {
        const response = await fetch(`${DEFAULT_BASE_URL}/models`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` }
        });
        if (!response.ok) {
            const detail = redactTensorGridError(await response.text());
            if (response.status === 401 || response.status === 403) {
                throw new TensorGridApiAuthenticationError(detail);
            }
            throw new Error(detail);
        }
        const data = await response.json() as { object?: string; data?: unknown };
        if (data.object !== 'list' || !Array.isArray(data.data)) {
            throw new Error('TensorGrid API returned an invalid model list.');
        }
    }

    protected updateState(state: TensorGridAuthState): TensorGridAuthState {
        this.onAuthStateChangedEmitter.fire(state);
        return state;
    }
}

class TensorGridApiAuthenticationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TensorGridApiAuthenticationError';
    }
}
