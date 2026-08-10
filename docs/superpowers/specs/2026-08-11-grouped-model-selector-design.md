# Grouped TensorGrid Model Selector

## Goal

Replace the compact chat model dropdown with a searchable two-pane selector that groups models by TensorGrid pricing group and always resolves a concrete ready default model. The backend catalog becomes the authoritative source for display labels, groups, ratios, and ordering.

## Scope

This feature spans two repositories:

- TensorGrid owns database fields, admin CRUD, and the backward-compatible `/v1/models` catalog contract.
- Tcode owns catalog parsing, selector metadata, default ranking, session lifecycle, and chat UI.

Provider routing remains unchanged. OpenAI-compatible, Anthropic, and Gemini models continue to use their existing native managers. No user preference is written merely to populate the dynamic catalog.

## Backend Schema

Add these nullable fields without data backfills or database defaults:

- `ModelHubPricingGroup.ratio`: `DecimalField(max_digits=6, decimal_places=3, null=True, blank=True)`.
- `ModelHubModel.ordering`: `PositiveIntegerField(null=True, blank=True)`.

The numeric ratio is stored without an `x` suffix. For example, the UI value `0.2x` is stored as `0.200`. Existing rows remain `NULL` after migration.

The Model Hub admin API and Angular admin interface support reading, creating, and editing both fields. Audit snapshots and allowed-field filtering include `ratio` and `ordering`.

## Catalog API

`GET /v1/models` preserves its OpenAI-compatible top-level fields and extends only the existing `tensorgrid` namespace:

```json
{
  "id": "tg-go:codex:gpt-5-6-sol",
  "object": "model",
  "created": 1786400000,
  "owned_by": "tg-go",
  "tensorgrid": {
    "display_name": "GPT 5.6 Sol",
    "category": "language",
    "endpoint_types": ["responses"],
    "capabilities": {},
    "group": {
      "id": "tg-go:codex",
      "slug": "codex",
      "name": "CodexPro",
      "ratio": "0.200"
    },
    "ordering": 3
  }
}
```

Group IDs combine the public provider alias and group slug because a slug is unique only within its provider. Decimal ratios are serialized as strings to preserve exact values. Nullable values are returned as JSON `null`. Only active, upstream-available models belonging to active groups and providers remain visible, preserving the current access filtering and authentication rules.

Older clients ignore the new fields. Tcode also accepts older responses without them and treats missing selection metadata as `NULL`.

## Selector Metadata Boundary

`ai-chat-ui` defines a reusable contribution contract rather than importing TensorGrid types:

```ts
interface LanguageModelSelectorMetadata {
    label: string;
    group: {
        id: string;
        label: string;
        ratio?: number;
    };
    ordering?: number;
}

interface LanguageModelSelectorMetadataProvider {
    canHandle(model: LanguageModel): number;
    getMetadata(model: LanguageModel): LanguageModelSelectorMetadata | undefined;
    readonly onDidChange?: Event<void>;
}
```

When multiple contributions handle a model, the highest `canHandle` priority wins. A model without contributed metadata receives a generic fallback group based on its vendor; if no vendor exists, it appears under `Other`.

`TensorGridModelContribution` implements this contract while retaining ownership of catalog refresh and native provider registration. Each successful catalog response first replaces its validated metadata map and then registers or updates models. Metadata changes emit `onDidChange`, including ratio or ordering changes that do not alter model IDs.

The catalog parser validates `display_name`, group identity, ratio, and ordering independently from provider-routing metadata. An invalid optional selection field is logged and treated as absent instead of rejecting an otherwise routable model.

## Default Ranking

Only models whose registry status is `ready` are candidates. Ranking is deterministic:

1. Ratio ascending, with `NULL` ratios last.
2. Ordering descending, with `NULL` ordering values last.
3. Model ID ascending as the stable final tie-break.

Thus `0.1` ranks ahead of `0.2`; for equal ratios, ordering `3` ranks ahead of `1`. If every ratio is `NULL`, the greatest non-null ordering wins. If both fields are `NULL` for every model, the lexicographically first ready model ID wins.

