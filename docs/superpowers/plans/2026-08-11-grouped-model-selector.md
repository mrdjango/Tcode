# Grouped TensorGrid Model Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add TensorGrid pricing-group metadata and deterministic model ordering to the backend catalog, then replace Tcode's chat model dropdown with an accessible grouped selector that always chooses a concrete ready default model.

**Architecture:** TensorGrid remains authoritative for `ratio`, `ordering`, display labels, and group identity. `ai-chat-ui` exposes a generic selector-metadata contribution and pure ranking helpers; `@tcode/tensorgrid-ai` parses the catalog and supplies that contribution without adding TensorGrid dependencies to upstream provider managers. The chat session writes a concrete `commonSettings.modelId` only after a completed managed catalog refresh.

**Tech Stack:** Django/DRF, Angular, TypeScript/React, Inversify contributions, Mocha/Chai/Sinon, Electron Builder, Yarn workspaces.

## Global Constraints

- Work in `/Users/mrmc/Dev/GitHub/TensorGrid` for backend/admin changes and `/Users/mrmc/Dev/GitHub/theia` for Tcode changes; commit and push each repository separately.
- Preserve existing uncommitted user work and generated artifacts outside this scope.
- Follow TDD: add a focused failing test, run it to confirm RED, implement the minimum change, then rerun to GREEN.
- Keep `@theia/ai-openai`, `@theia/ai-anthropic`, and `@theia/ai-google` independent of TensorGrid selector metadata.
- Keep `/v1/models` backward compatible by extending only the existing `tensorgrid` object.
- After source edits, run `rtk graphify update .` in both repositories.

### Task 1: Add nullable selector metadata to the TensorGrid schema

**Files:**
- Modify: `/Users/mrmc/Dev/GitHub/TensorGrid/backend/model_hub/models.py`
- Create: `/Users/mrmc/Dev/GitHub/TensorGrid/backend/model_hub/migrations/0030_model_selector_metadata.py`
- Test: `/Users/mrmc/Dev/GitHub/TensorGrid/backend/model_hub/tests/test_models.py`

- [ ] Add a model test asserting that pricing-group `ratio` accepts `Decimal('0.200')` and `NULL`, and model `ordering` accepts non-negative integers and `NULL`.
- [ ] Run `rtk uv run python manage.py test model_hub.tests.test_models` from `backend` and confirm the test fails because the fields do not exist.
- [ ] Add `ratio = models.DecimalField(max_digits=6, decimal_places=3, null=True, blank=True)` to `ModelHubPricingGroup`.
- [ ] Add `ordering = models.PositiveIntegerField(null=True, blank=True)` to `ModelHubModel`.
- [ ] Generate migration `0030_model_selector_metadata.py` with `rtk uv run python manage.py makemigrations model_hub` and inspect it to ensure there is no default or data migration.
- [ ] Rerun the focused test and `rtk uv run python manage.py makemigrations --check`.
- [ ] Commit in TensorGrid: `feat(model-hub): add model selector metadata fields`.

### Task 2: Expose ratio and ordering through the admin API

**Files:**
- Modify: `/Users/mrmc/Dev/GitHub/TensorGrid/backend/admin_panel/views/model_hub_simple.py`
- Test: `/Users/mrmc/Dev/GitHub/TensorGrid/backend/admin_panel/tests/test_simple_model_hub_api.py`
- Modify: `/Users/mrmc/Dev/GitHub/TensorGrid/backend/model_hub/admin.py`

- [ ] Add admin API tests for creating/updating/listing group `ratio`, creating/updating/listing model `ordering`, explicit `null`, rejection of negative ordering, and audit snapshots containing both fields.
- [ ] Run `rtk uv run python manage.py test admin_panel.tests.test_simple_model_hub_api` and confirm RED.
- [ ] Add nullable DRF fields:
  - `ratio = serializers.DecimalField(max_digits=6, decimal_places=3, required=False, allow_null=True)` to `GroupPayload`.
  - `ordering = serializers.IntegerField(min_value=0, required=False, allow_null=True)` to create/patch model payloads.
