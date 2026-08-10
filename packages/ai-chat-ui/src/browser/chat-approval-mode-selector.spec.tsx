// *****************************************************************************
// Copyright (C) 2026 TensorGrid and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { enableJSDOM } from '@theia/core/lib/browser/test/jsdom';

let disableJSDOM = enableJSDOM();

import { expect } from 'chai';
import * as React from '@theia/core/shared/react';
import { createRoot, Root } from '@theia/core/shared/react-dom/client';
import { flushSync } from '@theia/core/shared/react-dom';
import { ChatApprovalMode } from '@theia/ai-chat/lib/common/chat-tool-preferences';
import { ChatApprovalModeSelector } from './chat-approval-mode-selector';

disableJSDOM();

describe('ChatApprovalModeSelector', () => {
    let container: HTMLElement;
    let root: Root;

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

    it('shows the active policy and exposes all three Codex-style choices', () => {
        flushSync(() => root.render(<ChatApprovalModeSelector
            mode={ChatApprovalMode.ASK}
            onModeChange={() => undefined}
            onConfigure={() => undefined}
        />));

        const trigger = container.querySelector<HTMLButtonElement>('.theia-chat-approval-trigger')!;
        expect(trigger.textContent).to.contain('Ask for approval');

        flushSync(() => trigger.click());

        const choices = Array.from(container.querySelectorAll<HTMLButtonElement>('.theia-chat-approval-choice'));
        expect(choices.map(choice => choice.textContent)).to.deep.equal([
            'Ask for approvalAlways ask before executing tools',
            'Approve for meOnly ask for actions marked as potentially unsafe',
            'CustomUse the per-tool permissions in AI Configuration'
        ]);
    });

    it('changes the global policy and routes custom mode to configuration', () => {
        const changed: ChatApprovalMode[] = [];
        let configured = false;
        flushSync(() => root.render(<ChatApprovalModeSelector
            mode={ChatApprovalMode.ASK}
            onModeChange={mode => { changed.push(mode); }}
            onConfigure={() => { configured = true; }}
        />));

        flushSync(() => container.querySelector<HTMLButtonElement>('.theia-chat-approval-trigger')!.click());
        const choices = Array.from(container.querySelectorAll<HTMLButtonElement>('.theia-chat-approval-choice'));
        flushSync(() => choices[1].click());
        expect(changed).to.deep.equal([ChatApprovalMode.AUTO]);

        flushSync(() => container.querySelector<HTMLButtonElement>('.theia-chat-approval-trigger')!.click());
        const reopenedChoices = Array.from(container.querySelectorAll<HTMLButtonElement>('.theia-chat-approval-choice'));
        flushSync(() => reopenedChoices[2].click());
        expect(configured).to.be.true;
        expect(changed).to.deep.equal([ChatApprovalMode.AUTO]);
    });
});
