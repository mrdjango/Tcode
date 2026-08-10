# Tcode Codex-Inspired Chat UI Design

Date: 2026-08-10
Status: Approved and implemented

## Goal

Redesign Tcode's AI Chat as a focused, Codex-inspired agent workspace while preserving Theia's existing chat model, tools, sessions, approvals, and provider integrations. The result must remain usable in a narrow IDE panel, scale cleanly to a wide editor area, and render Persian, English, and mixed technical content correctly.

The selected direction is an adaptive Codex-inspired layout rather than a CSS-only reskin or a rewrite of the chat tree.

## Research Basis

The design follows the interaction priorities described in OpenAI's public Codex materials: focused threads, visible agent activity, inspectable terminal and test output, reviewable changes, and approvals that interrupt only when user judgment is needed.

- [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)
- [Introducing upgrades to Codex](https://openai.com/index/introducing-upgrades-to-codex/)
- [Work with Codex from anywhere](https://openai.com/index/work-with-codex-from-anywhere/)

Bidirectional text behavior follows W3C guidance: direction belongs to semantic content blocks, while inline technical tokens and embedded content use directional isolation.

- [W3C: Inline markup and bidirectional text](https://www.w3.org/International/articles/inline-bidi-markup/Overview.en.php)
- [W3C: CSS Writing Modes Level 3](https://www.w3.org/TR/css-writing-modes-3/)

## Design Principles

1. Conversation first: prose and decisions receive the strongest visual hierarchy.
2. Activity is traceable, not dominant: tool calls, commands, tests, and file edits remain visible but compact.
3. Progressive disclosure: summaries are visible by default; verbose output expands on demand.
4. Adaptive density: the interface must work from a narrow side panel to a wide editor tab.
5. Semantic bidirectionality: text direction is resolved per content block, not applied globally to the application shell.
6. Upstream resilience: reusable semantic fixes stay separate from Tcode-only styling.

## Visual Structure

### Conversation Column

The transcript uses one centered reading column with responsive inline padding and a maximum readable width. The column fills narrow panels and stops growing in wide views.

Large `You` and `Coder` headers and avatars are removed from the primary visual flow. Their semantic information remains available to assistive technology and compact metadata.

- User messages render as small end-aligned bubbles with a quiet surface and restrained radius.
- Assistant responses render directly on the conversation surface without a surrounding message card.
- Agent, prompt variant, model, and reasoning metadata render as a compact, low-contrast row where useful.
- Per-message actions remain hidden until hover or keyboard focus, without becoming unreachable on touch or reduced-hover environments.

### Agent Activity

Tool calls form a compact vertical activity timeline. Each entry has an icon, a concise verb, the primary target, status, and optional duration.

- Consecutive activity from one assistant turn is grouped under a collapsible summary after completion. Pending approvals and running actions remain individually visible.
- Terminal output, test output, diffs, and verbose tool results are collapsed by default after completion.
- Running activity remains visible and exposes cancel or approval actions when supported.
- Completed activity uses neutral styling; success and failure colors are accents rather than full-card backgrounds.
- File changes retain additions/deletions counts and links to the existing diff or editor actions.

### Errors and Approvals

Errors render as a concise headline with an expandable technical detail section. Provider status codes and request identifiers remain available without overwhelming the transcript.

Approval requests remain explicit and keyboard accessible. The visual redesign must not alter confirmation policies, session overrides, or tool execution behavior.

### Composer

The composer is a sticky, elevated surface at the bottom of the chat viewport with a rounded border, theme-derived background, and visible focus state.

- The editor occupies the upper portion and grows to a bounded maximum height.
- The lower row contains attachment/capabilities, approval mode, agent mode, model/reasoning, and send/cancel controls.
- `Shell Execution`, `GitHub`, `E2E Test`, and other unselected capabilities move into the `+` menu.
- Selected capabilities remain visible as removable chips.
- At narrow widths, labels shorten and controls wrap into a second row; primary send/cancel and approval state remain visible.
- The existing capability, preference, model, and request state remains the source of truth.

## Responsive Behavior

The layout has three behavioral ranges rather than device-specific designs:

- Narrow: transcript uses full width; metadata abbreviates; composer controls wrap; verbose activity is collapsed.
- Medium: transcript retains comfortable padding; full control labels appear when space permits.
- Wide: transcript is centered with a readable maximum width; activity output does not stretch to the viewport edge.

Logical CSS properties (`margin-inline`, `padding-inline`, `inset-inline`, `text-align: start/end`) are used wherever direction may vary.

## Bidirectional Text

The application shell, toolbar, timeline controls, and keyboard navigation remain LTR. Only user-authored and assistant-authored language content participates in automatic direction selection.

### Prose Blocks

Each paragraph, list item, heading, blockquote, and user input block receives semantic automatic direction. The implementation uses HTML direction metadata where possible and `text-align: start` so Persian/Arabic content aligns RTL while English content aligns LTR.

`unicode-bidi: plaintext` or an equivalent isolated semantic boundary is applied only to suitable leaf text blocks, not to containers with nested block structure.

### Technical Content

The following always render LTR and directionally isolated:

- Inline code and fenced code blocks
- Terminal output and commands
- File paths and URLs
- Model IDs, request IDs, hashes, and token identifiers
- Diffs, stack traces, and test output
- Tool activity labels and durations

Inline technical tokens use an isolation boundary such as `<bdi dir="ltr">` or equivalent markup/CSS so punctuation and surrounding Persian text remain stable.

### Composer Input

The composer aligns text according to the current paragraph's first strong character. Placeholder alignment follows the active input direction. Cursor behavior, selection, history navigation, and keyboard shortcuts must remain unchanged.

## Architecture and Upstream Strategy

### Reusable `ai-chat-ui` Changes

General-purpose changes belong in `@theia/ai-chat-ui` and are kept small and independently testable:

- Semantic direction attributes and isolation hooks
- Logical CSS properties and responsive layout hooks
- Accessible labels and focus behavior
- Structural hooks needed to group activity and reorganize the composer

These changes must not contain TensorGrid or Tcode branding and are candidates for upstream contribution.

### Tcode-Only Presentation

The Codex-inspired visual layer belongs to `@tcode/tensorgrid-ai` and is loaded only by the Tcode application:

- Chat spacing, maximum widths, surfaces, radii, shadows, and density
- Tcode-specific responsive breakpoints and compact metadata presentation
- Composer and activity visual treatment

The stylesheet is scoped to the Tcode chat surface and consumes Theia theme variables. It must not duplicate chat state, tool policy, or provider logic.

### Data Flow

No chat protocol or persistence schema changes are required. Existing response content renderers continue to receive the same content objects. The redesign changes semantic markup, grouping, and presentation only.

The capabilities menu reads and writes through the existing capability-selection services. Moving options behind `+` cannot change defaults or silently enable a capability.

## Accessibility

- Preserve logical DOM order and existing keyboard navigation.
- All icon-only actions require accessible labels and tooltips.
- Focus indicators must remain visible in all supported themes.
- Collapsible activity uses native or equivalent expanded-state semantics.
- Status is communicated by text/icon in addition to color.
- Motion is limited and disabled under `prefers-reduced-motion`.
- Controls remain usable without hover.

## Error Handling

- Renderer failures fall back to the existing unknown-content or error renderer.
- A collapsed result always exposes its failure state and a way to inspect details.
- RTL handling never mutates stored message text.
- Unsupported or malformed markup is displayed as text rather than dropped.
- Layout overflow must scroll within output regions instead of widening the entire chat panel.

## Testing and Acceptance

### Unit and Component Tests

- Persian, English, and mixed-direction user and assistant messages
- Inline code, paths, URLs, model IDs, and punctuation inside Persian prose
- LTR code blocks, terminal output, diffs, tool activity, and stack traces
- Compact agent/model metadata and removal of large visual headers
- `+` menu open/close, keyboard navigation, and capability selection persistence
- Selected capability chips and removal behavior
- Collapsible tool activity and error details
- ARIA labels, expanded state, and keyboard focus

### Responsive and Visual Tests

Exercise narrow, medium, and wide chat widths with:

- Long Persian prose
- Mixed Persian/English technical content
- Long model identifiers and file paths
- Concurrent/running tool activity
- Approval prompts, failures, and large terminal output

### Repository Verification

- Compile, lint, and test `@theia/ai-chat-ui` and `@tcode/tensorgrid-ai`.
- Run affected `ai-chat` tests.
- Build the Tcode Electron application.
- Package and smoke-test macOS ARM64.
- Verify existing chat sessions, approval preferences, model selection, and TensorGrid authentication remain intact.

## Non-Goals

- Replacing Theia's chat/session model
- Copying proprietary Codex assets or branding
- Changing tool confirmation or sandbox semantics
- Mirroring the entire IDE shell for RTL locales
- Adding a new public upstream API solely for Tcode styling
- Redesigning non-chat Theia views

## Delivery Structure

Implementation is divided into reviewable commits:

1. Semantic RTL and bidi isolation in reusable chat renderers.
2. Adaptive composer structure and capabilities menu behavior.
3. Tcode-only Codex-inspired visual layer and responsive states.
4. Tests, macOS ARM64 packaging verification, and maintenance documentation updates.

## Implementation Verification

- Semantic `dir="auto"` boundaries are applied to user and assistant prose; model IDs, prompt IDs, code, paths, tool names, arguments, and error details are isolated LTR.
- User messages use compact logical-end bubbles; assistant messages remain flat with compact metadata and accessible article labels.
- The collapsed composer shows only active capability chips; all other choices remain available behind the keyboard-accessible `+` control.
- Completed tool output and provider details use native progressive disclosure; running and approval-required activity remains visible with live-status semantics.
- Tcode loads a product-scoped adaptive stylesheet with narrow-panel wrapping, focus-visible states, and reduced-motion handling.
- `@theia/ai-chat-ui` passes 274 tests; `@tcode/tensorgrid-ai` passes 3 tests. Both packages compile and lint successfully before packaging.
