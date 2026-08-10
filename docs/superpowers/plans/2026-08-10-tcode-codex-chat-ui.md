# Tcode Codex-Inspired Chat UI Implementation Plan

> **For Codex:** Execute this plan task-by-task with the `superpowers:executing-plans` and `superpowers:test-driven-development` skills. Do not commit `.superpowers/`.

**Goal:** Give Tcode's AI Chat a compact, Codex-inspired adaptive layout, keep only selected capabilities visible beside a `+` control, and render Persian/Arabic and mixed technical content correctly without changing chat persistence or provider protocols.

**Architecture:** Reusable semantic structure and bidi behavior live in `@theia/ai-chat-ui`; Tcode-specific visual polish is loaded from `@tcode/tensorgrid-ai`. Existing response models, renderers, confirmation flows, and composer state remain authoritative. CSS classes provide the responsive desktop/panel layouts while explicit `dir="auto"` boundaries and LTR isolation protect code, paths, model IDs, and tool output.

**Tech Stack:** TypeScript, React, Theia `ReactWidget`, Monaco editor, CSS, Mocha/Chai/JSDOM, Yarn workspaces, Electron Builder.

---

## Task 1: Add semantic bidi boundaries

**Files:**
- Modify: `packages/ai-chat-ui/src/browser/chat-response-renderer/markdown-part-renderer.tsx`
- Modify: `packages/ai-chat-ui/src/browser/chat-tree-view/chat-view-tree-widget.tsx`
- Modify: `packages/ai-chat-ui/src/browser/style/index.css`
- Test: `packages/ai-chat-ui/src/browser/chat-response-renderer/markdown-part-renderer.spec.tsx`
- Test: `packages/ai-chat-ui/src/browser/chat-tree-view/chat-view-tree-widget.spec.tsx`

1. Add failing JSDOM assertions that markdown and user-request text roots use `dir="auto"`, and that technical descendants (`pre`, `code`, model badges, tool-call labels) are eligible for LTR isolation.
2. Run the two focused specs and confirm the new assertions fail.
3. Add `dir="auto"` to `MarkdownRender` and to the request-text paragraph. Add semantic classes for prose and technical metadata rather than inferring direction from the UI locale.
4. Add reusable bidi CSS:

```css
.theia-ChatProse {
  direction: auto;
  text-align: start;
  unicode-bidi: plaintext;
}

.theia-ChatTechnical,
.theia-ChatProse :is(pre, code, kbd, samp) {
  direction: ltr;
  text-align: left;
  unicode-bidi: isolate;
}
```

5. Re-run focused tests until green, then run `yarn workspace @theia/ai-chat-ui lint`.
6. Commit: `feat(ai-chat-ui): add semantic bidi boundaries`.

## Task 2: Restructure message chrome for compact transcript rows

**Files:**
- Modify: `packages/ai-chat-ui/src/browser/chat-tree-view/chat-view-tree-widget.tsx`
- Modify: `packages/ai-chat-ui/src/browser/style/index.css`
- Test: `packages/ai-chat-ui/src/browser/chat-tree-view/chat-view-tree-widget.spec.tsx`

1. Add failing component tests that request nodes receive a request modifier class, no large request header/avatar is rendered, response metadata remains available, and request content is inside the bubble-ready request container.
2. Run the focused spec and confirm failure.
3. Add `theia-ChatNode-request` / `theia-ChatNode-response` classes. Suppress the request header while preserving hover toolbar actions in an unobtrusive request toolbar. Keep response agent/model/prompt metadata in a compact header and retain accessible article labels.
4. Add general compact transcript CSS: responsive centered row width, small request bubble aligned to logical end, flat assistant response, compact response metadata, and toolbar visibility on hover/focus-within.
5. Re-run the focused tests and lint.
6. Commit: `feat(ai-chat-ui): compact chat message chrome`.

## Task 3: Turn capabilities into selected chips plus an add menu

**Files:**
- Modify: `packages/ai-chat-ui/src/browser/chat-input-widget.tsx`
- Modify: `packages/ai-chat-ui/src/browser/style/index.css`
- Add: `packages/ai-chat-ui/src/browser/chat-input-widget.spec.tsx`

