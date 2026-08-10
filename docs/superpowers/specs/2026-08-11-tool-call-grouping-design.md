# Codex-style Tool Call Grouping

## Goal

Keep long Tcode chat responses readable by collapsing runs of more than two consecutive tool calls into a compact, accessible disclosure, matching the interaction pattern used by Codex.

## Scope

- Apply the behavior to the main chat response and delegated sub-chat response.
- Group only consecutive client tool-call response content.
- Keep renderer-declared standalone tool calls, including Tcode `todoWrite` and Codex `todo_list`, outside tool-call groups.
- Any prose, error, progress, server-tool content, or other non-client-tool content ends the current group.
- Preserve the current rendering of one or two consecutive tool calls.
- Do not change tool execution, confirmation, persistence, or provider behavior.

## Interaction

- A run of three or more tool calls is rendered as one disclosure.
- A completed group is collapsed by default and uses the label `Ran N tools`.
- A group containing an unfinished or interactive tool remains expanded and uses the label `Running N tools`.
- Selecting the disclosure header toggles the group. The control exposes `aria-expanded`, is keyboard operable, and has a visible focus state.
- Expanded content uses the existing renderer for every tool call, preserving arguments, results, failures, confirmations, and tool-specific UI.
- When a non-tool response part appears, the next tool run starts a new independent group.

## Architecture

Introduce a pure response-content grouping helper in `ai-chat-ui`. It converts the response content array into an ordered list of either individual response parts or tool-call groups. The helper owns only adjacency and threshold rules.

A reusable React disclosure component renders grouped tool calls. `ChatViewTreeWidget` and `SubChatWidget` both consume the same grouping helper and component, while continuing to select the existing highest-priority renderer for each child tool call.

The threshold is a named constant with the value `2`: a run is grouped only when its length is greater than that value.

### Standalone Tool Renderers

`ChatResponsePartRenderer` exposes an optional grouping policy. The default remains groupable so existing renderers require no change. A specialized renderer can declare its content `standalone` when folding it into a generic tool disclosure would hide or misrepresent its dedicated UI.

Both the Tcode `todoWrite` renderer and the Codex `todo_list` renderer declare this standalone policy. Renderer selection still follows the existing priority rules; the selected renderer's policy determines grouping. This avoids coupling `ai-chat-ui` to tool names owned by `ai-ide` or `ai-codex`.

A standalone tool call is emitted as ordinary response content and acts as a grouping boundary. Therefore, three tools followed by a Todo update and three more tools render as `Ran 3 tools`, the visible Todo list, and a separate `Ran 3 tools` disclosure. The Todo is not included in either count.

## Streaming and Interaction Safety

- A group is considered complete only when every tool call in the run is finished.
- Incomplete groups render expanded so current activity remains visible.
- Confirmation or other interactive UI remains reachable because unfinished calls cannot start in a collapsed group.
- Once all calls finish, the group may transition to its default collapsed state unless the user has explicitly toggled it during that mounted session.
- Existing response objects are not copied or mutated.

## Styling

The summary is a single compact activity row with the existing technical/chat typography, a tool/terminal icon, and a right-facing chevron when collapsed. Expanded groups place existing tool activity rows beneath the summary without introducing a second heavy container.

Logical CSS properties are used so the disclosure works in both LTR and RTL chat contexts.

## Testing

- Pure grouping tests cover zero, one, two, and three consecutive tool calls.
- Tests verify that prose splits two tool groups.
- Tests verify that non-tool response content is never absorbed into a group.
- Tests verify that renderer-declared standalone tools are excluded from counts and split adjacent tool runs.
- Tests verify that both Todo renderers opt into standalone behavior.
- Component tests verify the default collapsed completed state, expanded incomplete state, label/count, `aria-expanded`, and toggle behavior.
- Existing `ai-chat-ui` compile, lint, and test suites must remain green.
- The Electron app is rebuilt and the macOS ARM64 bundle is refreshed and code-signature verified.

## Acceptance Criteria

1. Three or more consecutive completed tool calls occupy one collapsed `Ran N tools` row.
2. One or two consecutive tool calls keep their current appearance.
3. Text or any other response part separates groups.
4. Pending execution or confirmation is never hidden by default.
5. Expanding the group reveals every existing tool detail and interaction unchanged.
6. The same behavior is present in the main chat and delegated sub-chat.
7. Tcode and Codex Todo updates remain visible as standalone Todo UI and are never counted inside `Ran N tools`.
