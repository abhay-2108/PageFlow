# Pagegrove — Interaction & Behavior Spec (M0)

Status: v1, derived 2026-10-17. v2 addendum (M6), derived 2026-10-18. Owner: Pagegrove. Clean-room: this document contains **no Notion code, assets, or user-facing copy**. All Pagegrove UI strings below are original drafts.

## 0. Sources & evidence hierarchy

| Tag | Source | Notes |
| --- | --- | --- |
| **A** | REA static analysis of Notion Desktop **7.39.0** `app.asar` on this machine | Primary. Static only; Notion never launched. Raw: `docs/rea/evidence.json`. Derived tables: `docs/rea/facts-*.json` |
| **B** | Public REA showcase (Notion Desktop 7.6.1, REA 4.1.0), rea.tools/showcase/notion | Secondary; version differs |
| **C** | Assumed — our own design decision (no local evidence available) | Must be reviewed; flagged everywhere |

Reproduce (A):
```
npx -y rea-agents@6.5.0 analyze-javascript-application "^%LOCALAPPDATA%\Programs\Notion\resources\app.asar" --json --integrity-policy record-and-continue > docs/rea/evidence.json
node scripts/extract-summary.mjs
node scripts/extract-shell-facts.mjs
node scripts/extract-ipc-deep.mjs
node scripts/extract-electronapi.mjs
node scripts/extract-preload-drill.mjs
node scripts/extract-final-probes.mjs
```
REA 6.5.0; 161 sources parsed, 0 parse failures; graph 2,814 nodes / 9,070 edges; semantic graph 60,385 nodes (partial — see §7).

## 1. Shell architecture observed (evidence A)

**Bridge shape.** The desktop shell loads remote workspace content inside a `WebContentsView`/`BrowserWindow` pair (`createNotionBrowserWindow`, `createNotionWebContentsView` exported; `.webpack/main/index.js`). The web app talks to the shell through a contextBridge API named `__electronApi` exposed in the **main world**:

- `context_bridge_apis` observed on `tab_browser_view/preload.js` (evidence: `.webpack/renderer/tab_browser_view/preload.js:L1:C0`, property path `static_analysis.electron.context_bridge_apis`):
  - `__electronApi` — 231 members (full list: `docs/rea/facts-electronapi.json`)
  - `__isElectron`, `__platform`, `__desktopConfig`, `__desktopDeviceInfo`
- Additional bridge APIs on other preloads: `tabsApi` (windows_and_tabs), `__internalSettingsApi` (internal_settings), `__SENTRY_IPC__` (Sentry, `native_modules/default.js:L1:C925`).
- API status observed as `dynamic` (assembled at runtime); members recovered via REA wrapper substitution.

**IPC pattern.** Each bridge member maps to a literal `notion:<verb-noun>` channel via `electron.ipcRenderer.send` (fire-and-forget) or `.invoke` (request/response). 206 bridge→channel→terminal call paths extracted, all with resolution `candidate` — *static candidates, not proven runtime behavior* (`docs/rea/facts-electronapi.json`). Examples:

| Bridge member | Channel | Terminal | Evidence |
| --- | --- | --- | --- |
| `__electronApi.copy` | `notion:copy` | `ipcRenderer.send` | `tab_browser_view/preload.js` L2/C396644 (candidate) |
| `__electronApi.cut` | `notion:cut` | `ipcRenderer.send` | candidate |
| `__electronApi.paste` | `notion:paste` | `ipcRenderer.send` | candidate |
| `__electronApi.copyText` | *(none)* | `navigator.clipboard.writeText` | candidate |
| `__electronApi.copyImage` | *(none)* | `navigator.clipboard.write` | candidate |
| `__electronApi.setTheme` | `notion:set-theme` | `ipcRenderer.send` | candidate |
| `tabsApi.toggleComposeMenu` | `notion:toggle-compose-menu` | `ipcRenderer.send` | candidate |
| `__electronApi.openAppMenu` | `notion:open-app-menu` | `ipcRenderer.send` | candidate |
| `__electronApi.openQuickSearchResult` | `notion:quick-search-open-result` | `ipcRenderer.send` | candidate |
| `__electronApi.navigateToBlockInTab` | `notion:navigate-to-block-in-tab` | `ipcRenderer.send` | candidate |

