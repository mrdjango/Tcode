# Codex-style Tool Call Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse runs of more than two consecutive completed client tool calls into a Codex-style, accessible disclosure in Tcode chat.

**Architecture:** A pure grouping helper converts ordered response content into individual parts and consecutive tool-call groups without mutating models. A reusable React content-list component applies that grouping in both the main and delegated chat views and delegates each expanded child to the existing highest-priority response renderer.

**Tech Stack:** TypeScript, React, Theia chat models/renderers, Theia CSS variables, Mocha, Chai, JSDOM.

## Global Constraints

- Group only consecutive client `ToolCallChatResponseContent` entries.
- One or two consecutive tool calls retain the existing rendering.
- Three or more consecutive tool calls become one disclosure.
- Any non-client-tool response content ends the current group.
- Completed groups default to collapsed; incomplete or interactive groups default to expanded.
- Existing tool renderers, confirmation behavior, output, arguments, and response objects remain unchanged.
- Main chat and delegated sub-chat use the same grouping implementation.
- Logical CSS properties preserve LTR and RTL behavior.

---

### Task 1: Pure response-content grouping

**Files:**
- Create: `packages/ai-chat-ui/src/browser/chat-tree-view/chat-response-content-grouping.ts`
- Test: `packages/ai-chat-ui/src/browser/chat-tree-view/chat-response-content-grouping.spec.ts`

**Interfaces:**
- Consumes: `readonly ChatResponseContent[]` and `ToolCallChatResponseContent.is(content)`.
- Produces: `TOOL_CALL_GROUP_THRESHOLD`, `GroupedChatResponseContent`, and `groupChatResponseContent(content)`.

- [ ] **Step 1: Write failing grouping tests**

Create real response-content fixtures and assert that zero, one, and two tool calls remain individual; three consecutive tool calls form one group; and markdown between tool runs creates independent groups.

```ts
expect(groupChatResponseContent([tool('a'), tool('b')]).map(item => item.kind))
    .to.deep.equal(['content', 'content']);

const grouped = groupChatResponseContent([tool('a'), tool('b'), tool('c')]);
expect(grouped).to.have.length(1);
expect(grouped[0].kind).to.equal('toolCallGroup');

const split = groupChatResponseContent([
    tool('a'), tool('b'), tool('c'), markdown('text'), tool('d'), tool('e'), tool('f')
]);
expect(split.map(item => item.kind)).to.deep.equal(['toolCallGroup', 'content', 'toolCallGroup']);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd packages/ai-chat-ui
npm run compile
npm test -- --grep "groupChatResponseContent"
```

Expected: assertions fail because `groupChatResponseContent` is not yet exported with the requested behavior.

- [ ] **Step 3: Implement the minimal grouping helper**

Use a discriminated union that preserves source indexes for stable React keys:

```ts
export const TOOL_CALL_GROUP_THRESHOLD = 2;

export type GroupedChatResponseContent =
    | { kind: 'content'; content: ChatResponseContent; sourceIndex: number }
    | { kind: 'toolCallGroup'; content: ToolCallChatResponseContent[]; sourceIndex: number };

export function groupChatResponseContent(content: readonly ChatResponseContent[]): GroupedChatResponseContent[] {
    const result: GroupedChatResponseContent[] = [];
    let run: Array<{ content: ToolCallChatResponseContent; sourceIndex: number }> = [];
    const flush = () => {
        if (run.length > TOOL_CALL_GROUP_THRESHOLD) {
            result.push({ kind: 'toolCallGroup', content: run.map(item => item.content), sourceIndex: run[0].sourceIndex });
        } else {
            result.push(...run.map(item => ({ kind: 'content' as const, ...item })));
        }
        run = [];
    };
    content.forEach((item, sourceIndex) => {
        if (ToolCallChatResponseContent.is(item)) {
            run.push({ content: item, sourceIndex });
        } else {
            flush();
            result.push({ kind: 'content', content: item, sourceIndex });
        }
    });
    flush();
    return result;
}
```

Do not mutate the input array or response objects.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the focused compile/test commands from Step 2. Expected: all grouping tests pass.

- [ ] **Step 5: Commit the grouping unit**

```bash
git add packages/ai-chat-ui/src/browser/chat-tree-view/chat-response-content-grouping.ts packages/ai-chat-ui/src/browser/chat-tree-view/chat-response-content-grouping.spec.ts
git commit -m "feat(ai-chat-ui): group consecutive tool calls"
```

---

### Task 2: Accessible disclosure and shared rendering

**Files:**
- Create: `packages/ai-chat-ui/src/browser/chat-tree-view/chat-response-content-list.tsx`
- Test: `packages/ai-chat-ui/src/browser/chat-tree-view/chat-response-content-list.spec.tsx`
- Modify: `packages/ai-chat-ui/src/browser/chat-tree-view/chat-view-tree-widget.tsx`
- Modify: `packages/ai-chat-ui/src/browser/chat-tree-view/sub-chat-widget.tsx`
- Modify: `packages/ai-chat-ui/src/browser/style/index.css`

