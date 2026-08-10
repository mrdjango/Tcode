// *****************************************************************************
// Copyright (C) 2026 EclipseSource GmbH.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 is satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// http://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { enableJSDOM } from '@theia/core/lib/browser/test/jsdom';

let disableJSDOM = enableJSDOM();

import { expect } from 'chai';
import * as React from '@theia/core/shared/react';
import { createRoot, Root } from '@theia/core/shared/react-dom/client';
import { ChatResponseContent, ToolCallChatResponseContentImpl } from '@theia/ai-chat/lib/common';
import { ResponseNode } from './chat-view-tree-widget';

disableJSDOM();

interface ContentListProps {
    content: readonly ChatResponseContent[];
    node: ResponseNode;
    keyPrefix: string;
    renderContent: (content: ChatResponseContent, node: ResponseNode) => React.ReactNode;
}

interface ContentListModule {
    ChatResponseContentList?: React.ComponentType<ContentListProps>;
}

const loadContentList = (): React.ComponentType<ContentListProps> | undefined => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return (require('./chat-response-content-list') as ContentListModule).ChatResponseContentList;
    } catch {
        return undefined;
    }
};

const tool = (name: string, finished: boolean): ToolCallChatResponseContentImpl =>
    new ToolCallChatResponseContentImpl(name, name, '{}', finished, finished ? 'ok' : undefined);

describe('ChatResponseContentList', () => {
    let container: HTMLElement;
    let root: Root;
    const node = { id: 'response-node' } as ResponseNode;
    const renderContent = (content: ChatResponseContent): React.ReactNode =>
        <span className='rendered-tool'>{(content as ToolCallChatResponseContentImpl).name}</span>;

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

    const renderList = (content: readonly ChatResponseContent[]): void => {
        const ContentList = loadContentList();
        root.render(ContentList
            ? <ContentList content={content} node={node} keyPrefix='response' renderContent={renderContent} />
            : <div data-missing-content-list />
        );
    };

    it('collapses three completed tools and expands them on demand', done => {
        renderList([tool('one', true), tool('two', true), tool('three', true)]);

        setTimeout(() => {
            const summary = container.querySelector<HTMLButtonElement>('.theia-ToolCallGroup-summary');
            expect(summary?.textContent ?? '').to.contain('Ran 3 tools');
            expect(summary?.getAttribute('aria-expanded')).to.equal('false');
            expect(container.querySelectorAll('.rendered-tool')).to.have.length(0);

            summary?.click();
            setTimeout(() => {
                expect(summary?.getAttribute('aria-expanded')).to.equal('true');
                expect(container.querySelectorAll('.rendered-tool')).to.have.length(3);
                done();
            }, 0);
        }, 0);
    });

    it('keeps a group with an unfinished tool expanded', done => {
        renderList([tool('one', true), tool('two', false), tool('three', true)]);

        setTimeout(() => {
            const summary = container.querySelector<HTMLButtonElement>('.theia-ToolCallGroup-summary');
            expect(summary?.textContent ?? '').to.contain('Running 3 tools');
            expect(summary?.getAttribute('aria-expanded')).to.equal('true');
            expect(container.querySelectorAll('.rendered-tool')).to.have.length(3);
            done();
        }, 0);
    });
});
