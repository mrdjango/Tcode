// *****************************************************************************
// Copyright (C) 2024 EclipseSource GmbH.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { ContainerModule } from '@theia/core/shared/inversify';
import { OpenAiPreferencesSchema } from '../common/openai-preferences';
import { FrontendApplicationContribution, OpenHandler, RemoteConnectionProvider, ServiceConnectionProvider } from '@theia/core/lib/browser';
import { OpenAiFrontendApplicationContribution } from './openai-frontend-application-contribution';
import {
    OPENAI_LANGUAGE_MODELS_MANAGER_PATH,
    OpenAiLanguageModelsManager,
    TENSORGRID_AUTH_SERVICE_PATH,
    TensorGridAuthService
} from '../common';
import { CommandContribution, PreferenceContribution } from '@theia/core';
import { TensorGridAuthUriHandler } from './tensorgrid-auth-uri-handler';
import { TensorGridCommandContribution } from './tensorgrid-command-contribution';
import { TensorGridStartupContribution } from './tensorgrid-startup-contribution';
import { TensorGridStartupGate } from './tensorgrid-startup-gate';

export default new ContainerModule(bind => {
    bind(PreferenceContribution).toConstantValue({ schema: OpenAiPreferencesSchema });
    bind(OpenAiFrontendApplicationContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(OpenAiFrontendApplicationContribution);
    bind(TensorGridStartupGate).toSelf().inSingletonScope();
    bind(TensorGridStartupContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(TensorGridStartupContribution);
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
