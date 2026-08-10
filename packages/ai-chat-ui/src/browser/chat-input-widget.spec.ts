// *****************************************************************************
// Copyright (C) 2026 EclipseSource and others.
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

import { FrontendApplicationConfigProvider } from '@theia/core/lib/browser/frontend-application-config-provider';
FrontendApplicationConfigProvider.set({});

import 'reflect-metadata';

import { expect } from 'chai';
import { ParsedCapability } from '@theia/ai-core';
import { AIChatInputWidget, getChatInputTextDirection, getVisibleCapabilities } from './chat-input-widget';
import { TextDirection } from '@theia/monaco-editor-core/esm/vs/editor/common/model';

disableJSDOM();

class TestChatInputWidget extends AIChatInputWidget {

    readonly updateCalls: Array<{ agentId: string; modeId?: string; preserveOverrides?: boolean }> = [];

    setReceivingAgent(agentId: string, modeId?: string): void {
        this.receivingAgent = {
            agentId,
            modes: [],
            currentModeId: modeId
        };
    }

    refreshCapabilitiesForTest(): Promise<void> {
        return this.refreshCapabilities();
    }

    protected override async updateCapabilitiesForAgent(agentId: string, modeId?: string, preserveOverrides?: boolean): Promise<void> {
        this.updateCalls.push({ agentId, modeId, preserveOverrides });
    }

    override update(): void {
        // no-op
    }
}

describe('AIChatInputWidget', () => {
    before(() => disableJSDOM = enableJSDOM());
    after(() => disableJSDOM());

    describe('refreshCapabilities', () => {
        it('preserves capability selections while reloading prompt-template capabilities', async () => {
            const widget = new TestChatInputWidget();
            widget.setReceivingAgent('test-agent', 'test-mode');

            await widget.refreshCapabilitiesForTest();

            expect(widget.updateCalls).to.deep.equal([{
                agentId: 'test-agent',
                modeId: 'test-mode',
                preserveOverrides: true
            }]);
        });
    });

    describe('collapsed capabilities', () => {
        const capabilities = [
            { fragmentId: 'shell', name: 'Shell', defaultEnabled: true },
            { fragmentId: 'github', name: 'GitHub', defaultEnabled: false },
            { fragmentId: 'e2e', name: 'E2E', defaultEnabled: false }
        ] as ParsedCapability[];

        it('shows only capabilities that are currently selected', () => {
            const visible = getVisibleCapabilities(capabilities, new Map([
                ['shell', false],
                ['github', true]
            ]));

            expect(visible.map(capability => capability.fragmentId)).to.deep.equal(['github']);
        });

        it('uses capability defaults when there is no explicit override', () => {
            const visible = getVisibleCapabilities(capabilities, new Map());

            expect(visible.map(capability => capability.fragmentId)).to.deep.equal(['shell']);
        });
    });

    describe('input text direction', () => {
        it('uses RTL when Persian is the first strong text, including inline technical terms', () => {
            expect(getChatInputTextDirection('رو بررسی کن gitignore فایل')).to.equal(TextDirection.RTL);
        });

        it('uses LTR when Latin text is the first strong text', () => {
            expect(getChatInputTextDirection('Review gitignore و نتیجه را بگو')).to.equal(TextDirection.LTR);
        });

        it('ignores punctuation and numbers before Persian text', () => {
            expect(getChatInputTextDirection('123 - فایل را بررسی کن')).to.equal(TextDirection.RTL);
        });

        it('defaults empty and symbol-only lines to LTR', () => {
            expect(getChatInputTextDirection('')).to.equal(TextDirection.LTR);
            expect(getChatInputTextDirection('123 +-_')).to.equal(TextDirection.LTR);
        });
    });
});
