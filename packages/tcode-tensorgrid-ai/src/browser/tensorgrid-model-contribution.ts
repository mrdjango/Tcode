import { Emitter, Event } from '@theia/core';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { inject, injectable } from '@theia/core/shared/inversify';
import { LanguageModel } from '@theia/ai-core';
import {
    LanguageModelSelectorMetadata,
    LanguageModelSelectorMetadataProvider,
} from '@theia/ai-chat-ui/lib/browser/language-model-selector-metadata';
import { AnthropicLanguageModelsManager } from '@theia/ai-anthropic/lib/common';
import { GoogleLanguageModelsManager } from '@theia/ai-google/lib/common';
import { OpenAiLanguageModelsManager } from '@theia/ai-openai/lib/common';
import { routeTensorGridModel, TensorGridCatalogService } from '../common';

@injectable()
export class TensorGridModelContribution implements FrontendApplicationContribution, LanguageModelSelectorMetadataProvider {
    @inject(TensorGridCatalogService) protected readonly catalog: TensorGridCatalogService;
    @inject(OpenAiLanguageModelsManager) protected readonly openai: OpenAiLanguageModelsManager;
    @inject(AnthropicLanguageModelsManager) protected readonly anthropic: AnthropicLanguageModelsManager;
    @inject(GoogleLanguageModelsManager) protected readonly google: GoogleLanguageModelsManager;
    protected readonly registered = new Map<string, 'openai' | 'anthropic' | 'google'>();
    protected selectorMetadata = new Map<string, LanguageModelSelectorMetadata>();
    protected refreshGeneration = 0;
    protected readonly metadataChangedEmitter = new Emitter<void>();
    readonly onDidChange: Event<void> = this.metadataChangedEmitter.event;

    onStart(): void {
        void this.refresh();
        this.catalog.onAuthStateChanged(() => void this.refresh());
    }

    async refresh(): Promise<void> {
        const generation = ++this.refreshGeneration;
        const apiKey = await this.catalog.getApiKey();
        if (generation !== this.refreshGeneration) { return; }
        if (!apiKey) { this.clear(); return; }
        let models;
        try { models = await this.catalog.getCatalog(); } catch (error) {
            console.warn('TensorGrid: catalog refresh failed:', error instanceof Error ? error.message : error);
            if (!(await this.catalog.getApiKey())) { this.clear(); }
            return;
        }
        if (generation !== this.refreshGeneration) { return; }
        const next = new Map<string, 'openai' | 'anthropic' | 'google'>();
        const nextMetadata = new Map<string, LanguageModelSelectorMetadata>();
        const openai = []; const anthropic = []; const google = [];
        for (const entry of models) {
            const route = routeTensorGridModel(entry);
            if (route.provider === 'skip') { console.debug(`TensorGrid: skipping ${entry.id}: ${route.reason}`); continue; }
            next.set(route.id, route.provider);
            if (entry.displayName && entry.group) {
                nextMetadata.set(route.id, {
                    label: entry.displayName,
                    group: {
                        id: entry.group.id,
                        label: entry.group.name,
                        ratio: entry.group.ratio,
                    },
                    ordering: entry.ordering,
                });
            }
            if (route.provider === 'openai') openai.push({ ...route, apiKey, apiVersion: undefined, maxRetries: 3, enableStreaming: true, supportsStructuredOutput: false });
            if (route.provider === 'anthropic') anthropic.push({ ...route, apiKey, enableStreaming: true, useCaching: entry.capabilities.prompt_caching === true, maxRetries: 3 });
            if (route.provider === 'google') google.push({ ...route, apiKey, enableStreaming: true });
        }
        const metadataChanged = !this.metadataEquals(nextMetadata);
        this.selectorMetadata = nextMetadata;
        this.removeMissing(next);
        await Promise.all([
            this.openai.createOrUpdateLanguageModels(...openai),
            this.anthropic.createOrUpdateLanguageModels(...anthropic),
            this.google.createOrUpdateLanguageModels(...google),
        ]);
        if (generation !== this.refreshGeneration) { return; }
        this.registered.clear(); next.forEach((provider, id) => this.registered.set(id, provider));
        if (metadataChanged) { this.metadataChangedEmitter.fire(); }
    }

    canHandle(model: LanguageModel): number {
        return this.selectorMetadata.has(model.id) ? 100 : 0;
    }

    getMetadata(model: LanguageModel): LanguageModelSelectorMetadata | undefined {
        return this.selectorMetadata.get(model.id);
    }

    protected removeMissing(next: Map<string, 'openai' | 'anthropic' | 'google'>): void {
        for (const [id, provider] of this.registered) {
            if (next.get(id) === provider) continue;
            if (provider === 'openai') this.openai.removeLanguageModels(id);
            if (provider === 'anthropic') this.anthropic.removeLanguageModels(id);
            if (provider === 'google') this.google.removeLanguageModels(id);
        }
    }
    protected metadataEquals(next: Map<string, LanguageModelSelectorMetadata>): boolean {
        if (next.size !== this.selectorMetadata.size) { return false; }
        for (const [id, metadata] of next) {
            const current = this.selectorMetadata.get(id);
            if (!current || current.label !== metadata.label || current.ordering !== metadata.ordering
                || current.group.id !== metadata.group.id || current.group.label !== metadata.group.label
                || current.group.ratio !== metadata.group.ratio) {
                return false;
            }
        }
        return true;
    }

    protected clear(): void {
        const hadMetadata = this.selectorMetadata.size > 0;
        this.removeMissing(new Map());
        this.registered.clear();
        this.selectorMetadata.clear();
        if (hadMetadata) { this.metadataChangedEmitter.fire(); }
    }
}
