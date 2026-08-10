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

export const TOOL_CALL_GROUP_THRESHOLD = 2;

export type GroupedChatResponseContent =
    | { kind: 'content'; content: ChatResponseContent; sourceIndex: number }
    | { kind: 'toolCallGroup'; content: ToolCallChatResponseContent[]; sourceIndex: number };

/** Groups only adjacent groupable client tool calls, preserving the original content order and objects. */
export function groupChatResponseContent(
    content: readonly ChatResponseContent[],
    isGroupableToolCall: (content: ToolCallChatResponseContent) => boolean = () => true
): GroupedChatResponseContent[] {
    const result: GroupedChatResponseContent[] = [];
    let run: Array<{ content: ToolCallChatResponseContent; sourceIndex: number }> = [];

    const flush = (): void => {
        if (run.length > TOOL_CALL_GROUP_THRESHOLD) {
            result.push({
                kind: 'toolCallGroup',
                content: run.map(item => item.content),
                sourceIndex: run[0].sourceIndex
            });
        } else {
            result.push(...run.map(item => ({ kind: 'content' as const, ...item })));
        }
        run = [];
    };

    content.forEach((item, sourceIndex) => {
        if (ToolCallChatResponseContent.is(item) && isGroupableToolCall(item)) {
            run.push({ content: item, sourceIndex });
        } else {
            flush();
            result.push({ kind: 'content', content: item, sourceIndex });
        }
    });
    flush();

    return result;
}
