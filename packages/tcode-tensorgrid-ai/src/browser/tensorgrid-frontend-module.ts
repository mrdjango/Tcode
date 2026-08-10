/*****************************************************************************
 * Copyright (C) 2026 TensorGrid and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 *****************************************************************************/
import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, PreferenceContribution } from '@theia/core';
import { FrontendApplicationContribution, OpenHandler, RemoteConnectionProvider, ServiceConnectionProvider } from '@theia/core/lib/browser';
import { OpenAiLanguageModelsManager, OPENAI_LANGUAGE_MODELS_MANAGER_PATH } from '@theia/ai-openai/lib/common';
import { TensorGridAuthService, TENSORGRID_AUTH_SERVICE_PATH, TensorGridPreferencesSchema } from '../common';
import { TensorGridAuthUriHandler } from './tensorgrid-auth-uri-handler';
import { TensorGridCommandContribution } from './tensorgrid-command-contribution';
import { TensorGridModelContribution } from './tensorgrid-model-contribution';
import { TensorGridStartupContribution } from './tensorgrid-startup-contribution';
import { TensorGridStartupGate } from './tensorgrid-startup-gate';

export default new ContainerModule(bind => {
    bind(PreferenceContribution).toConstantValue({ schema: TensorGridPreferencesSchema });
    bind(TensorGridStartupGate).toSelf().inSingletonScope();
    bind(TensorGridStartupContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(TensorGridStartupContribution);
    bind(TensorGridModelContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(TensorGridModelContribution);
    bind(TensorGridAuthUriHandler).toSelf().inSingletonScope();
    bind(OpenHandler).toService(TensorGridAuthUriHandler);
    bind(TensorGridCommandContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(TensorGridCommandContribution);
    bind(OpenAiLanguageModelsManager).toDynamicValue(ctx => {
        const provider = ctx.container.get<ServiceConnectionProvider>(RemoteConnectionProvider);
        return provider.createProxy<OpenAiLanguageModelsManager>(OPENAI_LANGUAGE_MODELS_MANAGER_PATH);
    }).inSingletonScope();
    bind(TensorGridAuthService).toDynamicValue(ctx => {
        const provider = ctx.container.get<ServiceConnectionProvider>(RemoteConnectionProvider);
        return provider.createProxy<TensorGridAuthService>(TENSORGRID_AUTH_SERVICE_PATH);
    }).inSingletonScope();
});
