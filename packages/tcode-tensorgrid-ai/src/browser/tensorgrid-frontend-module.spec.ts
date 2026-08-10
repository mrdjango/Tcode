import { expect } from 'chai';
import fs = require('fs');
import path = require('path');

describe('TensorGrid frontend bindings', () => {
    it('does not rebind native provider managers owned by their provider extensions', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '../../src/browser/tensorgrid-frontend-module.ts'), 'utf8');

        expect(source).not.to.contain('bind(OpenAiLanguageModelsManager)');
        expect(source).not.to.contain('bind(AnthropicLanguageModelsManager)');
        expect(source).not.to.contain('bind(GoogleLanguageModelsManager)');
        expect(source).not.to.contain('[OpenAiLanguageModelsManager, OPENAI_LANGUAGE_MODELS_MANAGER_PATH]');
    });
});
