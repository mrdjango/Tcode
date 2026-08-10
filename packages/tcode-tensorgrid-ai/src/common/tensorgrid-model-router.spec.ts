import { expect } from 'chai';
import { routeTensorGridModel } from './tensorgrid-model-router';

const model = (id: string, endpointTypes: string[], category = 'language') => ({ id, endpointTypes, category, capabilities: { chat: true } });

describe('routeTensorGridModel', () => {
    it('uses native providers only for matching family metadata', () => {
        expect(routeTensorGridModel(model('tg:auto:claude-sonnet-4', ['messages']))).to.include({ provider: 'anthropic' });
        expect(routeTensorGridModel(model('tg:auto:gemini-2.5-pro', ['generateContent']))).to.include({ provider: 'google', apiVersion: 'v1beta' });
        expect(routeTensorGridModel(model('tg:auto:gpt-5.6', ['chat.completions']))).to.include({ provider: 'openai', useResponseApi: false });
        expect(routeTensorGridModel(model('tg:auto:codex', ['responses']))).to.include({ provider: 'openai', useResponseApi: true });
    });
    it('skips non-chat and incompatible metadata without fallback guessing', () => {
        expect(routeTensorGridModel(model('tg:auto:claude-sonnet-4', ['chat.completions']))).to.include({ provider: 'skip' });
        expect(routeTensorGridModel(model('tg:auto:gemini-2.5-pro', ['messages']))).to.include({ provider: 'skip' });
        expect(routeTensorGridModel(model('tg:auto:image', ['images.generations'], 'image'))).to.include({ provider: 'skip' });
    });
});
