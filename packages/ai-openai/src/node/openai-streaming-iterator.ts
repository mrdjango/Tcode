// *****************************************************************************
// Copyright (C) 2025 EclipseSource GmbH.
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

import { LanguageModelStreamResponsePart, ToolCall, ToolCallResult, ToolCallTextResult, isToolCallResponsePart } from '@theia/ai-core';
import { CancellationError, CancellationToken, Disposable, DisposableCollection } from '@theia/core';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { ChatCompletionStream, ChatCompletionStreamEvents } from 'openai/lib/ChatCompletionStream';
import { ChatCompletionContentPartText } from 'openai/resources';

type IterResult = IteratorResult<LanguageModelStreamResponsePart>;

export class StreamingAsyncIterator implements AsyncIterableIterator<LanguageModelStreamResponsePart>, Disposable {
    protected readonly requestQueue = new Array<Deferred<IterResult>>();
    protected readonly messageCache = new Array<LanguageModelStreamResponsePart>();
    protected done = false;
    protected terminalError: Error | undefined = undefined;
    protected readonly toDispose = new DisposableCollection();
    protected readonly toolCallsByIndex = new Map<number, Pick<ToolCall, 'id' | 'function'>>();

    constructor(
        protected readonly stream: ChatCompletionStream,
        cancellationToken?: CancellationToken,
    ) {
        this.registerStreamListener('error', error => {
            console.error('Error in OpenAI chat completion stream:', error);
            this.terminalError = error;
            this.dispose();
        });
        this.registerStreamListener('abort', () => {
            this.terminalError = new CancellationError();
            this.dispose();
        }, true);
        this.registerStreamListener('message', message => {
            if (message.role === 'tool') {
                this.handleIncoming({
                    tool_calls: [{
                        id: message.tool_call_id,
                        finished: true,
                        result: tryParseToolResult(message.content)
                    }]
                });
            }
            console.debug('Received Open AI message', JSON.stringify(message));
        });
        this.registerStreamListener('end', () => {
            this.dispose();
        }, true);
        this.registerStreamListener('chunk', (chunk, snapshot) => {
            // Yield token usage as a UsageResponsePart
            if (chunk.usage) {
                const inputTokens = chunk.usage.prompt_tokens || 0;
                const outputTokens = chunk.usage.completion_tokens || 0;
                if (inputTokens > 0 || outputTokens > 0) {
                    this.handleIncoming({ input_tokens: inputTokens, output_tokens: outputTokens });
                }
            }
            // Patch missing fields that OpenAI SDK requires but some providers (e.g., Copilot) don't send
            for (const choice of snapshot?.choices ?? []) {
                // Ensure role is set (required by finalizeChatCompletion)
                if (choice?.message && !choice.message.role) {
                    choice.message.role = 'assistant';
                }
                // Ensure tool_calls have type set (required by #emitToolCallDoneEvent and finalizeChatCompletion)
                if (choice?.message?.tool_calls) {
                    for (const call of choice.message.tool_calls) {
                        if (call.type === undefined) {
                            call.type = 'function';
                        }
                    }
                }
            }
            // OpenAI can push out reasoning tokens, but can't handle it as part of messages
            if (snapshot?.choices[0]?.message && Object.keys(snapshot.choices[0].message).includes('reasoning')) {
                const reasoning = (snapshot.choices[0].message as { reasoning: string }).reasoning;
                this.handleIncoming({ thought: reasoning, signature: '' });
                // delete message parts which cannot be handled by openai
                delete (snapshot.choices[0].message as { reasoning?: string }).reasoning;
                delete (snapshot.choices[0].message as { channel?: string }).channel;
                return;
            }
            const responsePart = { ...chunk.choices[0]?.delta as LanguageModelStreamResponsePart };
            this.handleIncoming(this.correlateToolCallDeltas(responsePart));
        });
        if (cancellationToken) {
            this.toDispose.push(cancellationToken.onCancellationRequested(() => stream.abort()));
        }
    }