**Interfaces:**
- Consumes: `groupChatResponseContent`, `ResponseNode`, and `(content: ChatResponseContent, node: ResponseNode) => ReactNode`.
- Produces: `ChatResponseContentList`, which renders individual content and grouped tool disclosures.

- [ ] **Step 1: Write failing disclosure component tests**

Render three finished tool calls and assert a collapsed summary with a count. Render an unfinished group and assert it is expanded. Click the summary and assert all existing child renderings become visible.

```tsx
root.render(<ChatResponseContentList
    content={[tool('a', true), tool('b', true), tool('c', true)]}
    node={node}
    keyPrefix='response'
    renderContent={content => <span className='rendered-tool'>{content.kind}</span>}
/>);

expect(container.querySelector('button')?.textContent).to.contain('Ran 3 tools');
expect(container.querySelector('button')?.getAttribute('aria-expanded')).to.equal('false');
expect(container.querySelectorAll('.rendered-tool')).to.have.length(0);
```

The incomplete fixture expects `Running 3 tools`, `aria-expanded="true"`, and three rendered children.

- [ ] **Step 2: Run the focused component test and verify RED**

```bash
cd packages/ai-chat-ui
npm run compile
npm test -- --grep "ChatResponseContentList"
```

Expected: assertions fail because the shared component is not implemented.

- [ ] **Step 3: Implement the disclosure component**

Create a focused `ToolCallGroup` component inside the new file:

```tsx
const complete = tools.every(tool => tool.finished);
const [expanded, setExpanded] = React.useState(!complete);
const userToggled = React.useRef(false);

React.useEffect(() => {
    if (!userToggled.current) {
        setExpanded(!complete);
    }
}, [complete]);
```

Use a semantic `<button type='button'>` with `aria-expanded`, `aria-controls`, a terminal/tool codicon, localized `Ran {0} tools` or `Running {0} tools` text, and a chevron. Render child `.theia-ResponseNode-Content` wrappers only while expanded, calling the supplied renderer for every original tool object.

- [ ] **Step 4: Replace duplicated response-content maps**

In both response widgets replace the direct content `.map` with:

```tsx
<ChatResponseContentList
    content={node.response.response.content}
    node={node}
    keyPrefix={node.id}
    renderContent={(content, parent) => this.getChatResponsePartRenderer(content, parent)}
/>
```

Keep every progress-message condition and its ordering unchanged.

- [ ] **Step 5: Add compact Codex-style CSS**

Add `.theia-ToolCallGroup`, `.theia-ToolCallGroup-summary`, `.theia-ToolCallGroup-content`, and focus/hover rules. Use `margin-block`, `padding-inline`, `gap`, and `inset-inline-start`; reuse `--theia-descriptionForeground`, `--theia-widget-border`, and `--theia-focusBorder`.

- [ ] **Step 6: Run focused and full package verification**

```bash
cd packages/ai-chat-ui
npm run compile
npm run lint
npm test
```

Expected: compile and lint exit zero and all package tests pass.

- [ ] **Step 7: Commit the UI unit**

```bash
git add packages/ai-chat-ui/src/browser/chat-tree-view/chat-response-content-list.tsx packages/ai-chat-ui/src/browser/chat-tree-view/chat-response-content-list.spec.tsx packages/ai-chat-ui/src/browser/chat-tree-view/chat-view-tree-widget.tsx packages/ai-chat-ui/src/browser/chat-tree-view/sub-chat-widget.tsx packages/ai-chat-ui/src/browser/style/index.css
git commit -m "feat(ai-chat-ui): collapse long tool call runs"
```

---

### Task 3: Repository graph, Electron build, and macOS ARM64 bundle

**Files:**
- Update the local graph with `graphify update .`; do not stage generated graph drift.
- Refresh local artifact `dist-arm64/Tcode.app`; do not commit the bundle.

**Interfaces:**
- Consumes: completed `ai-chat-ui` changes.
- Produces: verified ARM64 Tcode bundle and pushed `master` commits.

- [ ] **Step 1: Update the code graph**

```bash
graphify update .
```

- [ ] **Step 2: Build the Electron application**

```bash
cd examples/electron
npm run build
```

Expected: browser, node, and Electron builds finish with zero errors.

- [ ] **Step 3: Refresh and sign the Tcode bundle**

```bash
cp -R examples/electron/lib/. dist-arm64/Tcode.app/Contents/Resources/app/lib/
cp examples/electron/package.json dist-arm64/Tcode.app/Contents/Resources/app/package.json
codesign --force --deep --sign - dist-arm64/Tcode.app
codesign --verify --deep --strict --verbose=2 dist-arm64/Tcode.app
file dist-arm64/Tcode.app/Contents/MacOS/Tcode
```

Expected: signature is valid and the executable reports `Mach-O 64-bit executable arm64`.

- [ ] **Step 4: Review repository scope**

```bash
git diff --check
git status --short
git log -3 --oneline
```

Confirm `.superpowers/`, `dist-arm64/`, generated graph drift, credentials, tokens, and unrelated worktree files are not staged.

- [ ] **Step 5: Push reviewed commits**

```bash
git push origin master
```

Expected: `origin/master` advances without force-push.
