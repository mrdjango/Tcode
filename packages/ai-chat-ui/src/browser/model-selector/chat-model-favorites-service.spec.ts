// *****************************************************************************
// Copyright (C) 2026 TensorGrid
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { ChatModelFavoritesService } from './chat-model-favorites-service';

describe('ChatModelFavoritesService', () => {
    const storage = (stored: unknown) => {
        const values = new Map<string, unknown>([['tcode.ai-chat.favorite-model-ids', stored]]);
        return {
            values,
            getData: async <T>(key: string, defaultValue?: T) => values.has(key) ? values.get(key) as T : defaultValue,
            setData: async <T>(key: string, value: T) => { values.set(key, value); }
        };
    };

    it('loads only unique non-empty model ids and persists a sorted snapshot', async () => {
        const backing = storage(['tensorgrid/z', '', 'tensorgrid/a', 'tensorgrid/z', 42]);
        const service = new ChatModelFavoritesService(backing);
        await service.ready;

        expect(service.getFavoriteModelIds()).to.deep.equal(['tensorgrid/a', 'tensorgrid/z']);
        await service.toggle('tensorgrid/m');
        expect(backing.values.get('tcode.ai-chat.favorite-model-ids')).to.deep.equal([
            'tensorgrid/a', 'tensorgrid/m', 'tensorgrid/z'
        ]);
    });

    it('toggles a model and emits the complete snapshot', async () => {
        const service = new ChatModelFavoritesService(storage(undefined));
        const changes: string[][] = [];
        service.onDidChange((ids: readonly string[]) => changes.push([...ids]));
        await service.ready;

        await service.toggle('tensorgrid/a');
        expect(service.isFavorite('tensorgrid/a')).to.equal(true);
        await service.toggle('tensorgrid/a');
        expect(service.isFavorite('tensorgrid/a')).to.equal(false);
        expect(changes).to.deep.equal([['tensorgrid/a'], []]);
    });
});
