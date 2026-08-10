/*****************************************************************************
 * Copyright (C) 2026 TensorGrid and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 *****************************************************************************/
import { OpenAiModelDescription } from './openai-language-models-manager';

export const TENSORGRID_DEFAULT_BASE_URL = 'https://api.tensorgrid.space/v1';

export const TENSORGRID_AUTH_PATHS = {
    authorize: '/api/model-hub/tcode/authorize/',
    exchange: '/api/model-hub/tcode/exchange/'
} as const;

export function normalizeTensorGridBaseUrl(url: string = TENSORGRID_DEFAULT_BASE_URL): string {
    return url.replace(/\/+$/, '');
}

export function createTensorGridModelDescription(
    model: string,
    baseUrl: string = TENSORGRID_DEFAULT_BASE_URL,
    apiKey?: string
): OpenAiModelDescription {
    const normalizedModel = model.replace(/^tensorgrid\//, '');
    return {
        id: `tensorgrid/${normalizedModel}`,
        model: normalizedModel,
        url: normalizeTensorGridBaseUrl(baseUrl),
        apiKey,
        apiVersion: undefined,
        maxRetries: 3,
        enableStreaming: true,
        supportsStructuredOutput: false,
        useResponseApi: false
    };
}
