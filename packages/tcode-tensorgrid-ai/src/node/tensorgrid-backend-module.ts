import { ConnectionHandler, RpcConnectionHandler } from '@theia/core';
import { ConnectionContainerModule } from '@theia/core/lib/node/messaging/connection-container-module';
import { ContainerModule } from '@theia/core/shared/inversify';
import { TensorGridCatalogService, TENSORGRID_CATALOG_SERVICE_PATH } from '../common';
import { TensorGridCatalogServiceImpl } from './tensorgrid-catalog-service-impl';

const connections = ConnectionContainerModule.create(({ bind }) => {
    bind(TensorGridCatalogServiceImpl).toSelf().inSingletonScope();
    bind(TensorGridCatalogService).toService(TensorGridCatalogServiceImpl);
    bind(ConnectionHandler).toDynamicValue(ctx => new RpcConnectionHandler(TENSORGRID_CATALOG_SERVICE_PATH,
        () => ctx.container.get<TensorGridCatalogService>(TensorGridCatalogService))).inSingletonScope();
});
export default new ContainerModule(bind => bind(ConnectionContainerModule).toConstantValue(connections));
