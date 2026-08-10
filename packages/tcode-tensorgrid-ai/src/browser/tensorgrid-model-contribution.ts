import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { inject, injectable } from '@theia/core/shared/inversify';
import { AnthropicLanguageModelsManager } from '@theia/ai-anthropic/lib/common';
import { GoogleLanguageModelsManager } from '@theia/ai-google/lib/common';
import { OpenAiLanguageModelsManager } from '@theia/ai-openai/lib/common';
import { routeTensorGridModel, TensorGridCatalogService } from '../common';

@injectable()
export class TensorGridModelContribution implements FrontendApplicationContribution {
    @inject(TensorGridCatalogService) protected readonly catalog: TensorGridCatalogService;
    @inject(OpenAiLanguageModelsManager) protected readonly openai: OpenAiLanguageModelsManager;
    @inject(AnthropicLanguageModelsManager) protected readonly anthropic: AnthropicLanguageModelsManager;
    @inject(GoogleLanguageModelsManager) protected readonly google: GoogleLanguageModelsManager;
    protected readonly registered = new Map<string, 'openai' | 'anthropic' | 'google'>();

    onStart(): void {
        void this.refresh();
        this.catalog.onAuthStateChanged(() => void this.refresh());
    }

    async refresh(): Promise<void> {
        const apiKey = await this.catalog.getApiKey();
        if (!apiKey) { this.clear(); return; }
        let models;
        try { models = await this.catalog.getCatalog(); } catch (error) {
            console.warn('TensorGrid: catalog refresh failed:', error instanceof Error ? error.message : error);
            if (!(await this.catalog.getApiKey())) { this.clear(); }
            return;
        }
        const next = new Map<string, 'openai' | 'anthropic' | 'google'>();
        const openai = []; const anthropic = []; const google = [];
        for (const entry of models) {
            const route = routeTensorGridModel(entry);
            if (route.provider === 'skip') { console.debug(`TensorGrid: skipping ${entry.id}: ${route.reason}`); continue; }
            next.set(route.id, route.provider);
            if (route.provider === 'openai') openai.push({ ...route, apiKey, apiVersion: undefined, maxRetries: 3, enableStreaming: true, supportsStructuredOutput: false });
            if (route.provider === 'anthropic') anthropic.push({ ...route, apiKey, enableStreaming: true, useCaching: entry.capabilities.prompt_caching === true, maxRetries: 3 });
            if (route.provider === 'google') google.push({ ...route, apiKey, enableStreaming: true });
        }
        this.removeMissing(next);
        await Promise.all([
            this.openai.createOrUpdateLanguageModels(...openai),
            this.anthropic.createOrUpdateLanguageModels(...anthropic),
            this.google.createOrUpdateLanguageModels(...google),
        ]);
        this.registered.clear(); next.forEach((provider, id) => this.registered.set(id, provider));
    }

    protected removeMissing(next: Map<string, 'openai' | 'anthropic' | 'google'>): void {
        for (const [id, provider] of this.registered) {
            if (next.get(id) === provider) continue;
            if (provider === 'openai') this.openai.removeLanguageModels(id);
            if (provider === 'anthropic') this.anthropic.removeLanguageModels(id);
            if (provider === 'google') this.google.removeLanguageModels(id);
        }
    }
    protected clear(): void { this.removeMissing(new Map()); this.registered.clear(); }
}