**Sender validation.** A main-bundle module exports `isNotionWebContents` (observed export; fingerprint `678b18c6…`). REA limitation: "Sender, frame, URL, and origin checks are observations only" — the check *usage sites* were lost to the resource budget (§7).

**Notable shell capabilities evidenced** (channel inventory, `docs/rea/evidence.json`):
- Window/tab model: `notion:new-tab-from-notion`, `notion:create-window`, `notion:close-tab-from-notion`, `virtualTabs.*`, `tabSpaces.*` (A)
- Quick search exists as a shell-level feature: `notion:quick-search-*`, members `openQuickSearchResult`, `openQuickSearchShortcutSetting` (A); grammar/UI is in the web bundle (unknown, §7)
- Compose menu exists: `notion:toggle-compose-menu` (A)
- Theme/dark mode: `notion:set-theme`, `notion:set-contrast-mode`; a dedicated `darkmode_placeholder` renderer window (`.webpack/renderer/darkmode_placeholder/index.html:L6:C12`) (A)
- Global shortcuts toggle exists (`notion:set-global-shortcuts-enabled`) but **no accelerator definitions appear anywhere in the shell bundle** (`CommandOrControl+`, `Ctrl+`, `accelerator`: 0 occurrences) (A)
- Local DB: `SqliteServer.js` bundled in main; bridge members `getSqliteMeta`, `getSqliteDiskUsage`; `better-sqlite3` native addon unpacked; 5 ASAR integrity contradictions (signed-after-pack binaries; REA `record-and-continue` policy) (A)
- Security posture of shell windows: `nodeIntegration:!1` (false) with resolved preload paths, e.g. `.webpack/main/index.js:L2:C288923` (A)
- Clipboard triggers `notion:copy|cut|paste` only route to IPC; **no custom clipboard formats (`notionvc`, `text/_notion*`) exist anywhere in 7.39.0's shell** (0 occurrences) — differs from the 7.6.1 showcase (B). Clipboard format details for 7.39.0 are unknown (§7)

**What the shell does NOT contain (A):** all editor behavior. No slash-menu strings, no block grammar, no editor accelerators, no toggle/checkbox logic, no empty-state copy. Those live in Notion's remote web bundle, which is not on disk (app never launched) and out of scope per static-only rule.

## 2. Shortcut map (Pagegrove v1)

Editor-level shortcuts are **C (assumed)**; conventions chosen for Windows-first muscle memory. No evidence available for Notion's editor shortcuts in source A.

| Action | Shortcut | Basis |
| --- | --- | --- |
| Bold / Italic / Underline | Ctrl+B / Ctrl+I / Ctrl+U | C |
| Strikethrough | Ctrl+Shift+S | C |
| Inline code | Ctrl+E | C |
| Undo / Redo | Ctrl+Z / Ctrl+Y | C |
| Quick search (pages) | Ctrl+P | C (shell evidence shows quick search feature exists: A) |
| Command palette | Ctrl+K | C (product decision, M4) |
| New page | Ctrl+N | C |
| Indent / Outdent block | Tab / Shift+Tab | C |
| Move block up / down | Alt+Shift+Up / Alt+Shift+Down | C |
| Toggle to-do checked | Ctrl+Enter | C |
| Toggle sidebar | Ctrl+\ | C |
| Close menu / leave block | Esc | C |

Rule: if a web-app shortcut is unknown (A had none), Pagegrove defines its own; conflicts resolved in favor of the table above.

## 3. Slash-command grammar & order (Pagegrove v1 — C)

Grammar (deterministic scanner in editor):
- Trigger: `/` as the first character of an **empty** paragraph. Mid-word `/` is literal text.
- `query` = characters typed after `/`; matching = case-insensitive substring on title + aliases; empty query shows full menu.
- Keys: Up/Down navigate, Enter or click selects, Esc closes without transforming; Backspace on the `/` closes; all keys are non-destructive until selection.
- Selection transforms the current block (or inserts one) and keeps focus.

Menu order (fixed; this is our ordering, not copied):

