import { expect } from 'chai';
import { parseTensorGridCatalogResponse } from './tensorgrid-catalog-service-impl';

describe('TensorGrid catalog selector metadata', () => {
    it('parses complete grouping and ordering metadata', () => {
        const result = parseTensorGridCatalogResponse({
            object: 'list',
            data: [{
                id: 'tg-go:codex:gpt-5-6-sol',
                tensorgrid: {
                    display_name: 'GPT 5.6 Sol',
                    category: 'language',
                    endpoint_types: ['responses'],
                    capabilities: { tools: true },
                    group: { id: 'tg-go:codex', slug: 'codex', name: 'CodexPro', ratio: '0.200' },
                    ordering: 3,
                },
            }],
        });

        expect(result).to.deep.equal([{
            id: 'tg-go:codex:gpt-5-6-sol',
            category: 'language',
            endpointTypes: ['responses'],
            capabilities: { tools: true },
            displayName: 'GPT 5.6 Sol',
            group: { id: 'tg-go:codex', slug: 'codex', name: 'CodexPro', ratio: 0.2 },
            ordering: 3,
        }]);
    });

    it('keeps older routable catalog entries without selector metadata', () => {
        const result = parseTensorGridCatalogResponse({
            object: 'list',
            data: [{
                id: 'tg-go:auto:gpt',
                tensorgrid: { category: 'language', endpoint_types: ['chat.completions'], capabilities: {} },
            }],
        });

        expect(result).to.deep.equal([{
            id: 'tg-go:auto:gpt',
            category: 'language',
            endpointTypes: ['chat.completions'],
            capabilities: {},
        }]);
    });

    it('drops invalid optional ratio and ordering without dropping a routable model', () => {
        const result = parseTensorGridCatalogResponse({
            object: 'list',
            data: [{
                id: 'tg-go:codex:gpt',
                tensorgrid: {
                    display_name: 'GPT',
                    category: 'language',
                    endpoint_types: ['responses'],
                    capabilities: {},
                    group: { id: 'tg-go:codex', slug: 'codex', name: 'Codex', ratio: '-0.2x' },
                    ordering: 1.5,
                },
            }],
        });

        expect(result).to.have.length(1);
        expect(result[0].group).to.deep.equal({ id: 'tg-go:codex', slug: 'codex', name: 'Codex' });
        expect(result[0].ordering).to.equal(undefined);
    });
});
