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
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core';
import { ConnectionContainerModule } from '@theia/core/lib/node/messaging/connection-container-module';
import { TensorGridAuthService, TENSORGRID_AUTH_SERVICE_PATH } from '../common';
import { TensorGridAuthServiceImpl } from './tensorgrid-auth-service-impl';

const tensorGridConnectionModule = ConnectionContainerModule.create(({ bind }) => {
    bind(TensorGridAuthServiceImpl).toSelf().inSingletonScope();
    bind(TensorGridAuthService).toService(TensorGridAuthServiceImpl);
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(TENSORGRID_AUTH_SERVICE_PATH, () => ctx.container.get(TensorGridAuthService))
    ).inSingletonScope();
});

export default new ContainerModule(bind => {
    bind(ConnectionContainerModule).toConstantValue(tensorGridConnectionModule);
});
