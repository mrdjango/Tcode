# Tcode Model Favorites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a local-only Favorites group and star controls to Tcode's grouped chat model selector.

**Architecture:** A singleton `ChatModelFavoritesService` owns a validated set of stable model IDs persisted through Theia `StorageService`. `AIChatInputWidget` subscribes to that service and passes favorite state/callbacks to the pure `ChatModelSelector`, which prepends a virtual Favorites group and renders independently focusable star buttons.

**Tech Stack:** TypeScript, React, Inversify, Theia `StorageService`/`Emitter`, Mocha/Chai DOM tests, Theia CSS, Electron ARM64 bundle.

## Global Constraints

- Favorites are local to Tcode; no TensorGrid backend, catalog, routing, or user preference changes.
- Favorites use stable language-model IDs and survive restarts.
- Missing catalog models remain persisted but are not displayed.
- Existing portal interaction, model selection, and scroll behavior must remain intact.
- Every shell command is prefixed with `rtk`; no push is performed.

### Task 1: Local favorites service

**Files:**
- Create: `packages/ai-chat-ui/src/browser/model-selector/chat-model-favorites-service.ts`
- Create: `packages/ai-chat-ui/src/browser/model-selector/chat-model-favorites-service.spec.ts`
- Modify: `packages/ai-chat-ui/src/browser/ai-chat-ui-frontend-module.ts`

**Interfaces:**
- `ChatModelFavoritesService` exposes `ready: Promise<void>`, `onDidChange: Event<readonly string[]>`, `getFavoriteModelIds(): readonly string[]`, `isFavorite(modelId: string): boolean`, and `toggle(modelId: string): Promise<void>`.
- The service persists the sorted, deduplicated string array under `tcode.ai-chat.favorite-model-ids` via injected `StorageService`.

- [ ] Write failing tests for malformed storage, deduplication, initialization, toggle persistence, and change events.
- [ ] Run `rtk npm test --workspace @theia/ai-chat-ui -- --grep ChatModelFavoritesService` and confirm the new tests fail because the service is absent.
- [ ] Implement the service and bind it as a singleton in the frontend module.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Selector Favorites group and star controls

**Files:**
- Modify: `packages/ai-chat-ui/src/browser/model-selector/chat-model-selector.tsx`
- Modify: `packages/ai-chat-ui/src/browser/model-selector/chat-model-selector.spec.tsx`
- Modify: `packages/ai-chat-ui/src/browser/style/index.css`

**Interfaces:**
- Extend `ChatModelSelectorProps` with `favoriteModelIds: ReadonlySet<string>` and `onToggleFavorite: (modelId: string) => void`.
- The reserved group is `{ id: 'tcode:favorites', label: 'Favorites' }` and is present only when at least one current entry is favorite.

- [ ] Add failing component tests for virtual group ordering, filtering favorite entries, star accessibility/state, and star clicks not selecting or closing.
- [ ] Run the focused selector tests and confirm the new assertions fail.
- [ ] Implement the virtual group, favorite filtering, trailing star buttons, stop-propagation behavior, and CSS truncation/focus styling without changing the existing scroll container.
- [ ] Run selector tests and confirm all pass, including the existing scroll regression.

### Task 3: Wire service into chat input

**Files:**
- Modify: `packages/ai-chat-ui/src/browser/chat-input-widget.tsx`

**Interfaces:**
- Inject `ChatModelFavoritesService` into `AIChatInputWidget`.
- Await `favorites.ready` before rendering the managed selector, subscribe to `onDidChange`, and pass a `ReadonlySet` snapshot plus `toggle` callback to `ChatModelSelector`.

- [ ] Add a widget-level test or existing contribution test proving the selector receives restored favorites and rerenders after toggling.
- [ ] Run the focused widget test and confirm it fails before wiring.
- [ ] Implement lifecycle-safe subscription/disposal and a non-blocking fallback when local storage fails.
- [ ] Run focused tests and confirm they pass.

### Task 4: Verification and local Tcode build

**Files:**
- No additional source files; generated output only under `dist-arm64/`.

- [ ] Run `rtk npm run compile --workspace @theia/ai-chat-ui`.
- [ ] Run `rtk npm run lint --workspace @theia/ai-chat-ui` and `rtk npm test --workspace @theia/ai-chat-ui`.
- [ ] Build `@theia/example-electron`, copy its `lib` and `package.json` into `dist-arm64/Tcode.app`, ad-hoc sign, and verify the ARM64 Mach-O binary.
- [ ] Launch the local app and use CDP to verify: Favorites appears first, star toggling leaves the popup open, the model is still selectable from its original group, persistence is restored after rerender, and scrolling still changes `scrollTop` with `scrollHeight > clientHeight`.
- [ ] Run `rtk graphify update .`, `rtk git diff --check`, and inspect `rtk git status --short`.
- [ ] Do not push any branch or remote.

