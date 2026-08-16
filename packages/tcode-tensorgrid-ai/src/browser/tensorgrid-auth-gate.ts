import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { inject, injectable } from '@theia/core/shared/inversify';
import { TensorGridCatalogService } from '../common';
import { TensorGridModelContribution } from './tensorgrid-model-contribution';

type GateState = 'checking' | 'signIn' | 'opening' | 'waiting' | 'validating' | 'error';

@injectable()
export class TensorGridAuthGate implements FrontendApplicationContribution {
    @inject(TensorGridCatalogService) protected readonly service: TensorGridCatalogService;
    @inject(TensorGridModelContribution) protected readonly models: TensorGridModelContribution;
    @inject(WindowService) protected readonly windows: WindowService;

    protected root?: HTMLElement;
    protected state: GateState = 'checking';
    protected message = '';
    protected authorizationUrl?: string;
    protected busy = false;
    protected generation = 0;
    protected locked = true;
    protected shellObserver?: MutationObserver;
    protected expirationTimer?: ReturnType<typeof setTimeout>;
    protected readonly keydownListener = (event: KeyboardEvent): void => {
        if (!this.root || this.root.hidden || this.root.contains(event.target as Node)) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    initialize(): void {
        this.root = document.createElement('div');
        this.root.className = 'tensorgrid-auth-gate';
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'true');
        this.root.setAttribute('aria-label', 'TensorGrid authentication');
        this.root.addEventListener('click', event => {
            const target = event.target as HTMLElement;
            if (target.closest('[data-tensorgrid-auth-action="login"]')) {
                void this.openLogin();
            }
        });
        (document.body ?? document.documentElement).appendChild(this.root);
        document.addEventListener('keydown', this.keydownListener, true);
        if (typeof MutationObserver !== 'undefined' && document.body) {
            this.shellObserver = new MutationObserver(() => this.setLocked(this.locked));
            this.shellObserver.observe(document.body, { childList: true });
        }
        this.render();
        this.setLocked(true);
    }

    onStart(): void {
        this.service.onAuthStateChanged(state => {
            if (state.isAuthenticated) {
                this.scheduleExpiration(state.expiresAt);
                void this.validateAndUnlock();
            } else {
                this.clearExpirationTimer();
                this.authorizationUrl = undefined;
                this.busy = false;
                this.show('signIn');
            }
        });
        void this.resolveInitialState();
    }

    onStop(): void {
        document.removeEventListener('keydown', this.keydownListener, true);
        this.shellObserver?.disconnect();
        this.shellObserver = undefined;
        this.clearExpirationTimer();
        this.root?.remove();
        this.setLocked(false);
    }

    protected async resolveInitialState(): Promise<void> {
        try {
            const state = await this.service.getAuthState();
            if (!state.isAuthenticated) {
                this.show('signIn');
                return;
            }
            this.scheduleExpiration(state.expiresAt);
            await this.validateAndUnlock();
        } catch {
            this.show('error', 'We could not check your TensorGrid session. Try again.');
        }
    }

    protected async validateAndUnlock(): Promise<void> {
        const generation = ++this.generation;
        this.busy = true;
        this.show('validating');
        try {
            await this.service.getCatalog();
            const modelsReady = await this.models.refresh();
            if (!modelsReady || generation !== this.generation) {
                throw new Error('TensorGrid models are not ready yet.');
            }
            const state = await this.service.getAuthState();
            if (!state.isAuthenticated) {
                throw new Error('TensorGrid authentication expired.');
            }
            this.scheduleExpiration(state.expiresAt);
            this.busy = false;
            this.setLocked(false);
        } catch (error) {
            if (generation !== this.generation) {
                return;
            }
            this.busy = false;
            const state = await this.service.getAuthState();
            if (!state.isAuthenticated) {
                this.clearExpirationTimer();
                this.show('signIn');
            } else {
                this.show('error', error instanceof Error && error.message.includes('not ready')
                    ? 'TensorGrid models are not ready. Check your connection and try again.'
                    : 'TensorGrid could not be reached. Check your connection and try again.');
            }
        }
    }