| # | Item | Aliases | Action |
| --- | --- | --- | --- |
| 1 | Text | p, paragraph | plain paragraph |
| 2 | Heading 1 | h1 | heading level 1 |
| 3 | Heading 2 | h2 | heading level 2 |
| 4 | Heading 3 | h3 | heading level 3 |
| 5 | Bulleted list | ul, bullet | bullet item |
| 6 | Numbered list | ol, number | numbered item |
| 7 | To-do list | todo, checkbox | checklist item |
| 8 | Toggle | toggle, collapse | collapsible container |
| 9 | Divider | hr, line | horizontal rule |
| 10 | Quote | blockquote | quote block |
| 11 | Code | code block | fenced code block |

Shows 8 rows initially, scrolls beyond.

## 4. Nesting rules (Pagegrove v1 — C)

- Lists (bullet/numbered/to-do): Tab indents into the previous sibling (max visual depth 6); Shift+Tab outdents. Enter on an empty nested item outdents one level; outdenting out of a list converts to paragraph. Moving an item moves its children.
- Toggle: accepts any block as child; collapsed state hides children (`aria-expanded`). Soft depth cap 8.
- Deleting a container deletes descendants as one atomic operation with a single undo step.
- No orphaned children are allowed at the data layer: parent pointers are transactional.

## 5. Page tree (Pagegrove v1 — C, informed by A that shell-level tab/navigation features exist but are not copied)

- Pages form a forest: `parent_id` (nullable) + fractional `rank` for ordering; drag-drop to nest/reorder; soft depth cap 6; cycle prevention at the DB layer.
- Deleting: soft-delete to trash; toast with "Undo" (10s); restore also available later via palette (M4).
- Workspace = a folder: `workspace.db` + `pages/*.snapshot.json`; folder is copyable to another machine (portability invariant).
- Search: instant (FTS5) over titles + block text; results show page path breadcrumbs.

## 6. Toggle & checkbox semantics (Pagegrove v1 — C)

- To-do block: binary `checked`; toggling does not alter text; no cascading; persistence is immediate (per-transaction, WAL).
- Enter inside a to-do creates the next sibling with the same `checked=false`; Ctrl+Enter toggles without leaving the block.
- Toggle block: independent `collapsed` flag persisted per block; children remain in the doc regardless.

## 7. Empty states (fresh copy — Pagegrove original)

| Context | Copy (draft) |
| --- | --- |
| Workspace, no pages | "No pages yet. Create your first page — everything stays on this machine." + [Create a page] |
| Empty page body | Placeholder: "Press / for blocks, or just start writing. Autosaves locally." |
| Search, no results | No results for "‹query›". Try another word or create a page. |
| Trash empty | "Nothing here. Deleted pages rest in Trash until you say otherwise." |

## 8. Explicit unknowns (do not guess upstream behavior into our spec)

1. Notion's editor interaction details (slash grammar, ordering, nesting, toggle semantics, editor shortcut map, empty states) are **not in the analyzed artifact** — they ship in the remote web bundle; no local cache exists because the app was never launched. All §2–§7 behavior is therefore **C (ours)**.
2. All bridge→channel→terminal call paths are `candidate` (static wrapper substitution), never runtime-proven (A).
3. `__electronApi.performShortcut` exists (export observed) but its semantics/channels are **undetermined** (semantic graph truncated).
4. No accelerator strings exist in the shell bundle; how Notion builds its application menu is **undetermined**.
5. Sender-validation helper `isNotionWebContents` is observed, but its concrete call sites are **unknown** (resource-budget truncation).
6. Main-process handler bodies for `notion:copy|cut|paste` (role-based vs `webContents.copy()`) are **unknown**; no custom clipboard formats were observed in 7.39.0 (contrast: showcase 7.6.1 shows `notionvc` ids + `text/_notion-blocks-v3-*` mime — B).
7. Global shortcut definitions (only the enable/disable channel is visible) — **unknown**.
8. Semantic graph for the main bundle is truncated (result-budget limits; 180 resource-constraint limitations; 39,329 semantic unknowns retained in evidence) — relationships inside `main/index.js` are partially unobservable in this run.

## 9. Non-goals (M1–M5)

No accounts, no telemetry, no cloud sync, no mobile. LAN sync only (M3), all local-first. No Notion assets, code, or copy — behaviors reimagined, strings original (this document).

## 10. Deep-RE addendum: web bundle (M6)

Because the local machine's Notion install has been used, the web-app bundle now exists in the local Chromium cache and is analyzable statically (Notion still never launched by us). Evidence tier **A-web**:

