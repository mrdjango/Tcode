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
        try {
            await this.service.completeLogin(callback);
            this.messages.info(nls.localize('tcode/tensorgrid/loginSucceeded', 'Signed in to TensorGrid.'));
        } catch (error) {
            const detail = error instanceof Error ? error.message : '';
            const message = detail.includes('cancelled')
                ? 'TensorGrid authorization was cancelled.'
                : detail.includes('expired') || detail.includes('invalid')
                    ? 'The TensorGrid authorization link is invalid or expired.'
                    : 'TensorGrid sign-in could not be completed. Try again.';
            this.messages.error(nls.localize('tcode/tensorgrid/loginFailed', message));
        } finally {
            this.handled.add(callback);
        }
        return undefined;
    }
}
