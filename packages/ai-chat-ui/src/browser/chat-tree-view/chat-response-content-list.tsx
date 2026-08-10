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

import { ChatResponseContent, ToolCallChatResponseContent } from '@theia/ai-chat/lib/common';
import { codicon } from '@theia/core/lib/browser';
import { nls } from '@theia/core/lib/common/nls';
import * as React from '@theia/core/shared/react';
import type { ResponseNode } from './chat-view-tree-widget';
import { groupChatResponseContent } from './chat-response-content-grouping';

export interface ChatResponseContentListProps {
    content: readonly ChatResponseContent[];
    node: ResponseNode;
    keyPrefix: string;
    renderContent: (content: ChatResponseContent, node: ResponseNode) => React.ReactNode;
    isGroupableToolCall?: (content: ToolCallChatResponseContent) => boolean;
}

interface ToolCallGroupProps {
    tools: readonly ToolCallChatResponseContent[];
    node: ResponseNode;
    contentId: string;
    renderContent: (content: ChatResponseContent, node: ResponseNode) => React.ReactNode;
}

const ToolCallGroup: React.FC<ToolCallGroupProps> = ({ tools, node, contentId, renderContent }) => {
    const complete = tools.every(tool => tool.finished);
    const [expanded, setExpanded] = React.useState(!complete);
    const userToggled = React.useRef(false);

    React.useEffect(() => {
        if (!userToggled.current) {
            setExpanded(!complete);
        }
    }, [complete]);

    const toggle = (): void => {
        userToggled.current = true;
        setExpanded(current => !current);
    };
    const label = complete
        ? nls.localize('theia/ai/chat-ui/toolCallGroup/ran', 'Ran {0} tools', tools.length)
        : nls.localize('theia/ai/chat-ui/toolCallGroup/running', 'Running {0} tools', tools.length);

    return (
        <div className={`theia-ToolCallGroup${expanded ? ' expanded' : ' collapsed'}`}>
            <button
                type='button'
                className='theia-ToolCallGroup-summary'
                aria-expanded={expanded}
                aria-controls={contentId}
                onClick={toggle}
            >
                <span className={codicon('terminal')} aria-hidden='true' />
                <span>{label}</span>
                <span className={codicon(expanded ? 'chevron-down' : 'chevron-right')} aria-hidden='true' />
            </button>
            {expanded && (
                <div id={contentId} className='theia-ToolCallGroup-content'>
                    {tools.map((tool, index) => (
                        <div className='theia-ResponseNode-Content' key={`${contentId}-tool-${tool.id ?? index}`}>
                            {renderContent(tool, node)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const ChatResponseContentList: React.FC<ChatResponseContentListProps> = ({ content, node, keyPrefix, renderContent, isGroupableToolCall }) => (
    <>
        {groupChatResponseContent(content, isGroupableToolCall).map(item => item.kind === 'content' ? (
            <div className='theia-ResponseNode-Content' key={`${keyPrefix}-content-${item.sourceIndex}`}>
                {renderContent(item.content, node)}
            </div>
        ) : (
            <ToolCallGroup
                key={`${keyPrefix}-tool-group-${item.sourceIndex}`}
                tools={item.content}
                node={node}
                contentId={`${keyPrefix}-tool-group-${item.sourceIndex}-content`}
                renderContent={renderContent}
            />
        ))}
    </>
);
