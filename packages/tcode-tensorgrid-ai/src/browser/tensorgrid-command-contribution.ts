import { Command, CommandContribution, CommandRegistry, MessageService, nls } from '@theia/core';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { TensorGridCatalogService } from '../common';

export namespace TensorGridCommands {
    export const SIGN_IN: Command = { id: 'tensorgrid.signIn', label: 'Sign in to TensorGrid', category: 'TensorGrid' };
    export const SIGN_OUT: Command = { id: 'tensorgrid.signOut', label: 'Sign out of TensorGrid', category: 'TensorGrid' };
}
@injectable()
export class TensorGridCommandContribution implements CommandContribution {
    @inject(TensorGridCatalogService) protected readonly service: TensorGridCatalogService;
    @inject(WindowService) protected readonly windows: WindowService;
    @inject(MessageService) protected readonly messages: MessageService;
    protected authenticated = false;
    @postConstruct() protected initialize(): void {
        void this.service.getAuthState().then(state => this.authenticated = state.isAuthenticated);
        this.service.onAuthStateChanged(state => this.authenticated = state.isAuthenticated);
    }
    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(TensorGridCommands.SIGN_IN, { execute: async () => {
            const request = await this.service.beginLogin(); await this.windows.openNewWindow(request.authorizationUrl, { external: true });
            this.messages.info(nls.localize('tcode/tensorgrid/completeSignIn', 'Complete TensorGrid sign-in in your browser.'));
        }, isEnabled: () => !this.authenticated });
        registry.registerCommand(TensorGridCommands.SIGN_OUT, { execute: () => this.service.logout(), isEnabled: () => this.authenticated });
    }
}
