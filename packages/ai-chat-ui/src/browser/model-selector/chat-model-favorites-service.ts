// *****************************************************************************
// Copyright (C) 2026 TensorGrid
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { Emitter, Event } from '@theia/core';
import { StorageService } from '@theia/core/lib/browser';
import { inject, injectable } from '@theia/core/shared/inversify';

export const CHAT_MODEL_FAVORITES_STORAGE_KEY = 'tcode.ai-chat.favorite-model-ids';

@injectable()
export class ChatModelFavoritesService {
    protected readonly storageService: StorageService;

    protected readonly changeEmitter = new Emitter<readonly string[]>();
    readonly onDidChange: Event<readonly string[]> = this.changeEmitter.event;
    readonly ready: Promise<void>;
    protected favoriteModelIds = new Set<string>();

    constructor(@inject(StorageService) storageService: StorageService) {
        this.storageService = storageService;
        this.ready = this.load();
    }

    getFavoriteModelIds(): readonly string[] {
        return this.snapshot();
    }

    isFavorite(modelId: string): boolean {
        return this.favoriteModelIds.has(modelId);
    }

    async toggle(modelId: string): Promise<void> {
        await this.ready;
        if (this.favoriteModelIds.has(modelId)) {
            this.favoriteModelIds.delete(modelId);
        } else if (modelId.trim()) {
            this.favoriteModelIds.add(modelId);
        }
        const snapshot = this.snapshot();
        try {
            await this.storageService.setData(CHAT_MODEL_FAVORITES_STORAGE_KEY, snapshot);
        } catch {
            // Keep the in-memory state usable if local storage is unavailable.
        }
        this.changeEmitter.fire(snapshot);
    }

    protected async load(): Promise<void> {
        try {
            const stored = await this.storageService.getData<unknown>(CHAT_MODEL_FAVORITES_STORAGE_KEY);
            if (Array.isArray(stored)) {
                this.favoriteModelIds = new Set(
                    stored
                        .filter((value): value is string => typeof value === 'string')
                        .map(value => value.trim())
                        .filter(Boolean)
                );
            }
        } catch {
            this.favoriteModelIds.clear();
        }
    }

    protected snapshot(): readonly string[] {
        return [...this.favoriteModelIds].sort((left, right) => left.localeCompare(right));
    }
}
