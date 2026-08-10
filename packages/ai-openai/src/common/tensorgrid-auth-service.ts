/*****************************************************************************
 * Copyright (C) 2026 TensorGrid and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 *****************************************************************************/
import { Event } from '@theia/core';

export const TENSORGRID_AUTH_SERVICE_PATH = '/services/tensorgrid/auth';
export const TensorGridAuthService = Symbol('TensorGridAuthService');

export interface TensorGridAuthState {
    isAuthenticated: boolean;
    accountLabel?: string;
}

export interface TensorGridAuthRequest {
    authorizationUrl: string;
    state: string;
}

export interface TensorGridAuthService {
    beginLogin(): Promise<TensorGridAuthRequest>;
    completeLogin(url: string): Promise<TensorGridAuthState>;
    validateApiAccess(): Promise<TensorGridAuthState>;
    getAuthState(): Promise<TensorGridAuthState>;
    getApiKey(): Promise<string | undefined>;
    getModelIds(): Promise<string[]>;
    logout(): Promise<void>;
    readonly onAuthStateChanged: Event<TensorGridAuthState>;
}

export interface TensorGridAuthUrls {
    authorize: string;
    exchange: string;
    loginPage: string;
}

const TENSORGRID_WEB_ORIGIN = 'https://tensorgrid.space';

export function createTensorGridAuthUrls(_baseUrl: string): TensorGridAuthUrls {
    return {
        authorize: `${TENSORGRID_WEB_ORIGIN}/api/model-hub/tcode/authorize/`,
        exchange: `${TENSORGRID_WEB_ORIGIN}/api/model-hub/tcode/exchange/`,
        loginPage: TENSORGRID_LOGIN_URL
    };
}
export const TENSORGRID_LOGIN_URL = 'https://tensorgrid.space/tcode/authorize';

export const TENSORGRID_CALLBACK_URI = 'tcode://tensorgrid/auth';

export function createCodeVerifier(randomBytes: (length: number) => Uint8Array = length => crypto.getRandomValues(new Uint8Array(length))): string {
    return toBase64Url(randomBytes(32));
}

export async function createCodeChallenge(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return toBase64Url(new Uint8Array(digest));
}

export function toBase64Url(bytes: Uint8Array): string {
    let value = '';
    for (const byte of bytes) {
        value += String.fromCharCode(byte);
    }
    return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function redactTensorGridError(message: string): string {
    return message.replace(/(Bearer\s+)[^\s,]+/gi, '$1[redacted]');
}