- [ ] Include `ratio` in `_group`, `ordering` in `_model`, and both in `_audit.allowed_fields`; ensure PATCH updates only submitted fields and preserves explicit `null`.
- [ ] Add ratio/ordering to useful Django-admin list/edit surfaces without exposing secrets.
- [ ] Rerun the focused admin API suite.
- [ ] Commit in TensorGrid: `feat(admin): manage model selector ranking metadata`.

### Task 3: Add ratio and ordering controls to the Angular admin

**Files:**
- Modify: `/Users/mrmc/Dev/GitHub/TensorGrid/admin-frontend/src/app/features/model-hub/simple-model-hub.component.ts`
- Test: `/Users/mrmc/Dev/GitHub/TensorGrid/admin-frontend/src/app/features/model-hub/simple-model-hub.component.spec.ts`

- [ ] Add component tests verifying ratio and ordering are loaded into edit forms, blank values serialize as `null`, and numeric values serialize without an `x` suffix.
- [ ] Run the focused Angular test command discovered from `admin-frontend/package.json` and confirm RED.
- [ ] Extend `Group` and `Model` interfaces and create/edit form state with `ratio: number | null` and `ordering: number | null`.
- [ ] Add optional numeric fields to group/model dialogs, showing ratio with an `x` suffix only as presentation text; permit decimal steps for ratio and non-negative integers for ordering.
- [ ] Display ratio and ordering in the corresponding tables and submit `null` for blank input.
- [ ] Rerun focused tests and `rtk npm run build` from `admin-frontend`.
- [ ] Commit in TensorGrid: `feat(admin-ui): edit model ratio and ordering`.

### Task 4: Extend the authenticated `/v1/models` catalog contract

**Files:**
- Modify: `/Users/mrmc/Dev/GitHub/TensorGrid/backend/model_hub/gateway.py`
- Test: `/Users/mrmc/Dev/GitHub/TensorGrid/backend/model_hub/tests/test_gateway.py`

- [ ] Extend gateway contract tests to expect `display_name`, stable group `id/slug/name/ratio`, and model `ordering`, including exact decimal string and `null` cases.
- [ ] Add filter assertions for inactive provider/group/model and unavailable upstream model while retaining the API-key scope checks.
- [ ] Run `rtk uv run python manage.py test model_hub.tests.test_gateway` and confirm RED.
- [ ] Serialize metadata as:
  ```python
  'display_name': row.display_name,
  'group': {
      'id': f'{row.provider.effective_public_alias}:{row.pricing_group.slug}',
      'slug': row.pricing_group.slug,
      'name': row.pricing_group.display_name,
      'ratio': format(row.pricing_group.ratio, 'f') if row.pricing_group.ratio is not None else None,
  },
  'ordering': row.ordering,
  ```
- [ ] Use `select_related('pricing_group', 'pricing_group__provider')` without changing existing active/access filters.
- [ ] Rerun gateway tests and the affected backend suites.
- [ ] Commit in TensorGrid: `feat(api): publish model selector catalog metadata`.

### Task 5: Add a generic selector metadata contribution and deterministic ranking

**Files:**
- Create: `/Users/mrmc/Dev/GitHub/theia/packages/ai-chat-ui/src/browser/language-model-selector-metadata.ts`
- Create: `/Users/mrmc/Dev/GitHub/theia/packages/ai-chat-ui/src/browser/language-model-selector-metadata.spec.ts`
- Modify: `/Users/mrmc/Dev/GitHub/theia/packages/ai-chat-ui/src/browser/ai-chat-ui-frontend-module.ts`

