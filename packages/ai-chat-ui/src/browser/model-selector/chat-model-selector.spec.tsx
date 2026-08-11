// *****************************************************************************
// Copyright (C) 2026 TensorGrid
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { enableJSDOM } from '@theia/core/lib/browser/test/jsdom';

let disableJSDOM = enableJSDOM();

import { expect } from 'chai';
import * as React from '@theia/core/shared/react';
import { createRoot, Root } from '@theia/core/shared/react-dom/client';
import { flushSync } from '@theia/core/shared/react-dom';
import { LanguageModel } from '@theia/ai-core';
import { LanguageModelSelectorEntry } from '../language-model-selector-metadata';
import { ChatModelSelector } from './chat-model-selector';

disableJSDOM();

const entry = (
    id: string,
    label: string,
    group: { id: string; label: string; ratio?: number },
    ordering?: number,
): LanguageModelSelectorEntry => ({
    model: { id, status: { status: 'ready' }, request: async () => ({ content: [] }) } as unknown as LanguageModel,
    metadata: { label, group, ordering },
    managed: true,
});

describe('ChatModelSelector', () => {
    let container: HTMLElement;
    let root: Root;
    const entries = [
        entry('tensorgrid/claude-opus', 'Claude Opus', { id: 'claude', label: 'ClaudePro', ratio: 0.4 }, 2),
        entry('tensorgrid/gpt-mini', 'GPT Mini', { id: 'codex', label: 'CodexPro', ratio: 0.2 }, 1),
        entry('tensorgrid/gpt-sol', 'GPT Sol', { id: 'codex', label: 'CodexPro', ratio: 0.2 }, 3),
    ];

    before(() => disableJSDOM = enableJSDOM());
    after(() => disableJSDOM());
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        root.unmount();
        document.body.removeChild(container);
    });

    it('shows the selected label and a ratio-ordered two-pane model browser', () => {
        flushSync(() => root.render(<ChatModelSelector
            entries={entries}
            currentModelId='tensorgrid/gpt-sol'
            onModelChange={() => undefined}
        />));

        const trigger = container.querySelector<HTMLButtonElement>('.theia-ChatModelSelector-trigger')!;
        expect(trigger.textContent).to.contain('GPT Sol');
        expect(trigger.textContent).to.contain('CodexPro');
        flushSync(() => trigger.click());

        expect(container.querySelector('[role="dialog"]')).not.to.exist;
        expect(document.body.querySelector('[role="dialog"]')).to.exist;
        const groups = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.theia-ChatModelSelector-group'));
        expect(groups.map(group => group.textContent?.replace(/\s+/g, ' ').trim())).to.deep.equal([
            'CodexPro0.2x', 'ClaudePro0.4x',
        ]);
        const models = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.theia-ChatModelSelector-model'));
        expect(models.map(model => model.textContent?.replace(/\s+/g, ' ').trim())).to.deep.equal([
            'GPT Sol', 'GPT Mini',
        ]);
        expect(models[0].getAttribute('aria-selected')).to.equal('true');
    });

    it('searches the active group by display label and full model id', () => {
        flushSync(() => root.render(<ChatModelSelector entries={entries} currentModelId='tensorgrid/gpt-sol' onModelChange={() => undefined} />));
        flushSync(() => container.querySelector<HTMLButtonElement>('.theia-ChatModelSelector-trigger')!.click());
        const input = document.body.querySelector<HTMLInputElement>('.theia-ChatModelSelector-search')!;
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, 'mini');
        flushSync(() => input.dispatchEvent(new window.Event('input', { bubbles: true })));
        expect(Array.from(document.body.querySelectorAll('.theia-ChatModelSelector-model')).map(node => node.textContent?.trim())).to.deep.equal(['GPT Mini']);
    });

    it('keeps the portal open while scrolling and switches groups on click', () => {
        flushSync(() => root.render(<ChatModelSelector entries={entries} currentModelId='tensorgrid/gpt-sol' onModelChange={() => undefined} />));
        flushSync(() => container.querySelector<HTMLButtonElement>('.theia-ChatModelSelector-trigger')!.click());

        const modelList = document.body.querySelector<HTMLElement>('.theia-ChatModelSelector-model-list')!;
        flushSync(() => modelList.dispatchEvent(new modelList.ownerDocument.defaultView!.Event('scroll', { bubbles: true })));
        expect(document.body.querySelector('[role="dialog"]')).to.exist;

        const claudeGroup = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.theia-ChatModelSelector-group'))
            .find(group => group.textContent?.includes('ClaudePro'))!;
        flushSync(() => claudeGroup.click());
        expect(Array.from(document.body.querySelectorAll('.theia-ChatModelSelector-model')).map(node => node.textContent?.trim()))
            .to.deep.equal(['Claude Opus']);
    });

    it('selects with Enter and restores trigger focus with Escape', () => {
        const selected: string[] = [];
        flushSync(() => root.render(<ChatModelSelector
            entries={entries}
            currentModelId='tensorgrid/gpt-sol'
            onModelChange={id => selected.push(id)}
        />));
        const trigger = container.querySelector<HTMLButtonElement>('.theia-ChatModelSelector-trigger')!;
        trigger.focus();
        flushSync(() => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
        expect(document.body.querySelector('[role="dialog"]')).to.exist;
        flushSync(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
        expect(document.body.querySelector('[role="dialog"]')).not.to.exist;
        expect(document.activeElement).to.equal(trigger);
    });
});