For a TensorGrid-managed catalog, the artificial `Default` option is removed. Once at least one ready model exists, the active chat session always contains a concrete `commonSettings.modelId`:

- A session without a model receives the highest-ranked candidate after catalog refresh completes.
- A manual user choice remains stable across later catalog or ranking changes.
- If the selected model becomes unavailable or is removed, the next highest-ranked ready model replaces it.
- No placeholder model is selected before login or when no ready model exists.

Ratio or ordering changes affect new sessions and sessions that still lack a concrete selection. They do not silently switch an existing session whose selected model remains ready.

The concrete model ID used by the request is the same ID displayed in the selector. The existing upstream default behavior remains available when no metadata provider manages any ready model.

## User Interface

The compact selector control shows the selected model label, its pricing-group label, and a chevron. The complete model ID is available in a tooltip.

Opening the control displays a Codex-style, two-pane popover:

- The left pane is titled `Model Group` and lists pricing groups ordered by ratio ascending (`NULL` last), then label.
- The right pane contains a search field and the models in the active group.
- Models are ordered by ordering descending (`NULL` last), then display label and ID.
- Search matches the display label and complete model ID within the selected group.
- The active model uses an accent border/marker and check icon.

The popover is constrained to the available viewport and becomes narrower on small chat panels without overflowing the application window. Long labels use ellipsis with full values available through tooltips.

Keyboard and accessibility behavior includes:

- Enter or Space opens the popover.
- Up and Down move within the active list.
- Left and Right move between group and model panes.
- Enter selects a model.
- Escape closes and restores focus to the trigger.
- The popover and options expose dialog/listbox semantics, `aria-selected`, and a visible focus state.

## Lifecycle and Failure Handling

Catalog refresh order is fixed: fetch, validate metadata, replace the metadata map, register/update native models, then notify selector consumers. Generation guards prevent an older asynchronous refresh from overwriting newer state.

A temporary catalog failure preserves the last successful model registrations, metadata, and current selection. Authentication failure or logout removes TensorGrid models and their metadata. Default fallback is evaluated only after a completed registry/catalog update, preventing startup races and transient selection changes.

Missing optional API fields remain backward compatible. Invalid decimal ratio strings and invalid ordering values are logged and treated as `NULL`. Duplicate group display names remain distinct because their IDs include the provider alias.

## Testing

TensorGrid coverage includes:

- Migration state and nullable schema fields.
- Admin group create/update/list for ratio.
- Admin model create/update/list for ordering.
- Audit-field preservation.
- `/v1/models` contract for display name, group identity, exact ratio string, ordering, and null values.
- Existing authentication, scope, active-model, active-group, and active-provider filters.

Tcode coverage includes:

- Backward-compatible catalog parsing and invalid optional metadata.
- TensorGrid metadata contribution refresh, replacement, and logout clearing.
- Ranking across ratio, ordering, nulls, readiness, and ID ties.
- Initial concrete selection, manual-selection preservation, and unavailable-model fallback.
- Group ordering, model ordering, search, selection, empty state, keyboard navigation, Escape, focus restoration, and ARIA state.
- Registry refresh races and metadata-only updates.

Verification runs the focused and full affected backend suites, Angular admin build/tests, affected Theia package compile/lint/tests, Electron build, and macOS ARM64 bundle signing and architecture checks.

## Acceptance Criteria

1. Admin users can store nullable pricing-group ratios and nullable non-negative model ordering values.
2. `/v1/models` exposes exact grouping and ordering metadata without breaking OpenAI-compatible clients.
3. Tcode displays a searchable two-pane model selector matching the supplied reference layout.
4. Every authenticated chat with at least one ready managed model has a concrete selected model.
5. The default follows ratio ascending, ordering descending, and ID ascending.
6. Manual selections persist until their model becomes unavailable.
7. Dynamic catalog refresh, logout, and transient failures do not produce a mismatched UI/request model.
8. Upstream provider managers remain independent of TensorGrid selection metadata.