- [ ] Write tests for highest-priority provider selection, vendor/`Other` fallback groups, ratio ascending with null last, ordering descending with null last, label/ID ties, and filtering to `ready` models.
- [ ] Run `rtk yarn workspace @theia/ai-chat-ui test --grep "language model selector metadata"` and confirm RED.
- [ ] Define `LanguageModelSelectorMetadata`, `LanguageModelSelectorMetadataProvider`, a contribution symbol/provider, and an aggregate service that listens to optional `onDidChange` events.
- [ ] Implement pure functions for group sorting, model sorting, and managed default ranking. Keep numeric validity checks finite and non-negative.
- [ ] Bind the contribution provider and aggregate service in the frontend module.
- [ ] Rerun focused tests, package compile, and package lint.
- [ ] Commit in Tcode: `feat(ai-chat-ui): add model selector metadata contributions`.

### Task 6: Parse TensorGrid selector metadata and publish contribution updates

**Files:**
- Modify: `/Users/mrmc/Dev/GitHub/theia/packages/tcode-tensorgrid-ai/src/common/tensorgrid-catalog-service.ts`
- Modify: `/Users/mrmc/Dev/GitHub/theia/packages/tcode-tensorgrid-ai/src/node/tensorgrid-catalog-service-impl.ts`
- Modify: `/Users/mrmc/Dev/GitHub/theia/packages/tcode-tensorgrid-ai/src/browser/tensorgrid-model-contribution.ts`
- Modify: `/Users/mrmc/Dev/GitHub/theia/packages/tcode-tensorgrid-ai/src/browser/tensorgrid-frontend-module.ts`
- Test: `/Users/mrmc/Dev/GitHub/theia/packages/tcode-tensorgrid-ai/src/node/tensorgrid-catalog-service-impl.spec.ts`
- Test: `/Users/mrmc/Dev/GitHub/theia/packages/tcode-tensorgrid-ai/src/browser/tensorgrid-model-contribution.spec.ts`

- [ ] Add parser tests for complete metadata, older responses, invalid ratio, negative/fractional ordering, duplicate display names with distinct group IDs, and routable models with invalid optional metadata.
- [ ] Add contribution tests for metadata-map replacement, metadata-only change events, stale generation rejection, transient failure preservation, and logout clearing.
- [ ] Run `rtk yarn workspace @tcode/tensorgrid-ai test` and confirm the new tests fail.
- [ ] Extend `TensorGridCatalogModel` with optional display/group/ratio/ordering data while leaving routing fields unchanged.
- [ ] Parse ratio strings to finite non-negative numbers and ordering to non-negative integers; log and omit invalid optional values.
- [ ] Make `TensorGridModelContribution` implement `LanguageModelSelectorMetadataProvider`, update its metadata map before registrations, await registration completion, then emit `onDidChange`.
- [ ] Preserve the last successful map/models on temporary fetch failure; clear both only for logout/auth failure; guard async refreshes with a generation counter.
- [ ] Bind the contribution under the generic ai-chat-ui token.
- [ ] Rerun extension test, compile, and lint.
- [ ] Commit in Tcode: `feat(tensorgrid): contribute dynamic model selector metadata`.

### Task 7: Build the Codex-style two-pane selector

**Files:**
- Create: `/Users/mrmc/Dev/GitHub/theia/packages/ai-chat-ui/src/browser/model-selector/chat-model-selector.tsx`
- Create: `/Users/mrmc/Dev/GitHub/theia/packages/ai-chat-ui/src/browser/model-selector/chat-model-selector.spec.tsx`
- Modify: `/Users/mrmc/Dev/GitHub/theia/packages/ai-chat-ui/src/browser/chat-input-widget.tsx`
- Modify: `/Users/mrmc/Dev/GitHub/theia/packages/ai-chat-ui/src/browser/style/index.css`

