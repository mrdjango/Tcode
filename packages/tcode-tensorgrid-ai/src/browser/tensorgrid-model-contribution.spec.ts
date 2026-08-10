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
import { TensorGridModelContribution } from './tensorgrid-model-contribution';

describe('Tcode model contribution', () => {
    it('registers models only after the auth service returns a credential', async () => {
        const created: Array<{ id: string; apiKey: string | undefined }> = [];
        const removed: string[][] = [];
        const contribution = new TensorGridModelContribution();
        (contribution as unknown as { manager: unknown }).manager = {
            createOrUpdateLanguageModels: async (...models: Array<{ id: string; apiKey: string | undefined }>) => {
                created.push(...models);
            },
            removeLanguageModels: (...ids: string[]) => removed.push(ids)
        };
        (contribution as unknown as { authService: unknown }).authService = {
            getAuthState: async () => ({ isAuthenticated: true }),
            getApiKey: async () => 'sk-test',
            getModelIds: async () => ['tensorgrid/fast']
        };
        (contribution as unknown as { preferenceService: unknown }).preferenceService = {
            get: (name: string, fallback: unknown) => name.endsWith('.enabled') ? true : fallback
        };

        await contribution.updateModels();

        expect(created).to.have.length(1);
        expect(created[0]).to.include({ id: 'tensorgrid/fast', apiKey: 'sk-test' });
        expect(removed).to.deep.equal([[]]);
    });

    it('removes registered models when authentication is no longer valid', async () => {
        const removed: string[][] = [];
        const contribution = new TensorGridModelContribution();
        (contribution as unknown as { manager: unknown }).manager = {
            createOrUpdateLanguageModels: async () => undefined,
            removeLanguageModels: (...ids: string[]) => removed.push(ids)
        };
        (contribution as unknown as { authService: unknown }).authService = {
            getAuthState: async () => ({ isAuthenticated: false })
        };
        (contribution as unknown as { preferenceService: unknown }).preferenceService = {
            get: (_name: string, fallback: unknown) => fallback
        };
        (contribution as unknown as { previousIds: string[] }).previousIds = ['fast'];

        await contribution.updateModels();

        expect(removed).to.deep.equal([['tensorgrid/fast']]);
    });
});
