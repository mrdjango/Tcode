import { expect } from 'chai';
import { Emitter } from '@theia/core';
import { LanguageModel } from '@theia/ai-core';
import { TensorGridCatalogModel } from '../common';
import { TensorGridModelContribution } from './tensorgrid-model-contribution';

const languageModel = (id: string): LanguageModel => ({
    id,
    status: { status: 'ready' },
    request: async () => ({ content: [] }),
} as unknown as LanguageModel);

describe('TensorGridModelContribution selector metadata', () => {
    it('publishes metadata before native registration completes and emits metadata-only changes', async () => {
        const authEmitter = new Emitter<{ isAuthenticated: boolean }>();
        let catalog: TensorGridCatalogModel[] = [{
            id: 'tg-go:codex:gpt',
            category: 'language',
            endpointTypes: ['responses'],
            capabilities: {},
            displayName: 'GPT',
            group: { id: 'tg-go:codex', slug: 'codex', name: 'CodexPro', ratio: 0.2 },
            ordering: 3,
        }];
        let finishRegistration!: () => void;
        const registration = new Promise<void>(resolve => finishRegistration = resolve);
        const contribution = new TensorGridModelContribution() as unknown as {
            catalog: object;
            openai: object;
            anthropic: object;
            google: object;
            refresh(): Promise<void>;
            canHandle(model: LanguageModel): number;
            getMetadata(model: LanguageModel): unknown;
            onDidChange: (listener: () => void) => { dispose(): void };
        };
        contribution.catalog = {
            getApiKey: async () => 'sk-test',
            getCatalog: async () => catalog,
            onAuthStateChanged: authEmitter.event,
        };
        contribution.openai = { createOrUpdateLanguageModels: async () => registration, removeLanguageModels: () => undefined };
        contribution.anthropic = { createOrUpdateLanguageModels: async () => undefined, removeLanguageModels: () => undefined };
        contribution.google = { createOrUpdateLanguageModels: async () => undefined, removeLanguageModels: () => undefined };
        let changes = 0;
        contribution.onDidChange(() => changes++);

        const refresh = contribution.refresh();
        await Promise.resolve();
        await Promise.resolve();
        const registeredModel = languageModel('tensorgrid/tg-go:codex:gpt');
        expect(contribution.canHandle(registeredModel)).to.equal(100);
        expect(contribution.getMetadata(registeredModel)).to.deep.equal({
            label: 'GPT',
            group: { id: 'tg-go:codex', label: 'CodexPro', ratio: 0.2 },
            ordering: 3,
        });
        finishRegistration();
        await refresh;

        catalog = [{ ...catalog[0], ordering: 7 }];
        await contribution.refresh();
        expect(contribution.getMetadata(registeredModel)).to.have.property('ordering', 7);
        expect(changes).to.equal(2);
    });
});