- [ ] Add component tests for grouped rendering, group/model ordering, group-scoped search by label and ID, selected accent/check, empty state, and compact trigger labels/tooltips.
- [ ] Add keyboard/ARIA tests for Enter/Space, Up/Down, Left/Right, Enter selection, Escape close/focus restoration, `dialog`, `listbox`, and `aria-selected`.
- [ ] Run the focused ai-chat-ui tests and confirm RED.
- [ ] Implement an independent React popover component with two panes, search, viewport-constrained positioning, responsive single-column fallback, ellipsis, and full-value tooltips.
- [ ] Replace only the model `SelectComponent` in `ChatInputWidget`; retain mode/reasoning selectors.
- [ ] Use the aggregate metadata service to build view models, falling back to vendor or `Other` for unmanaged entries.
- [ ] Add theme-variable CSS matching the supplied Codex-style reference and preserve existing RTL behavior in the input/message body.
- [ ] Rerun focused component tests, compile, and lint.
- [ ] Commit in Tcode: `feat(ai-chat-ui): add grouped searchable model selector`.

### Task 8: Enforce a concrete managed default model safely

**Files:**
- Modify: `/Users/mrmc/Dev/GitHub/theia/packages/ai-chat-ui/src/browser/chat-input-widget.tsx`
- Create or modify: `/Users/mrmc/Dev/GitHub/theia/packages/ai-chat-ui/src/browser/chat-input-widget.spec.tsx`

- [ ] Add lifecycle tests for initial managed default, readiness filtering, manual-selection preservation, selected-model removal fallback, no fake selection before login, unmanaged upstream default behavior, metadata-only reorder stability, and stale refresh races.
- [ ] Run focused lifecycle tests and confirm RED.
- [ ] After a completed registry/metadata update, rank ready managed models by ratio ascending, ordering descending, and ID ascending.
- [ ] Write the winner to `session.settings.commonSettings.modelId` only when no concrete managed choice exists or the current selection is no longer ready.
- [ ] Remove the artificial `Default` row only when at least one ready metadata-managed model exists; preserve upstream default behavior otherwise.
- [ ] Ensure selector and request resolution consume the same concrete model ID and do not switch valid manual choices on ratio/order-only changes.
- [ ] Rerun lifecycle tests, the full ai-chat-ui test suite, compile, and lint.
- [ ] Commit in Tcode: `feat(ai-chat-ui): select deterministic ready model defaults`.

### Task 9: Verify, update graphs, push, and build macOS ARM64

**Files:**
- Modify generated graph data only through Graphify in both repositories.
- Build artifact: `/Users/mrmc/Dev/GitHub/theia/dist-arm64/Tcode.app`

- [ ] Run TensorGrid backend verification:
  - `rtk uv run python manage.py test model_hub.tests.test_models model_hub.tests.test_gateway admin_panel.tests.test_simple_model_hub_api`
  - `rtk uv run python manage.py makemigrations --check`
- [ ] Run Angular admin verification using the package's test command and `rtk npm run build`.
- [ ] Run Tcode verification:
  - `rtk yarn workspace @tcode/tensorgrid-ai compile`
  - `rtk yarn workspace @tcode/tensorgrid-ai lint`
  - `rtk yarn workspace @tcode/tensorgrid-ai test`
  - `rtk yarn workspace @theia/ai-chat-ui compile`
  - `rtk yarn workspace @theia/ai-chat-ui lint`
  - `rtk yarn workspace @theia/ai-chat-ui test`
- [ ] Run relevant existing `ai-openai`, `ai-anthropic`, and `ai-google` suites to catch integration regressions.
- [ ] Run `rtk git diff --check` and inspect staged files for credentials, tokens, and generated build artifacts in both repositories.
- [ ] Run `rtk graphify update .` in both repositories and commit only intentional graph updates if repository policy tracks them.
- [ ] Push TensorGrid `master` and Tcode `master` to their configured origins after verifying remotes and clean commit scope.
- [ ] Build Tcode Electron and the macOS ARM64 bundle using the repository's existing Tcode packaging command.
- [ ] Verify `Tcode.app` with `rtk file`, `rtk codesign --verify --deep --strict --verbose=2`, `rtk codesign -dv --verbose=4`, and inspect `Info.plist` to confirm product name `Tcode`, bundle identifier `TensorGrid.Tcode`, and URI scheme `tcode`.

