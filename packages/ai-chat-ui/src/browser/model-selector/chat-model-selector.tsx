// *****************************************************************************
// Copyright (C) 2026 TensorGrid
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import * as React from '@theia/core/shared/react';
import { createPortal } from '@theia/core/shared/react-dom';
import {
    compareLanguageModelSelectorEntries,
    compareLanguageModelSelectorGroups,
    LanguageModelSelectorEntry,
    LanguageModelSelectorGroup,
} from '../language-model-selector-metadata';

export interface ChatModelSelectorProps {
    readonly entries: readonly LanguageModelSelectorEntry[];
    readonly currentModelId?: string;
    readonly onModelChange: (modelId: string) => void;
    readonly disabled?: boolean;
}

const normalize = (value: string): string => value.toLocaleLowerCase();

interface PopoverPosition {
    readonly right: number;
    readonly bottom: number;
    readonly maxHeight: number;
}

export const ChatModelSelector: React.FunctionComponent<ChatModelSelectorProps> = React.memo(({
    entries,
    currentModelId,
    onModelChange,
    disabled,
}) => {
    const selectedEntry = entries.find(entry => entry.model.id === currentModelId) ?? entries[0];
    const groups = React.useMemo(() => {
        const unique = new Map<string, LanguageModelSelectorGroup>();
        for (const entry of entries) {
            unique.set(entry.metadata.group.id, entry.metadata.group);
        }
        return [...unique.values()].sort(compareLanguageModelSelectorGroups);
    }, [entries]);
    const [open, setOpen] = React.useState(false);
    const [activeGroupId, setActiveGroupId] = React.useState(selectedEntry?.metadata.group.id ?? groups[0]?.id);
    const [search, setSearch] = React.useState('');
    const [popoverPosition, setPopoverPosition] = React.useState<PopoverPosition>();
    // eslint-disable-next-line no-null/no-null
    const rootRef = React.useRef<HTMLDivElement>(null);
    // eslint-disable-next-line no-null/no-null
    const popoverRef = React.useRef<HTMLDivElement>(null);
    // eslint-disable-next-line no-null/no-null
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    // eslint-disable-next-line no-null/no-null
    const searchRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (selectedEntry) {
            setActiveGroupId(selectedEntry.metadata.group.id);
        } else if (!groups.some(group => group.id === activeGroupId)) {
            setActiveGroupId(groups[0]?.id);
        }
    }, [selectedEntry, groups, activeGroupId]);

    const activeGroup = groups.find(group => group.id === activeGroupId) ?? groups[0];
    const visibleModels = React.useMemo(() => {
        const query = normalize(search.trim());
        return entries
            .filter(entry => entry.metadata.group.id === activeGroup?.id)
            .filter(entry => !query || normalize(entry.metadata.label).includes(query) || normalize(entry.model.id).includes(query))
            .sort(compareLanguageModelSelectorEntries);
    }, [entries, activeGroup, search]);

    const close = React.useCallback((restoreFocus = true) => {
        setOpen(false);
        setSearch('');
        if (restoreFocus) {
            queueMicrotask(() => triggerRef.current?.focus());
        }
    }, []);

    const openSelector = React.useCallback(() => {
        const trigger = triggerRef.current;
        if (disabled || entries.length === 0 || !trigger) {
            return;
        }
        const hostWindow = trigger.ownerDocument.defaultView ?? window;
        const triggerRect = trigger.getBoundingClientRect();
        const width = Math.min(680, hostWindow.innerWidth - 32);
        const right = hostWindow.innerWidth - triggerRect.right;
        setPopoverPosition({
            right: Math.max(16, Math.min(right, hostWindow.innerWidth - width - 16)),
            bottom: hostWindow.innerHeight - triggerRect.top + 10,
            maxHeight: Math.max(160, Math.min(520, triggerRect.top - 26)),
        });
        setActiveGroupId(selectedEntry?.metadata.group.id ?? groups[0]?.id);
        setOpen(true);
        queueMicrotask(() => searchRef.current?.focus());
    }, [disabled, entries.length, selectedEntry, groups]);

    React.useEffect(() => {
        if (!open) {
            return undefined;
        }
        const onDocumentKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
            }
        };
        const onDocumentPointerDown = (event: MouseEvent): void => {
            if (!rootRef.current?.contains(event.target as Node) && !popoverRef.current?.contains(event.target as Node)) {
                close(false);
            }
        };
        const hostDocument = triggerRef.current?.ownerDocument ?? document;
        const hostWindow = hostDocument.defaultView ?? window;
        const closeOnLayoutChange = (): void => close(false);
        hostDocument.addEventListener('keydown', onDocumentKeyDown);
        hostDocument.addEventListener('mousedown', onDocumentPointerDown);
        hostWindow.addEventListener('resize', closeOnLayoutChange);
        return () => {
            hostDocument.removeEventListener('keydown', onDocumentKeyDown);
            hostDocument.removeEventListener('mousedown', onDocumentPointerDown);
            hostWindow.removeEventListener('resize', closeOnLayoutChange);
        };
    }, [open, close]);

    const moveFocus = (event: React.KeyboardEvent<HTMLElement>, selector: string): void => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
            return;
        }
        event.preventDefault();
        const options = Array.from(rootRef.current?.querySelectorAll<HTMLElement>(selector) ?? []);
        const index = options.indexOf(event.currentTarget);
        const offset = event.key === 'ArrowDown' ? 1 : -1;
        options[(index + offset + options.length) % options.length]?.focus();
    };

    const select = (entry: LanguageModelSelectorEntry): void => {
        onModelChange(entry.model.id);
        close();
    };

    const triggerLabel = selectedEntry?.metadata.label ?? 'Select model';
    const triggerGroup = selectedEntry?.metadata.group.label;

    return <div className='theia-ChatModelSelector' ref={rootRef}>
        <button
            ref={triggerRef}
            type='button'
            className='theia-ChatModelSelector-trigger'
            disabled={disabled || entries.length === 0}
            aria-haspopup='dialog'
            aria-expanded={open}
            title={selectedEntry?.model.id}
            onClick={() => open ? close(false) : openSelector()}
            onKeyDown={event => {
                if (!open && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    openSelector();
                }
            }}
        >
            <span className='theia-ChatModelSelector-trigger-label'>{triggerLabel}</span>
            {triggerGroup && <span className='theia-ChatModelSelector-trigger-group'>{triggerGroup}</span>}
            <span className='codicon codicon-chevron-down' aria-hidden='true' />
        </button>
        {open && popoverPosition && createPortal(<div
            ref={popoverRef}
            className='theia-ChatModelSelector-popover'
            role='dialog'
            aria-label='Select language model'
            style={popoverPosition}
        >
            <section className='theia-ChatModelSelector-groups'>
                <h3>Model Group</h3>
                <div role='listbox' aria-label='Model groups'>
                    {groups.map(group => <button
                        key={group.id}
                        type='button'
                        role='option'
                        aria-selected={group.id === activeGroup?.id}
                        className={`theia-ChatModelSelector-group${group.id === activeGroup?.id ? ' selected' : ''}`}
                        title={group.label}
                        onClick={() => { setActiveGroupId(group.id); setSearch(''); }}
                        onKeyDown={event => {
                            moveFocus(event, '.theia-ChatModelSelector-group');
                            if (event.key === 'ArrowRight') {
                                event.preventDefault();
                                searchRef.current?.focus();
                            }
                        }}
                    >
                        <span>{group.label}</span>
                        {group.ratio !== undefined && <small>{group.ratio}x</small>}
                    </button>)}
                </div>
            </section>
            <section className='theia-ChatModelSelector-models'>
                <label className='theia-ChatModelSelector-search-wrap'>
                    <span className='codicon codicon-search' aria-hidden='true' />
                    <input
                        ref={searchRef}
                        className='theia-ChatModelSelector-search'
                        value={search}
                        onChange={event => setSearch(event.currentTarget.value)}
                        placeholder='Search models...'
                        aria-label='Search models'
                        onKeyDown={event => {
                            if (event.key === 'ArrowDown') {
                                event.preventDefault();
                                rootRef.current?.querySelector<HTMLButtonElement>('.theia-ChatModelSelector-model')?.focus();
                            } else if (event.key === 'ArrowLeft') {
                                event.preventDefault();
                                rootRef.current?.querySelector<HTMLButtonElement>('.theia-ChatModelSelector-group.selected')?.focus();
                            }
                        }}
                    />
                </label>
                <div className='theia-ChatModelSelector-model-list' role='listbox' aria-label='Language models'>
                    {visibleModels.map(entry => <button
                        key={entry.model.id}
                        type='button'
                        role='option'
                        aria-selected={entry.model.id === currentModelId}
                        className={`theia-ChatModelSelector-model${entry.model.id === currentModelId ? ' selected' : ''}`}
                        title={entry.model.id}
                        onClick={() => select(entry)}
                        onKeyDown={event => {
                            moveFocus(event, '.theia-ChatModelSelector-model');
                            if (event.key === 'ArrowLeft') {
                                event.preventDefault();
                                rootRef.current?.querySelector<HTMLButtonElement>('.theia-ChatModelSelector-group.selected')?.focus();
                            } else if (event.key === 'Enter') {
                                event.preventDefault();
                                select(entry);
                            }
                        }}
                    >
                        <span className='theia-ChatModelSelector-model-marker' aria-hidden='true' />
                        <span>{entry.metadata.label}</span>
                        {entry.model.id === currentModelId && <span className='codicon codicon-check' aria-hidden='true' />}
                    </button>)}
                    {visibleModels.length === 0 && <p className='theia-ChatModelSelector-empty'>No matching models</p>}
                </div>
            </section>
        </div>, triggerRef.current?.ownerDocument.body ?? document.body)}
    </div>;
});
