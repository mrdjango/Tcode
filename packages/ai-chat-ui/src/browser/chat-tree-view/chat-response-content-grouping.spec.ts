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

import { expect } from 'chai';
import {
    ChatResponseContent,
    MarkdownChatResponseContent,
    MarkdownChatResponseContentImpl,
    ToolCallChatResponseContent,
    ToolCallChatResponseContentImpl
} from '@theia/ai-chat/lib/common';

interface GroupingModule {
    groupChatResponseContent?: (
        content: readonly ChatResponseContent[],
        isGroupableToolCall?: (content: ToolCallChatResponseContent) => boolean
    ) => Array<{
        kind: 'content' | 'toolCallGroup';
        content: ChatResponseContent | ChatResponseContent[];
        sourceIndex: number;
    }>;
}

const loadGroupingModule = (): GroupingModule => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('./chat-response-content-grouping') as GroupingModule;
    } catch {
        return {};
    }
};

const tool = (name: string): ToolCallChatResponseContentImpl =>
    new ToolCallChatResponseContentImpl(name, name, '{}', true, 'ok');

const markdown = (value: string): MarkdownChatResponseContent => new MarkdownChatResponseContentImpl(value);

describe('groupChatResponseContent', () => {
    const group = (content: readonly ChatResponseContent[]) =>
        loadGroupingModule().groupChatResponseContent?.(content);

    it('keeps one or two consecutive tool calls individually rendered', () => {
        expect(group([tool('one')])?.map(item => item.kind)).to.deep.equal(['content']);
        expect(group([tool('one'), tool('two')])?.map(item => item.kind)).to.deep.equal(['content', 'content']);
    });

    it('groups three consecutive tool calls and preserves their order', () => {
        const result = group([tool('one'), tool('two'), tool('three')]);

        expect(result).to.have.length(1);
        expect(result?.[0].kind).to.equal('toolCallGroup');
        expect(result?.[0].sourceIndex).to.equal(0);
        expect((result?.[0].content as ToolCallChatResponseContentImpl[]).map(item => item.name))
            .to.deep.equal(['one', 'two', 'three']);
    });

    it('uses non-tool content to split independent tool groups', () => {
        const result = group([
            tool('one'), tool('two'), tool('three'),
            markdown('between'),
            tool('four'), tool('five'), tool('six')
        ]);

        expect(result?.map(item => item.kind)).to.deep.equal(['toolCallGroup', 'content', 'toolCallGroup']);
        expect(result?.map(item => item.sourceIndex)).to.deep.equal([0, 3, 4]);
        expect(result?.[1].content).to.deep.equal(markdown('between'));
    });

    it('keeps a standalone tool outside counts and splits adjacent tool groups', () => {
        const result = loadGroupingModule().groupChatResponseContent?.([
            tool('one'), tool('two'), tool('three'),
            tool('todoWrite'),
            tool('four'), tool('five'), tool('six')
        ], item => item.name !== 'todoWrite');

        expect(result?.map(item => item.kind)).to.deep.equal(['toolCallGroup', 'content', 'toolCallGroup']);
        expect(result?.map(item => item.sourceIndex)).to.deep.equal([0, 3, 4]);
        expect((result?.[1].content as ToolCallChatResponseContent).name).to.equal('todoWrite');
        expect(result?.filter(item => item.kind === 'toolCallGroup').map(item => (item.content as ChatResponseContent[]).length))
            .to.deep.equal([3, 3]);
    });
});