    protected async openLogin(): Promise<void> {
        if (this.busy) {
            return;
        }
        if (this.state === 'error' && !this.authorizationUrl) {
            try {
                const state = await this.service.getAuthState();
                if (state.isAuthenticated) {
                    await this.validateAndUnlock();
                    return;
                }
            } catch {
                // Continue with a fresh browser login attempt.
            }
        }
        const retryWaiting = this.state === 'waiting';
        this.busy = true;
        this.show('opening');
        try {
            if (retryWaiting) {
                this.authorizationUrl = undefined;
            }
            if (!this.authorizationUrl) {
                this.authorizationUrl = (await this.service.beginLogin()).authorizationUrl;
            }
            await this.windows.openNewWindow(this.authorizationUrl, { external: true });
            this.busy = false;
            this.show('waiting');
        } catch {
            this.authorizationUrl = undefined;
            this.busy = false;
            this.show('error', 'The TensorGrid login page could not be opened. Try again.');
        }
    }

    protected show(state: GateState, message = ''): void {
        this.state = state;
        this.message = message;
        this.setLocked(true);
        this.render();
        const button = this.root?.querySelector<HTMLButtonElement>('[data-tensorgrid-auth-action="login"]');
        button?.focus();
    }

    protected render(): void {
        if (!this.root) {
            return;
        }
        const content = document.createElement('div');
        content.className = 'tensorgrid-auth-gate__card';
        const mark = document.createElement('span');
        mark.className = 'tensorgrid-brand-mark tensorgrid-auth-gate__mark';
        mark.setAttribute('aria-hidden', 'true');
        content.append(mark);

        const title = document.createElement('h1');
        title.textContent = this.state === 'error' ? 'TensorGrid connection failed' : 'Welcome to Tcode';
        content.append(title);

        const description = document.createElement('p');
        description.className = 'tensorgrid-auth-gate__description';
        description.textContent = this.description();
        content.append(description);

        if (this.message) {
            const error = document.createElement('p');
            error.className = 'tensorgrid-auth-gate__error';
            error.setAttribute('role', 'alert');
            error.textContent = this.message;
            content.append(error);
        }

        if (this.state !== 'checking' && this.state !== 'validating') {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'tensorgrid-auth-gate__button';
            button.dataset.tensorgridAuthAction = 'login';
            button.disabled = this.busy || this.state === 'opening';
            button.textContent = this.state === 'waiting' ? 'Open TensorGrid login again' : this.state === 'error' ? 'Try again' : 'Sign in to TensorGrid';
            content.append(button);
        }
        this.root.replaceChildren(content);
        this.root.hidden = false;
    }

    protected description(): string {
        switch (this.state) {
            case 'checking': return 'Checking your secure TensorGrid session…';
            case 'opening': return 'Opening TensorGrid in your browser…';
            case 'waiting': return 'Complete sign-in in your browser, then return to Tcode.';
            case 'validating': return 'Finishing the secure connection and loading your models…';
            case 'error': return 'Tcode needs a valid TensorGrid connection before the workbench can be used.';
            default: return 'Sign in to TensorGrid to unlock the Tcode workbench and AI models.';
        }
    }

    protected setLocked(locked: boolean): void {
        this.locked = locked;
        const shell = document.querySelector<HTMLElement>('.theia-ApplicationShell');
        if (shell) {
            (shell as HTMLElement & { inert?: boolean }).inert = locked;
            shell.setAttribute('aria-hidden', locked ? 'true' : 'false');
        }
        document.documentElement.classList.toggle('tensorgrid-auth-locked', locked);
        if (this.root) {
            this.root.hidden = !locked;
        }
    }

    protected scheduleExpiration(expiresAt?: string): void {
        this.clearExpirationTimer();
        const expiration = expiresAt ? Date.parse(expiresAt) : NaN;
        if (!Number.isFinite(expiration)) {
            return;
        }
        const delay = expiration - Date.now();
        if (delay <= 0) {
            void this.service.logout();
            return;
        }
        const maximumDelay = 2_000_000_000;
        this.expirationTimer = setTimeout(() => {
            this.expirationTimer = undefined;
            if (delay > maximumDelay) {
                this.scheduleExpiration(expiresAt);
            } else {
                void this.service.logout();
            }
        }, Math.min(delay, maximumDelay));
    }

    protected clearExpirationTimer(): void {
        if (this.expirationTimer !== undefined) {
            clearTimeout(this.expirationTimer);
            this.expirationTimer = undefined;
        }
    }
}
