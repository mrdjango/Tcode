# Tcode Model Favorites Design

## Goal

Let a Tcode user mark language models as favorites from the grouped chat model selector. Favorites are local to the Tcode installation, survive restarts, and require no TensorGrid backend or catalog API change.

## User experience

- Every model row has a trailing star button.
- An empty star adds the model to favorites; a filled star removes it.
- Toggling a star does not select the model, close the selector, reset the active group, or move the current scroll position.
- When at least one available model is favorited, a virtual `Favorites` group appears first in the group column.
- A favorited model remains visible in its original catalog group as well as in `Favorites`.
- The Favorites group uses the existing search field and the existing model order: group ratio ascending, model ordering descending, then label and id.
- If a saved model is absent from the current catalog, it is hidden rather than deleted. Its favorite status returns automatically if the same stable model id reappears.
- The star control exposes `aria-label`, `aria-pressed`, keyboard activation, and a visible focus state.

## Architecture

### Local persistence

Add a small singleton `ChatModelFavoritesService` in `@theia/ai-chat-ui`. It uses Theia's existing `StorageService` under a Tcode-specific key such as `tcode.ai-chat.favorite-model-ids`.

The service owns a deduplicated set of stable language-model ids and exposes:

- an asynchronous initialization that loads and validates a stored string array;
- `isFavorite(modelId)`;
- `toggle(modelId)` and an `onDidChange` event;
- a sorted snapshot for deterministic persistence and tests.

Malformed stored values are treated as an empty list. Storage failures do not block model selection; the in-memory change remains usable for the current session.

### Widget integration

`AIChatInputWidget` consumes the singleton service, subscribes to changes, and rerenders the input. It passes the current favorite ids and a toggle callback into the pure `ChatModelSelector` React component. This keeps persistence outside the presentational component and makes both layers independently testable.

### Selector behavior

The selector prepends a reserved virtual group with id `tcode:favorites` only when at least one current entry is favorited. Selecting that group derives its model rows from all current entries whose stable ids are in the favorite set. Normal groups continue to filter by catalog group id.

Favorite toggles stop propagation so they cannot trigger the model row's selection handler. Model selection and popup scrolling keep their current behavior.

## Styling

The star sits at the trailing edge of each model row, using Theia codicons and existing foreground/focus colors. The selected-model check and favorite star remain distinct. The model label truncates before either icon, so long ids cannot widen or break the scrollable pane.

## Testing

TDD coverage will include:

1. service load, validation, deduplication, toggle, persistence, and change events;
2. Favorites group creation/removal and first-position ordering;
3. the same model appearing in Favorites and its original group;
4. toggling a star without selecting a model or closing the portal;
5. search and keyboard behavior inside Favorites;
6. the existing real overflow/scroll regression remaining intact;
7. package compile, lint, full `@theia/ai-chat-ui` tests, Electron build, and a local macOS ARM64 interaction check.

## Scope

This feature changes only Tcode/Theia client code. It does not modify TensorGrid backend models, `/v1/models`, user preferences, authentication, or model routing. No favorites are synchronized between devices.

