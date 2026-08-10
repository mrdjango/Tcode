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

import * as React from '@theia/core/shared/react';
import { nls } from '@theia/core';
import { ChatApprovalMode } from '@theia/ai-chat/lib/common/chat-tool-preferences';
import { codicon } from '@theia/core/lib/browser';

export interface ChatApprovalModeSelectorProps {
    mode: ChatApprovalMode;
    onModeChange: (mode: ChatApprovalMode) => void | Promise<void>;
    onConfigure: () => void;
    disabled?: boolean;
}

interface ApprovalChoice {
    mode: ChatApprovalMode;
    label: string;
    description: string;
    icon: string;
}

export const ChatApprovalModeSelector: React.FC<ChatApprovalModeSelectorProps> = ({ mode, onModeChange, onConfigure, disabled }) => {
    const [open, setOpen] = React.useState(false);
    // eslint-disable-next-line no-null/no-null
    const containerRef = React.useRef<HTMLDivElement>(null);
    const choices: ApprovalChoice[] = [
        {
            mode: ChatApprovalMode.ASK,
            label: nls.localize('theia/ai/chat-ui/approval/ask', 'Ask for approval'),
            description: nls.localize('theia/ai/chat-ui/approval/askDescription', 'Always ask before executing tools'),
            icon: 'hand'
        },
        {
            mode: ChatApprovalMode.AUTO,
            label: nls.localize('theia/ai/chat-ui/approval/auto', 'Approve for me'),
            description: nls.localize('theia/ai/chat-ui/approval/autoDescription', 'Only ask for actions marked as potentially unsafe'),
            icon: 'shield'
        },
        {
            mode: ChatApprovalMode.CUSTOM,
            label: nls.localizeByDefault('Custom'),
            description: nls.localize('theia/ai/chat-ui/approval/customDescription', 'Use the per-tool permissions in AI Configuration'),
            icon: 'settings-gear'
        }
    ];
    const active = choices.find(choice => choice.mode === mode) ?? choices[0];

    React.useEffect(() => {
        if (!open) {
            return;
        }
        const closeOnOutsidePointer = (event: MouseEvent): void => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', closeOnOutsidePointer);
        return () => document.removeEventListener('mousedown', closeOnOutsidePointer);
    }, [open]);

    const select = (choice: ApprovalChoice): void => {
        setOpen(false);
        if (choice.mode === ChatApprovalMode.CUSTOM) {
            onConfigure();
        } else {
            onModeChange(choice.mode);
        }
    };

    return <div className='theia-chat-approval-selector' ref={containerRef}>
        <button
            type='button'
            className='theia-chat-approval-trigger'
            disabled={disabled}
            aria-haspopup='menu'
            aria-expanded={open}
            onClick={() => setOpen(current => !current)}
        >
            <span className={codicon(active.icon)} />
            <span>{active.label}</span>
            <span className={codicon('chevron-down')} />
        </button>
        {open && <div className='theia-chat-approval-menu' role='menu'>
            <div className='theia-chat-approval-heading'>
                {nls.localize('theia/ai/chat-ui/approval/heading', 'How should Tcode actions be approved?')}
            </div>
            {choices.map(choice => <button
                type='button'
                role='menuitemradio'
                aria-checked={choice.mode === mode}
                className='theia-chat-approval-choice'
                key={choice.mode}
                onClick={() => select(choice)}
            >
                <span className={`theia-chat-approval-choice-icon ${codicon(choice.icon)}`} />
                <span className='theia-chat-approval-choice-copy'>
                    <span className='theia-chat-approval-choice-label'>{choice.label}</span>
                    <span className='theia-chat-approval-choice-description'>{choice.description}</span>
                </span>
                {choice.mode === mode && <span className={`theia-chat-approval-check ${codicon('check')}`} />}
            </button>)}
        </div>}
    </div>;
};
