/*****************************************************************************
 * Copyright (C) 2026 TensorGrid and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 *****************************************************************************/
import { Command, CommandContribution, CommandRegistry, MessageService, nls } from '@theia/core';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { TensorGridAuthService, TensorGridAuthState } from '../common';

export namespace TensorGridCommands {
    export const SIGN_IN: Command = Command.toLocalizedCommand(
        { id: 'tensorgrid.signIn', label: 'Sign in to TensorGrid', category: 'TensorGrid' },
        'theia/ai/openai/tensorgrid/signIn',
        'theia/ai/openai/tensorgrid/category'
    );
    export const SIGN_OUT: Command = Command.toLocalizedCommand(
        { id: 'tensorgrid.signOut', label: 'Sign out of TensorGrid', category: 'TensorGrid' },
        'theia/ai/openai/tensorgrid/signOut',
        'theia/ai/openai/tensorgrid/category'
    );
}

@injectable()
export class TensorGridCommandContribution implements CommandContribution {
    @inject(TensorGridAuthService)
    protected readonly authService: TensorGridAuthService;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    protected authState: TensorGridAuthState = { isAuthenticated: false };

    @postConstruct()
    protected initialize(): void {
        this.authService.getAuthState().then(state => this.authState = state).catch(error => console.error('Failed to load Tcode authentication state', error));
        this.authService.onAuthStateChanged(state => this.authState = state);
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(TensorGridCommands.SIGN_IN, {
            execute: async () => {
                const request = await this.authService.beginLogin();
                this.windowService.openNewWindow(request.authorizationUrl, { external: true });
                this.messageService.info(nls.localize('theia/ai/openai/tensorgrid/completeSignIn', 'Complete TensorGrid sign-in in your browser.'));
            },
            isEnabled: () => !this.authState.isAuthenticated
        });
        registry.registerCommand(TensorGridCommands.SIGN_OUT, {
            execute: () => this.authService.logout(),
            isEnabled: () => this.authState.isAuthenticated
        });
    }
}
