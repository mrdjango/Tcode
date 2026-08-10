/*****************************************************************************
 * Copyright (C) 2026 TensorGrid and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 *****************************************************************************/
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { PreferenceService } from '@theia/core';
import { inject, injectable } from '@theia/core/shared/inversify';
import { OpenAiLanguageModelsManager } from '@theia/ai-openai/lib/common';
import { createTensorGridModelDescription, TensorGridAuthService } from '../common';
import { TCODE_BASE_URL_PREF, TCODE_ENABLED_PREF, TCODE_MODELS_PREF } from '../common/tensorgrid-preferences';

@injectable()
export class TensorGridModelContribution implements FrontendApplicationContribution {
    @inject(OpenAiLanguageModelsManager)
    protected readonly manager: OpenAiLanguageModelsManager;

    @inject(TensorGridAuthService)
    protected readonly authService: TensorGridAuthService;

    @inject(PreferenceService)
    protected readonly preferenceService: PreferenceService;

    protected previousIds: string[] = [];

    onStart(): void {
        this.preferenceService.ready.then(() => this.updateModels()).catch(error => console.error('Failed to initialize Tcode models', error));
        this.authService.onAuthStateChanged(() => this.updateModels().catch(error => console.error('Failed to refresh Tcode models', error)));
        this.preferenceService.onPreferenceChanged(event => {
            if ([TCODE_ENABLED_PREF, TCODE_BASE_URL_PREF, TCODE_MODELS_PREF].includes(event.preferenceName)) {
                this.updateModels().catch(error => console.error('Failed to refresh Tcode models', error));
            }
        });
    }

    async updateModels(): Promise<void> {
        const enabled = this.preferenceService.get<boolean>(TCODE_ENABLED_PREF, true);
        const oldIds = this.previousIds.map(id => `tensorgrid/${id}`);
        if (!enabled) {
            this.manager.removeLanguageModels(...oldIds);
            this.previousIds = [];
            return;
        }

        const authState = await this.authService.getAuthState();
        if (!authState.isAuthenticated) {
            this.manager.removeLanguageModels(...oldIds);
            this.previousIds = [];
            return;
        }

        const apiKey = await this.authService.getApiKey();
        const configuredModels = this.preferenceService.get<string[]>(TCODE_MODELS_PREF, []);
        const discoveredModels = configuredModels.length > 0 ? configuredModels : await this.authService.getModelIds();
        const modelIds = discoveredModels.map(id => id.replace(/^tensorgrid\//, ''))
            .filter((id, index, ids) => id.length > 0 && ids.indexOf(id) === index);
        const baseUrl = this.preferenceService.get<string>(TCODE_BASE_URL_PREF);
        const models = modelIds.map(model => createTensorGridModelDescription(model, baseUrl, apiKey));
        const currentIds = new Set(modelIds.map(id => `tensorgrid/${id}`));
        this.manager.removeLanguageModels(...oldIds.filter(id => !currentIds.has(id)));
        await this.manager.createOrUpdateLanguageModels(...models);
        this.previousIds = modelIds;
    }
}
