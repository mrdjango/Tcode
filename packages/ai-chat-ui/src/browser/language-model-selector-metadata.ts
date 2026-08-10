// *****************************************************************************
// Copyright (C) 2026 TensorGrid
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { ContributionProvider, Emitter, Event } from '@theia/core';
import { LanguageModel } from '@theia/ai-core';
import { inject, injectable, named, postConstruct } from '@theia/core/shared/inversify';

export interface LanguageModelSelectorGroup {
    readonly id: string;
    readonly label: string;
    readonly ratio?: number;
}

export interface LanguageModelSelectorMetadata {
    readonly label: string;
    readonly group: LanguageModelSelectorGroup;
    readonly ordering?: number;
}

export const LanguageModelSelectorMetadataProvider = Symbol('LanguageModelSelectorMetadataProvider');
export interface LanguageModelSelectorMetadataProvider {
    canHandle(model: LanguageModel): number;
    getMetadata(model: LanguageModel): LanguageModelSelectorMetadata | undefined;
    readonly onDidChange?: Event<void>;
}

export interface LanguageModelSelectorEntry {
    readonly model: LanguageModel;
    readonly metadata: LanguageModelSelectorMetadata;
    readonly managed: boolean;
}

const isNonNegativeFinite = (value: number | undefined): boolean =>
    value === undefined || Number.isFinite(value) && value >= 0;

const isValidMetadata = (metadata: LanguageModelSelectorMetadata | undefined): metadata is LanguageModelSelectorMetadata =>
    !!metadata
    && !!metadata.label.trim()
    && !!metadata.group.id.trim()
    && !!metadata.group.label.trim()
    && isNonNegativeFinite(metadata.group.ratio)
    && (metadata.ordering === undefined || Number.isInteger(metadata.ordering) && metadata.ordering >= 0);

export function getLanguageModelSelectorMetadata(
    model: LanguageModel,
    providers: readonly LanguageModelSelectorMetadataProvider[],
): LanguageModelSelectorMetadata | undefined {
    const candidates = providers
        .map(provider => ({ provider, priority: provider.canHandle(model) }))
        .filter(candidate => Number.isFinite(candidate.priority) && candidate.priority > 0)
        .sort((left, right) => right.priority - left.priority);
    for (const candidate of candidates) {
        const metadata = candidate.provider.getMetadata(model);
        if (isValidMetadata(metadata)) {
            return metadata;
        }
    }
    return undefined;
}

export function toLanguageModelSelectorEntry(
    model: LanguageModel,
    providers: readonly LanguageModelSelectorMetadataProvider[],
): LanguageModelSelectorEntry {
    const contributed = getLanguageModelSelectorMetadata(model, providers);
    if (contributed) {
        return { model, metadata: contributed, managed: true };
    }
    const groupLabel = model.vendor?.trim() || 'Other';
    return {
        model,
        managed: false,
        metadata: {
            label: model.name?.trim() || model.id,
            group: {
                id: model.vendor?.trim() ? `vendor:${model.vendor.trim()}` : 'other',
                label: groupLabel,
            },
        },
    };
}

const compareNullableAscending = (left: number | undefined, right: number | undefined): number => {
    if (left === undefined) {
        return right === undefined ? 0 : 1;
    }
    return right === undefined ? -1 : left - right;
};

const compareNullableDescending = (left: number | undefined, right: number | undefined): number => {
    if (left === undefined) {
        return right === undefined ? 0 : 1;
    }
    return right === undefined ? -1 : right - left;
};

export function compareLanguageModelSelectorGroups(
    left: LanguageModelSelectorGroup,
    right: LanguageModelSelectorGroup,
): number {
    return compareNullableAscending(left.ratio, right.ratio)
        || left.label.localeCompare(right.label)
        || left.id.localeCompare(right.id);
}

export function compareLanguageModelSelectorEntries(
    left: LanguageModelSelectorEntry,
    right: LanguageModelSelectorEntry,
): number {
    return compareNullableAscending(left.metadata.group.ratio, right.metadata.group.ratio)
        || compareNullableDescending(left.metadata.ordering, right.metadata.ordering)
        || left.metadata.label.localeCompare(right.metadata.label)
        || left.model.id.localeCompare(right.model.id);
}

export function rankReadyManagedLanguageModels(
    models: readonly LanguageModel[],
    providers: readonly LanguageModelSelectorMetadataProvider[],
): LanguageModelSelectorEntry[] {
    return models
        .filter(model => model.status.status === 'ready')
        .map(model => toLanguageModelSelectorEntry(model, providers))
        .filter(entry => entry.managed)
        .sort(compareLanguageModelSelectorEntries);
}

@injectable()
export class LanguageModelSelectorMetadataService {
    @inject(ContributionProvider) @named(LanguageModelSelectorMetadataProvider)
    protected readonly contributionProvider: ContributionProvider<LanguageModelSelectorMetadataProvider>;

    protected readonly changeEmitter = new Emitter<void>();
    readonly onDidChange: Event<void> = this.changeEmitter.event;

    @postConstruct()
    protected init(): void {
        for (const provider of this.getProviders()) {
            provider.onDidChange?.(() => this.changeEmitter.fire());
        }
    }

    getProviders(): LanguageModelSelectorMetadataProvider[] {
        return this.contributionProvider.getContributions();
    }

    getMetadata(model: LanguageModel): LanguageModelSelectorMetadata | undefined {
        return getLanguageModelSelectorMetadata(model, this.getProviders());
    }

    toEntry(model: LanguageModel): LanguageModelSelectorEntry {
        return toLanguageModelSelectorEntry(model, this.getProviders());
    }

    rankReadyManaged(models: readonly LanguageModel[]): LanguageModelSelectorEntry[] {
        return rankReadyManagedLanguageModels(models, this.getProviders());
    }
}
