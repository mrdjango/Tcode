// *****************************************************************************
// Copyright (C) 2026 TensorGrid
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { LanguageModel } from '@theia/ai-core';
import {
    compareLanguageModelSelectorGroups,
    getConcreteManagedLanguageModelId,
    getLanguageModelSelectorMetadata,
    rankReadyManagedLanguageModels,
    toLanguageModelSelectorEntry,
    LanguageModelSelectorMetadataProvider,
} from './language-model-selector-metadata';

const model = (id: string, options: Partial<LanguageModel> = {}): LanguageModel => ({
    id,
    status: { status: 'ready' },
    request: async () => ({ content: [] }),
    ...options,
} as LanguageModel);

describe('language model selector metadata', () => {
    it('uses metadata from the provider with the highest positive priority', () => {
        const target = model('tensorgrid/gpt');
        const providers: LanguageModelSelectorMetadataProvider[] = [
            {
                canHandle: () => 10,
                getMetadata: () => ({ label: 'Low priority', group: { id: 'low', label: 'Low' } }),
            },
            {
                canHandle: () => 100,
                getMetadata: () => ({ label: 'GPT 5.6', group: { id: 'codex', label: 'CodexPro', ratio: 0.2 }, ordering: 3 }),
            },
        ];

        expect(getLanguageModelSelectorMetadata(target, providers)).to.deep.equal({
            label: 'GPT 5.6',
            group: { id: 'codex', label: 'CodexPro', ratio: 0.2 },
            ordering: 3,
        });
    });

    it('falls back to vendor and Other groups for unmanaged models', () => {
        expect(toLanguageModelSelectorEntry(model('openai/gpt', { name: 'GPT', vendor: 'OpenAI' }), []).metadata).to.deep.equal({
            label: 'GPT',
            group: { id: 'vendor:OpenAI', label: 'OpenAI' },
        });
        expect(toLanguageModelSelectorEntry(model('local/model'), []).metadata.group).to.deep.equal({
            id: 'other',
            label: 'Other',
        });
    });

    it('orders groups by ratio ascending with null last and label as a stable tie break', () => {
        const groups = [
            { id: 'null', label: 'Null' },
            { id: 'b', label: 'Beta', ratio: 0.2 },
            { id: 'a', label: 'Alpha', ratio: 0.2 },
            { id: 'best', label: 'Best', ratio: 0.1 },
        ];

        expect(groups.sort(compareLanguageModelSelectorGroups).map(group => group.id)).to.deep.equal([
            'best', 'a', 'b', 'null',
        ]);
    });

    it('ranks only ready managed models by ratio, ordering, then id', () => {
        const models = [
            model('z-null'),
            model('b-equal'),
            model('a-equal'),
            model('unavailable', { status: { status: 'unavailable' } }),
            model('best'),
        ];
        const metadata = new Map([
            ['z-null', { label: 'Null', group: { id: 'null', label: 'Null' }, ordering: 99 }],
            ['b-equal', { label: 'B', group: { id: 'priced', label: 'Priced', ratio: 0.2 }, ordering: 3 }],
            ['a-equal', { label: 'A', group: { id: 'priced', label: 'Priced', ratio: 0.2 }, ordering: 3 }],
            ['unavailable', { label: 'Unavailable', group: { id: 'best', label: 'Best', ratio: 0.1 }, ordering: 100 }],
            ['best', { label: 'Best', group: { id: 'best', label: 'Best', ratio: 0.1 } }],
        ]);
        const provider: LanguageModelSelectorMetadataProvider = {
            canHandle: candidate => metadata.has(candidate.id) ? 100 : 0,
            getMetadata: candidate => metadata.get(candidate.id),
        };

        expect(rankReadyManagedLanguageModels(models, [provider]).map(entry => entry.model.id)).to.deep.equal([
            'best', 'a-equal', 'b-equal', 'z-null',
        ]);
    });

    it('keeps a ready manual choice and falls back when the choice disappears', () => {
        const models = [model('best'), model('manual')];
        const provider: LanguageModelSelectorMetadataProvider = {
            canHandle: candidate => candidate.id === 'best' ? 100 : 0,
            getMetadata: candidate => candidate.id === 'best'
                ? { label: 'Best', group: { id: 'best', label: 'Best', ratio: 0.1 } }
                : undefined,
        };

        expect(getConcreteManagedLanguageModelId('manual', models, [provider])).to.equal('manual');
        expect(getConcreteManagedLanguageModelId('removed', models, [provider])).to.equal('best');
        expect(getConcreteManagedLanguageModelId(undefined, models, [provider])).to.equal('best');
        expect(getConcreteManagedLanguageModelId(undefined, [model('unmanaged')], [provider])).to.equal(undefined);
    });
});
