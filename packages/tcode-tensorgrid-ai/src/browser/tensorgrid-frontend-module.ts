import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution, OpenHandler, RemoteConnectionProvider, ServiceConnectionProvider } from '@theia/core/lib/browser';
import { CommandContribution } from '@theia/core';
import { TensorGridCatalogService, TENSORGRID_CATALOG_SERVICE_PATH } from '../common';
import { TensorGridModelContribution } from './tensorgrid-model-contribution';
import { TensorGridAuthUriHandler } from './tensorgrid-auth-uri-handler';
import { TensorGridCommandContribution } from './tensorgrid-command-contribution';
import '../../src/browser/style/tcode-chat.css';

export default new ContainerModule(bind => {
    bind(TensorGridModelContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(TensorGridModelContribution);
    bind(TensorGridAuthUriHandler).toSelf().inSingletonScope();
    bind(OpenHandler).toService(TensorGridAuthUriHandler);
    bind(TensorGridCommandContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(TensorGridCommandContribution);
    bind(TensorGridCatalogService).toDynamicValue(ctx => {
        const provider = ctx.container.get<ServiceConnectionProvider>(RemoteConnectionProvider);
        return provider.createProxy<TensorGridCatalogService>(TENSORGRID_CATALOG_SERVICE_PATH);
    }).inSingletonScope();
});