| Artifact | Contents |
| --- | --- |
| `docs/rea/cache-extract/chunk-001..045.js` | 45 JS chunks (20.3 MiB) recovered from `%APPDATA%\Notion\Partitions\notion\Cache\Cache_Data` via `scripts/extract-cache-bundle.mjs`; no sourcemaps |
| `docs/rea/evidence-webapp-batch-{1,2,3}.json` | REA 6.5.0 static analysis of the chunks in 3 size-balanced batches (`scripts/split-cache-batches.mjs`; single run exceeds REA's result budget); bundler identified as rspack |
| `docs/rea/facts-editor.json` | 203,081 string literals tokenized (`scripts/extract-editor-facts.mjs`), grouped into 1,954 feature-evidence strings across shortcuts/icons/drag/mentions/comments/database |

What A-web confirms (feature existence + naming only; no copy is reused): a drag system (`Draggable`, `IsDraggingContext`, `is-dragging`, `move_pages`, "Move block to different page"), page "move to" flows (`moveTo`, `move_to_menu_open`), emoji icons and covers (`pageCovers`, `customEmoji`, `LazyEmojiMenu`, per-language emoji catalogs), `link_to_page`/page-mention machinery, comment threads (`threadId`, `create comment` flows), and inline database/view/property update APIs (`create-database`, `update-database-views`). Shortcut strings like `mod+…` and locale catalogs confirm internationalization depth that Pagegrove does not attempt.

Still unknown (A-web limits): exact interaction geometry (drop zones, indicator styling), animation timings, emoji picker layout, and all user-facing copy. Those remain **C (ours)** in §11.

## 11. M6.1 spec: tree drag-and-drop + page icons/covers (Pagegrove — C, informed by A-web)

**Tree drag-and-drop.** Every tree row is draggable (except while inline-renaming). Drop intent by vertical thirds of the hovered row: top third = insert before, bottom third = insert after, middle = nest as first child (expands the target). A dedicated "Move to top level" drop target appears below the tree during a drag; dropping there re-parents to root end. Invalid targets (self, own subtree) are never highlighted and drops are rejected. On drop, ordering uses fractional ranks with automatic rebalance when gaps collapse (`src/shared/rank.ts`); moves are transactional and cycle-checked at the DB layer (`movePage`), and the moved page's new parent auto-expands. Visual language: accent insert-line for before/after, accent ring + hover fill for nest.

**Page icons.** Emoji only (curated offline set, six categories, no network). One icon per page, stored as `icon TEXT` on the page row (migration v3), shown at 44px above the title and at 14px in the tree row. Picker: "Add icon"/"Change icon" hover action opens a grouped emoji grid; "Remove icon" clears. Picked emoji render inside a button with `data-page-icon` for testing.

**Page covers.** A curated set of 8 gradient covers (`src/shared/covers.ts`), no image uploads in M6.1. Cover renders as a 176px banner above the icon/title; hover reveals "Change cover"/"Remove". Cover id persists as `cover TEXT`; unknown ids render nothing (forward compatibility).

**Sync & persistence.** Icon/cover travel in `PageMeta` (LAN meta room diffing via `entriesEqual` covers them; sync bundles carry them; legacy bundles without the fields normalize to `null`). All four operations (move, set/clear icon, set/clear cover) bump `updated_at` and schedule snapshot writes like rename does.

## 12. M6.2 spec: page mentions + backlinks (Pagegrove — C, informed by A-web)

**Page mentions.** Typing `@` in the editor opens a page picker anchored to the caret, listing current pages (excluding the page you are on), filtered case-insensitively by the typed text, up to 12 items; the current selection is keyboard-navigable (up/down/enter/escape) and each entry shows the page icon (when set) and title. Selecting one inserts an atomic inline "mention chip" — rendered as `@Title` on an accent chip — that survives save/reload as a `pageMention` node carrying `{pageId, label}`. A label is a snapshot for display; the `pageId` is authoritative. Mentions export to Markdown as `[label](page/<id>)`. Mentions of deleted pages degrade to plain chip text (no dangling navigation) until resolved.

**Backlinks.** Opening a page shows a "Linked from" section (below the document) listing every live page whose current document contains a mention of it, newest-updated first, capped at 50, each with its ancestor path as a muted subtitle. Clicking an entry opens that page; clicking a mention chip opens its target page. Backlinks are computed on demand from the live docs (no separate index to go stale), so names/paths always reflect current state, and the list recomputes on page open and after external workspace changes. Known limitation: the list can be stale while the page stays open after another page locally starts or stops mentioning it.

**Mention semantics (A-web note).** Notion's bundle contains a `link_to_page` mention flow and page-mention localization (`pageMention.untitledPlaceholder`, `mentionsMe`); those confirm the concept. Geometry (popup placement, chip styling), copy ("Linked from"), and the backlink data model are original Pagegrove choices (C).

## 13. M6.3 spec: anchored comments (Pagegrove — C, informed by A-web)

**Creating a thread.** Selecting text in the editor shows a floating "Comment" button at the selection. Pressing it opens the right-side Comments panel with a composer whose quote is the selected text (plain-text snapshot, max 140 chars shown / 500 stored). Posting creates a thread and pins an inline anchor mark (`commentAnchor`, carrying `threadId`) to the selected range; the anchored text renders with an amber highlight and underline, and clicking it opens/activates the thread in the panel.

**Panel.** The Comments panel opens via the page's "Comments" action (shows a count of open threads) or automatically when a thread is created or its anchor is clicked. Each thread card shows the quote, its messages (author + body), a reply box, and Resolve/Delete actions. Resolved threads collapse behind a "Show resolved (n)" toggle; Reopen restores them. Deleting a thread removes its anchors from the document immediately.

**Data model.** Threads and messages live in the workspace DB (migration v4: `comment_threads`, `comment_messages` with `ON DELETE CASCADE`); anchors live in the document itself, so highlights survive save/reload and travel with the doc over LAN sync. On page open, anchor marks whose thread is missing from the local DB are pruned automatically. Author is the local workspace user name, snapshotted per message.

**Known limitations (documented).** Comments are workspace-local in M6.3: LAN sessions and sync bundles carry pages/docs but not thread data. Consequence: opening a page that carries foreign anchors prunes those marks locally (they survive on the machine that owns the thread data); resolving/deleting/replying on one machine does not reach others. Deleting a page moves its threads out of reach of the UI (rows remain via the trash lifecycle); restoring the page restores its threads.

## 14. M6.4 spec (slice 1): tables (Pagegrove — C, informed by A-web)

**Insertion.** `/table` (aliases `grid`, `database`) inserts a 3×3 table with a header row at the cursor. Structure is standard table semantics: a `table` node of `tableRow`s whose first row is `tableHeader` cells and remaining rows are `tableCell` cells; every cell holds paragraph content, so inline marks (bold, code, links) work inside cells.

**Cell editing.** `Tab` moves to the next cell, `Shift-Tab` to the previous. `Tab` in the last cell appends a new row and lands in its first cell (implemented in our `TableTools` extension because the underlying library stops at the table end); this is the fast path for typing a dataset row-by-row.

**Table toolbar.** With the selection inside a table, a floating toolbar shows over the table's top-right corner (clamped into the viewport so it never leaves the screen): Add row, Add column, Delete row, Delete column, Delete table. Add/delete row operate on the cursor's row; add/delete column operate on the cursor's column (insert-after / delete-at semantics from the table library) — so "delete column" removes the column the caret is in, not the last column. Actions are `mousedown`-guarded so the text selection is preserved.

**Markdown export.** Tables serialize to GitHub-flavored pipe tables: header row, `| --- |` separator, one line per row. Cell text is plain inline text (no nested block syntax). Reload and sync: tables are ordinary document nodes — they survive save/reload (Yjs replay verified) and travel with the doc over LAN sync and sync bundles.

**Known limitations.** No merged cells, no column-width dragging (`resizable: false`), no cell background colors, no column types. Rows/columns are added and removed through the toolbar only.

## 15. M6.4 spec (slice 2): page table view (Pagegrove — C, informed by A-web)

**View mode per page.** Every page carries a view mode — `doc` (default) or `table` — stored on the page row (`view` column, migration v5) and travelling in `PageMeta`, so it follows the page over LAN meta sync and sync bundles (legacy bundles without the field normalize to `doc`).

**Toggle.** The page actions row shows a segmented "Page view" control with Document and Table buttons (`aria-pressed` on the active one). Switching is immediate and persisted; title, icon, and cover remain editable in both views.

**Table view.** Instead of the document editor, the page renders a table of its direct subpages in manual (rank) order: a Name column (page icon when set + title; clicking a row opens that page) and an Updated column (relative time). Empty pages show "No pages inside yet." The document editor is not mounted in table view, so the Comments action and the backlinks section are hidden there (they belong to the document).

**Known limitations.** The table view is read-only (no inline rename, no sorting/filtering, no custom properties, no per-row menus) and lists direct children only, not deeper descendants. Those remain out of scope for M6.

## 16. M7.1 spec: block gutter and block menu (Pagegrove — C, informed by A-web)

**Gutter.** Hovering any top-level block reveals a two-button gutter at the block's left edge: `+` (Insert block below — inserts an empty paragraph after the block and moves the caret into it) and a grip button (Block options). The gutter persists while the pointer is over the block or the gutter itself (a short grace period covers the gap), and hides when the pointer leaves or a drag starts.

**Block menu.** Clicking the grip opens a "Block menu": Duplicate, Delete, Move up, Move down, and — for turnable blocks (anything except tables and horizontal rules) — a "Turn into" section listing Text, Heading 1–3, Bulleted list, Numbered list, To-do list, Toggle, Quote, Code. Turning into a list/toggle/quote wraps the block's inline text in the appropriate structure; turning into Code keeps text only (marks stripped). Menu supports arrow-key navigation, Enter to activate, Escape or an outside click or scrolling to close. Duplicate/delete/move operate on the block the hover tracked. Move operations move the whole block (lists and toggles move as a unit) and drop the caret inside the moved block.

**Drag to reorder.** Dragging the grip vertically picks the block up: a 2px accent line shows the drop position (top or bottom half of the hovered block decides above/below), and releasing moves the block there. A plain click (pointer travel under 4px) opens the menu instead. Dragging adds `pg-block-dragging` to `body` (grabbing cursor, no text selection); the drop indicator hides on release, Escape, or window resize.

**Keyboard.** `Mod-Shift-ArrowUp` / `Mod-Shift-ArrowDown` move the current block up/down (Notion's binding; the earlier `Alt-Shift-*` bindings remain). Document focus and selection survive every operation.

**Persistence.** All operations are plain ProseMirror transactions — they ride the normal save debounce (250ms), Yjs updates, LAN sync, and sync bundles; content survives reload and converges over sessions like any other edit.

**Known limitations.** No multi-block selection (single top-level block per operation), no cross-Pagegrove drop targets (blocks reorder within one document only), no drag handle at nested list-item level (drags move the whole list), no "Turn into" preview icons.

## 17. M7.2 spec: selection format bar, colors, and callouts (Pagegrove — C, informed by A-web)

**Selection format bar.** Selecting text opens a floating bar above the selection: Bold, Italic, Underline, Strikethrough, Code (each `aria-pressed` while active), then two swatches (Text color, Background color), and — when the page has comments enabled — the "Comment" action (the bar replaces the old standalone comment pill; commenting keeps its exact behavior). The bar is clamped into the viewport, re-anchors on scroll, and hides when the selection collapses, the editor blurs, or the selection sits in a code block. Buttons `mousedown`-guard so the selection survives every interaction.

**Colors.** Each swatch opens a 10-cell palette (Default + gray, brown, orange, yellow, green, blue, purple, pink, red) rendered in both light and dark schemes from theme variables. Picking the color of the active selection toggles it off; Default clears the mark. Text color and background color are inline marks (`data-text-color`, `data-bg-color`) that coexist with every other mark and persist through save/reload, Yjs, LAN sync, and sync bundles.

**Callouts.** `/callout` (aliases note, info, tip) inserts a callout block — an emoji badge (default 💡, click to change through the emoji picker) beside editable block content. Callouts are regular top-level blocks for the gutter: they hover, drag, duplicate, delete, and can be "Turn into" targets both ways. Markdown export writes callouts as `<div data-callout="💡">…</div>` blocks; colors have no markdown representation and export as plain text.

**Export fix.** Markdown export previously threw when a document contained marks it did not know (this affected comment anchors on export); unknown inline marks now serialize as plain text, so any styled document exports cleanly.

**Known limitations.** No "last used color" shortcuts, no comment highlight color inside the bar (Notion shows the comment color chip), no per-block callout background color choice (callouts use the neutral surface color), and the bar does not appear inside code blocks by design.

## 18. M7.3 spec: image blocks and cover upload (Pagegrove — C, informed by A-web)

**Image blocks.** `/image` (aliases img, picture) opens the native file picker (png, jpg, gif, webp, bmp, svg, avif; 40 MB cap) and inserts an image block; pasting or dropping image files into the editor imports them through the same pipeline. Imported files are copied to `<workspace>/assets/<uuid>.<ext>` and referenced by workspace-relative path, keeping workspaces portable; rendering goes through the `pgfile://` app protocol rooted at the workspace assets folder (with a path-traversal guard) and the production CSP allows it via `img-src`. Image blocks select on click (accent outline) and show a "Delete image" action; they hover, drag, duplicate, and delete like other blocks. Markdown export writes `![alt](assets/<uuid>.<ext>)` with the stored relative path.

**Cover upload.** The cover picker gains an "Upload image" button using the same import pipeline; uploaded covers render edge-to-edge over the cover band (`object-fit: cover`) and the picker shows the current upload as an active swatch. Preset covers are unchanged.

**Known limitations.** Assets travel with the workspace folder but not with LAN sync bundles or live sessions (bundles carry page data only; copy the `assets` folder alongside a bundle to move images); no image resizing, captions, or text-wrap around images.

## 19. M7.4 spec: breadcrumbs, page options, and tree menus (Pagegrove — C, informed by A-web)

**Breadcrumbs.** The page header opens with a breadcrumb trail above the cover: the page icon, then clickable ancestors (em dash between each) ending in the current page (truncated, non-clickable, `aria-current="page"`). Clicking an ancestor navigates to it. When the path is deeper than four segments the middle collapses into a "…" button whose popover lists the hidden pages; it closes on outside click or Escape.

**Page options.** A "…" button at the right of the breadcrumb row opens the page menu: Copy link (writes `pagegrove://page/<id>` to the clipboard), Duplicate, Export as Markdown, and Move to trash.

**Tree menus.** Each sidebar row's "…" menu now offers Rename, Duplicate, Add to/Remove from Favorites, Move to…, New subpage, and Move to trash. Duplicate deep-copies the page and its whole subtree ("Title (copy)" for the root copy, children keep their titles) and inserts the copy directly below the original; comments are not copied. Move to… swaps the menu into a searchable target picker with "Top level" plus every page that is not inside the moved page's own subtree; picking a target re-parents the page.

**Favorites.** Favorited pages appear in a collapsible Favorites section at the top of the sidebar, sorted by last edited. The star state rides on page metadata, so it persists through reload, LAN sync, and sync bundles.

**Known limitations.** Favorites cannot be manually reordered; the `pagegrove://` link scheme is for reference only (not clickable outside the app); duplicate does not copy comments.

## 20. M7.5 spec: database properties and cells (Pagegrove — C, informed by A-web)

**Databases.** Every page in Table view is a database hub: its subpages are rows. Properties are defined on the hub itself and both the schema and the per-row values ride on page metadata, so they persist through reload, LAN sync, and sync bundles, and a deep duplicate copies the schema and all values. Six property types ship: text, number, select, multi-select, date, and checkbox, alongside the built-in Name and Updated columns.

**Property management.** The "Add property" (+) header button appends a column by type (default name is the type label). Each column header opens a menu with Rename (inline input) and Delete property. Changing a property's type after creation is not supported (delete and re-add instead).

**Cells.** Text and number cells are inline inputs that commit on blur or Enter; date cells use a native date input; checkbox cells toggle on click; select and multi-select cells open a popover with an option search that doubles as a creator ("Create \"...\"" or Enter adds the option to the schema and picks it in one step). Picking the active value in a single-select clears it; multi-select toggles values. A "+ New row" footer row creates a subpage in place without leaving the hub.

**Markdown export.** Databases export exactly as before — rows are still pages, so each row exports its own document; property values have no markdown representation.

**Known limitations.** No sorting, filtering, or per-view configuration; no property type changes after creation; no select option colors, formulas, relations, or rollups; the table lists direct children only.



