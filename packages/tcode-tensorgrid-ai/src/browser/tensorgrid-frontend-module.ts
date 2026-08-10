import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution, OpenHandler, RemoteConnectionProvider, ServiceConnectionProvider } from '@theia/core/lib/browser';
import { CommandContribution } from '@theia/core';
import { OpenAiLanguageModelsManager, OPENAI_LANGUAGE_MODELS_MANAGER_PATH } from '@theia/ai-openai/lib/common';
import { AnthropicLanguageModelsManager, ANTHROPIC_LANGUAGE_MODELS_MANAGER_PATH } from '@theia/ai-anthropic/lib/common';
import { GoogleLanguageModelsManager, GOOGLE_LANGUAGE_MODELS_MANAGER_PATH } from '@theia/ai-google/lib/common';
import { TensorGridCatalogService, TENSORGRID_CATALOG_SERVICE_PATH } from '../common';
import { TensorGridModelContribution } from './tensorgrid-model-contribution';
import { TensorGridAuthUriHandler } from './tensorgrid-auth-uri-handler';
import { TensorGridCommandContribution } from './tensorgrid-command-contribution';

export default new ContainerModule(bind => {
    bind(TensorGridModelContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(TensorGridModelContribution);
    bind(TensorGridAuthUriHandler).toSelf().inSingletonScope();
    bind(OpenHandler).toService(TensorGridAuthUriHandler);
    bind(TensorGridCommandContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(TensorGridCommandContribution);
    for (const [service, path] of [[OpenAiLanguageModelsManager, OPENAI_LANGUAGE_MODELS_MANAGER_PATH], [AnthropicLanguageModelsManager, ANTHROPIC_LANGUAGE_MODELS_MANAGER_PATH], [GoogleLanguageModelsManager, GOOGLE_LANGUAGE_MODELS_MANAGER_PATH], [TensorGridCatalogService, TENSORGRID_CATALOG_SERVICE_PATH]] as const) {
        bind(service).toDynamicValue(ctx => ctx.container.get<ServiceConnectionProvider>(RemoteConnectionProvider).createProxy(path)).inSingletonScope();
    }
});
