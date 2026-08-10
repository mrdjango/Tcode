import { MessageService, nls } from '@theia/core';
import { OpenHandler } from '@theia/core/lib/browser/opener-service';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import URI from '@theia/core/lib/common/uri';
import { inject, injectable } from '@theia/core/shared/inversify';
import { TensorGridCatalogService } from '../common';

@injectable()
export class TensorGridAuthUriHandler implements OpenHandler {
    readonly id = 'tensorgrid-auth-uri-handler';
    protected readonly handled = new Set<string>();
    @inject(TensorGridCatalogService) protected readonly service: TensorGridCatalogService;
    @inject(WindowService) protected readonly windows: WindowService;
    @inject(MessageService) protected readonly messages: MessageService;
    canHandle(uri: URI): number { return uri.scheme === 'tcode' && uri.authority.toLowerCase() === 'tensorgrid' && uri.path.toString() === '/auth' ? 500 : 0; }
    async open(uri: URI): Promise<object | undefined> {
        this.windows.focus(); const callback = uri.toString(true);
        if (this.handled.has(callback)) return undefined;
        try { await this.service.completeLogin(callback); this.handled.add(callback); this.messages.info(nls.localize('tcode/tensorgrid/loginSucceeded', 'Signed in to TensorGrid.')); }
        catch (error) { this.messages.error(nls.localize('tcode/tensorgrid/loginFailed', 'TensorGrid sign-in failed: {0}', error instanceof Error ? error.message : String(error))); }
        return undefined;
    }
}