    [Symbol.asyncIterator](): AsyncIterableIterator<LanguageModelStreamResponsePart> { return this; }

    next(): Promise<IterResult> {
        if (this.messageCache.length && this.requestQueue.length) {
            throw new Error('Assertion error: cache and queue should not both be populated.');
        }
        // Deliver all the messages we got, even if we've since terminated.
        if (this.messageCache.length) {
            return Promise.resolve({
                done: false,
                value: this.messageCache.shift()!
            });
        } else if (this.terminalError) {
            return Promise.reject(this.terminalError);
        } else if (this.done) {
            return Promise.resolve({
                done: true,
                value: undefined
            });
        } else {
            const toQueue = new Deferred<IterResult>();
            this.requestQueue.push(toQueue);
            return toQueue.promise;
        }
    }

    protected handleIncoming(message: LanguageModelStreamResponsePart): void {
        if (this.messageCache.length && this.requestQueue.length) {
            throw new Error('Assertion error: cache and queue should not both be populated.');
        }
        if (this.requestQueue.length) {
            this.requestQueue.shift()!.resolve({
                done: false,
                value: message
            });
        } else {
            this.messageCache.push(message);
        }
    }

    /**
     * OpenAI-compatible providers commonly send a tool call's id and name only
     * in its first chunk. Later chunks contain just `index` and an arguments
     * fragment. The generic chat layer needs the id to merge those fragments
     * into the original call, otherwise it treats them as anonymous calls.
     */
    protected correlateToolCallDeltas(responsePart: LanguageModelStreamResponsePart): LanguageModelStreamResponsePart {
        if (!isToolCallResponsePart(responsePart)) {
            return responsePart;
        }

        return {
            ...responsePart,
            tool_calls: responsePart.tool_calls.map((toolCall, position) => {
                const indexedToolCall = toolCall as ToolCall & { index?: number };
                const index = indexedToolCall.index ?? position;
                const previous = this.toolCallsByIndex.get(index);
                const identity = {
                    id: toolCall.id ?? previous?.id,
                    function: {
                        ...toolCall.function,
                        name: toolCall.function?.name ?? previous?.function?.name
                    }
                };
                this.toolCallsByIndex.set(index, identity);

                if (!previous || toolCall.function?.arguments === undefined) {
                    return toolCall;
                }
                const { index: _index, ...toolCallWithoutIndex } = indexedToolCall;
                return {
                    ...toolCallWithoutIndex,
                    id: identity.id,
                    function: identity.function,
                    argumentsDelta: true
                };
            })
        };
    }

    protected registerStreamListener<Event extends keyof ChatCompletionStreamEvents>(eventType: Event, handler: ChatCompletionStreamEvents[Event], once?: boolean): void {
        if (once) {
            this.stream.once(eventType, handler);
        } else {
            this.stream.on(eventType, handler);
        }
        this.toDispose.push({ dispose: () => this.stream.off(eventType, handler) });
    }

    dispose(): void {
        this.done = true;
        this.toDispose.dispose();
        // We will be receiving no more messages. Any outstanding requests have to be handled.
        if (this.terminalError) {
            this.requestQueue.forEach(request => request.reject(this.terminalError));
        } else {
            this.requestQueue.forEach(request => request.resolve({ done: true, value: undefined }));
        }
        // Leave the message cache alone - if it was populated, then the request queue was empty, but we'll still try to deliver the messages if asked.
        this.requestQueue.length = 0;
    }
}

function tryParseToolResult(result: string | ChatCompletionContentPartText[]): ToolCallResult {
    try {
        if (typeof result === 'string') {
            return JSON.parse(result);
        }
        return {
            content: result.map<ToolCallTextResult>(part => ({
                type: 'text',
                text: part.text
            }))
        };
    } catch (error) {
        return result;
    }
}
