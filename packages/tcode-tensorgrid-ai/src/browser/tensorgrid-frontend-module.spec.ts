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

    it('registers the mandatory authentication gate as a frontend contribution', () => {
        const moduleSource = fs.readFileSync(path.resolve(__dirname, '../../src/browser/tensorgrid-frontend-module.ts'), 'utf8');
        const gateSource = fs.readFileSync(path.resolve(__dirname, '../../src/browser/tensorgrid-auth-gate.ts'), 'utf8');

        expect(moduleSource).to.contain("import { TensorGridAuthGate } from './tensorgrid-auth-gate';");
        expect(moduleSource).to.contain('bind(FrontendApplicationContribution).toService(TensorGridAuthGate);');
        expect(gateSource).to.contain('class TensorGridAuthGate');
        expect(gateSource).to.contain('document.addEventListener(\'keydown\', this.keydownListener, true);');
        expect(gateSource).to.contain('scheduleExpiration(state.expiresAt)');
        expect(gateSource).to.contain('this.models.refresh()');
    });
});