1. Export a small pure helper that derives visible collapsed capabilities from defaults and overrides. Add tests covering selected defaults, explicit disable, explicit enable, and an empty selection.
2. Run the focused test and confirm the helper is missing/failing.
3. Use the helper in `CapabilitiesBar`, render only active chips in the collapsed state, and keep the full existing configuration UI behind the toggle.
4. Change the toggle affordance from a tools glyph to a `+` control with localized `Add capabilities` naming, `aria-expanded`, keyboard operation, unsaved-state indication, and stable focus behavior. Keep all current capability persistence logic unchanged.
5. Style selected chips as compact composer chips and the expanded panel as a popover-like region that remains usable in narrow side panels.
6. Run focused tests, the full `@theia/ai-chat-ui` test suite, and lint.
7. Commit: `feat(ai-chat-ui): simplify capability controls`.

## Task 4: Improve activity and error progressive disclosure

**Files:**
- Modify: `packages/ai-chat-ui/src/browser/chat-response-renderer/toolcall-part-renderer.tsx`
- Modify: `packages/ai-chat-ui/src/browser/chat-response-renderer/error-part-renderer.tsx`
- Modify: `packages/ai-chat-ui/src/browser/style/index.css`
- Test: `packages/ai-chat-ui/src/browser/chat-response-renderer/toolcall-part-renderer.spec.ts`
- Add: `packages/ai-chat-ui/src/browser/chat-response-renderer/error-part-renderer.spec.tsx`

1. Add failing tests that completed tool calls expose a concise summary and expandable result, running/waiting calls expose live status semantics, and provider errors show a short visible message with technical detail behind `<details>` when available.
2. Run focused specs and verify failure.
3. Add semantic activity classes and status/ARIA attributes without changing confirmation state transitions. Keep completed results collapsed, but keep running and approval-required actions visible.
4. Ensure technical details use the LTR isolation class and visible error copy remains direction-aware prose.
5. Add compact vertical-timeline styling with subtle state colors and focus-visible outlines.
6. Run focused tests, full package tests, and lint.
7. Commit: `feat(ai-chat-ui): refine chat activity disclosure`.

## Task 5: Add Tcode-only adaptive visual layer

**Files:**
- Add: `packages/tcode-tensorgrid-ai/src/browser/style/tcode-chat.css`
- Modify: `packages/tcode-tensorgrid-ai/src/browser/tensorgrid-frontend-module.ts`
- Modify: `packages/tcode-tensorgrid-ai/package.json`

1. Import `./style/tcode-chat.css` from the Tcode frontend module and include CSS sources in the package files/build as needed. This packaging-only change is verified through the real compiler and application bundle rather than a source-text assertion.
2. Implement Tcode branding polish: centered transcript max width, gentle user bubbles, flat assistant rows, compact activity rails, elevated rounded sticky composer, narrow-panel wrapping, and theme-token-only colors. Use `:focus-visible`, reduced-motion support, and logical CSS properties.
3. Compile, test, and lint `@tcode/tensorgrid-ai` and compile `@theia/ai-chat-ui`.
4. Commit: `feat(tcode): add adaptive Codex-inspired chat theme`.

## Task 6: Validate interaction, RTL, responsive layout, and macOS ARM64 bundle

**Files:**
- Modify: `docs/superpowers/specs/2026-08-10-tcode-codex-chat-ui-design.md`
- Modify if needed: files from Tasks 1-5 for defects found during verification

1. Mark the approved design status as `Approved` and record the implemented acceptance checks.
2. Run `yarn workspace @theia/ai-chat-ui compile`, `lint`, and `test`; run `yarn workspace @tcode/tensorgrid-ai compile`, `lint`, and `test`.
3. Run the affected application build from `examples/electron` with `npm run build`.
4. Launch or inspect the built app at representative wide and narrow panel sizes. Verify Persian-only, English-only, and Persian mixed with paths/code/model IDs; keyboard access to `+`, capability chips, selectors, send/cancel, tool details, and error details; and no horizontal overflow.
5. Refresh `/Users/mrmc/Dev/GitHub/theia/dist-arm64/Tcode.app` from `examples/electron/lib` and `package.json`, ad-hoc sign it, verify the signature, and confirm the Mach-O architecture is `arm64`.
6. Run `git diff --check`, inspect `git status --short`, confirm no credentials/build artifacts/`.superpowers/` are staged, and review the complete staged diff.
7. Commit documentation or verification-only fixes as `docs(tcode): document chat UI verification` and push `master` to `origin` only after all required checks pass.
