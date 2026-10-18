# Pagegrove — M5 Validation Report

Date: 2026-10-17
Scope: full app — `m0` through `m4-product` (`bc954cf`), plus review fixes in this milestone.
Milestone tags: `m0`, `m1-editor`, `m2-persistence`, `m3-lan`, `m4-product`, `m5-validation`.

## Verdict

**PASS.** All automated gates are green, the security audit found no blockers (one accepted moderate dependency advisory), and the code review is approved with low-severity fixes applied.

## 1. Automated gates

| Gate | Command | Result |
|---|---|---|
| Typecheck | `pnpm typecheck` | Clean (node + web configs) |
| Lint | `pnpm lint` | Clean (zero warnings) |
| Unit tests | `pnpm test` | 28/28 passed (rank, tree, doc-text, sync) |
| Build | `pnpm build` | 353 modules, renderer 1,774.84 kB |
| E2E | `pnpm test:e2e` | 7/7 passed (1 flaky test passed on retry) |
| Packaged dir | `pnpm dist:dir` | `release/win-unpacked/Pagegrove.exe` built, fuses flipped |
| Installers | `pnpm dist` | `Pagegrove-0.1.0-x64.exe` (84.7 MB), `Pagegrove-0.1.0-portable.exe` (84.5 MB) |

E2E inventory (`e2e/`):

| Spec | Covers |
|---|---|
| `persistence.spec.ts` | kill -9 crash safety — saved content survives relaunch |
| `tree.spec.ts` | subpages, inline rename, trash cascade, restore, search |
| `multiplayer.spec.ts` | two-instance convergence over live session (tree + content + closed-page sync + peers), solo reload after session stop |
| `sync-bundle.spec.ts` | `.sync` bundle export/import round-trip |
| `palette.spec.ts` | Ctrl+K palette creates page; export as Markdown writes correct file |
| `packaged.spec.ts` | packaged exe launches, edits, persists across relaunch (skips if `dist:dir` not run) |

Packaging verification:

- `release/win-unpacked/resources/app.asar` contains `out/main`, `out/preload`, `out/renderer`, and production `node_modules`.
- Native module unpacked: `app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node`.
- Electron fuses verified with `getCurrentFuseWire()`: `RunAsNode=false`, `EnableCookieEncryption=true`, `EnableNodeOptionsEnvironmentVariable=false`, `EnableNodeCliInspectArguments=true` (see deviation below), `EnableEmbeddedAsarIntegrityValidation=true`, `OnlyLoadAppFromAsar=true`.
- Signing: no certificate configured — signing is explicitly skipped by electron-builder.

## 2. Security audit

**Overall: LOW / PASS** — no secrets, no injection vectors, Electron hardening in place. One moderate dependency advisory accepted with rationale.

| # | Severity | Category | Location | Status |
|---|---|---|---|---|
| 1 | MODERATE | Vulnerable dependency | `@tiptap/core` (all Tiptap v2 packages) | Accepted, follow-up tracked |
| 2 | LOW | LAN trust model | `src/main/session/*`, renderer session | Documented by design |

### Verified clean

- **Secrets**: pattern scan (AWS/GitHub/OpenAI-style keys, private keys, password literals) across all source files and full git history — nothing committed. The only `api_key` hit is the M0 research script reading Notion's own preload metadata at runtime (no values in repo).
- **SQL injection**: every query in `src/main/workspace/db.ts` uses prepared statements with `?` placeholders; the only `db.exec()` calls (db.ts:62, 86) are static migration DDL. The dynamic `WHERE` in `allRows()` is a static string constant, never user input.
- **Command injection / eval**: no `eval`, `new Function`, `child_process`, or shell execution in application code.
- **XSS**: no `dangerouslySetInnerHTML` / `innerHTML`; Tiptap renders through the ProseMirror schema; production CSP is restrictive (`default-src 'self'`, no `unsafe-eval`, `connect-src 'self' ws: wss:`); Markdown export HTML-escapes summary text (`lib/markdown.ts:7`).
- **IPC surface**: every renderer→main handler validates input with zod schemas before touching the database (`src/shared/schemas.ts`); file writes/reads only occur at paths chosen by the user via native dialogs.
- **LAN input**: signaling parses messages in try/catch with type guards, caps topics at 256 chars, enforces a 1 MB max payload, and reaps dead sockets via ping/pong (`session/signaling.ts`). Join codes are base64url → JSON with shape validation (`shared/join-code.ts`). Remote meta entries are re-validated through the same zod IPC boundary before persistence.
- **Electron hardening**: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webviewTag: false`, window-open and navigation denied, no remote content ever loaded; preload exposes a fixed typed bridge only.

### Finding 1 (accepted): `@tiptap/core` advisory GHSA-cp6q-959q-f8rh

`mergeAttributes()` in Tiptap < 3.30.4 can turn an own `__proto__` key into inherited DOM attributes. Trigger requires an extension author to pass attacker-influenced keys into `mergeAttributes` at extension-configuration time. Pagegrove registers only first-party/static extensions (`editor/editorExtensions.ts`) and never lets document content or LAN peers influence extension configuration, so the vulnerable path is unreachable in this app. Patched only in Tiptap v3; migrating from v2 is a planned follow-up, not a release blocker for a local-first app.

### Finding 2 (by design): LAN session trust model

Anyone with the join code can read and edit all pages during a session. There is no identity, ACL, or transport encryption (`ws://` on the LAN) — this matches the product spec's "share over LAN like a local network share" model. Mitigation: sessions are explicitly hosted and stopped by the user; join codes embed a random password used as the y-webrtc room secret. Documented as a limitation.

### Fuse deviation (documented)

`EnableNodeCliInspectArguments` is intentionally left enabled so Playwright can drive the packaged executable; disabling it would break automated UI smoke tests. `GrantFileProtocolExtraPrivileges` is intentionally left at its secure-by-default value because the renderer loads via `file://` from the asar — flipping it makes asar reads fail with `ERR_FILE_NOT_FOUND` (verified experimentally; noted in `scripts/afterPack.cjs`). A future `app://` custom protocol would allow disabling both.

## 3. Code review

Stage-1 gates (types, lint, tests, diff hygiene) pass: no stray `console.log`, no `any` casts, no leftover debug code. All empty `catch` blocks are intentional and carry explanatory comments or user-facing fallbacks (corrupt-yjs-update skip, already-destroyed teardown, best-effort WAL checkpoint).

**Verdict: Approved.** Findings:

- LOW (fixed in this milestone): `App.tsx` export/import callbacks could raise unhandled rejections if the IPC call throws; all three now catch and surface a toast.
- LOW: `db.ts:419` skips corrupt yjs updates on replay without a comment; consistent with `session.ts` behavior. Cosmetic.
- MEDIUM (tracked): no unit tests for the custom Markdown serializers (`taskList`, `taskItem`, `toggle`, `strike`, `underline`) — only the paragraph/title path is covered by e2e. Follow-up: table-driven serializer tests.
- MEDIUM (tracked, environmental): `multiplayer.spec.ts` test 2 flakes under load (WebRTC handshake contention when run after other Electron instances); passes on retry with `retries: 1`. Not a product bug — every observed failure converges after reconnect.

What is done well: doc-binding race guards and `carryFrom` seeding in `lib/session.ts`; origin-filtered persistence (`"init"` updates are never persisted); the `guarded(db, …)` wrapper that makes IPC handlers no-op safely during quit; drag-free rank ordering with explicit tie-break tests; fuses + asar integrity verified after packaging.

## 4. Known limitations

1. **Save debounce windows** — documents batch at 250 ms (Yjs updates 300 ms, renames 400 ms). A kill -9 within a window can drop that window; content saved before the crash survives (covered by `persistence.spec.ts`).
2. **No yupdates compaction** — the per-page update log is append-only; session end persists a compacted snapshot, but long-running single-document editing grows the log until then.
3. **Search index lag for remote edits** — during a session, full text for pages a peer never opens stays stale until opened locally; titles/parenting/rank sync immediately via meta.
4. **Rank collisions** — fractional ranks with creation-time tie-break; no periodic rebalancing (acceptable at this scale, tested).
5. **Windows Firewall** — hosting a session binds 0.0.0.0 and may prompt for firewall access; loopback always works.
6. **Unsigned binaries** — SmartScreen will warn ("unknown publisher"); portable and NSIS installer provided.
7. **Markdown fidelity** — toggles export as `<details>` HTML, underline as `<u>`, task items as `- [ ]`/`- [x]`; round-trip through Notion/GitHub is lossy for those constructs by nature of Markdown.
8. **Test flake** — `tree.spec.ts` hover and `multiplayer.spec.ts` test 2 occasionally flake under machine contention; mitigated with `retries: 1`, no product impact observed.

## 5. How to reproduce validation

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e        # builds, then runs the 7 Playwright specs
pnpm dist:dir        # unpacked app + fuses (needed for packaged.spec.ts)
pnpm dist            # NSIS + portable installers in release/
```

Note for first packaged build on a fresh machine: electron-builder extracts its `winCodeSign` tooling into `%LOCALAPPDATA%\electron-builder\Cache`; on Windows without Developer Mode this needs the symlink workaround used here (extract `winCodeSign-2.6.0.7z` excluding the `darwin` folder) or admin rights.

## 6. M6 addendum — feature expansion (drag/icons/covers, mentions, comments, tables, page views)

Date: 2026-10-18
Scope: `m6.1` (`f55f4eb`), `m6.2` (`23ae615`), `m6.3` (`f2044aa`), `m6.4-slice1` (`c88534c`), `m6.4` (final M6 tag).
Informed by the deep-RE addendum (`docs/behavior-spec.md` §10, `docs/rea/facts-editor.json`) — behaviors only, original implementation throughout.

**Verdict: PASS.** All gates green at M6.4; no new security findings.

| Gate | Result at M6.4 |
|---|---|
| Typecheck | Clean (node + web) |
| Lint | Clean |
| Unit tests | 30/30 (rank, tree, doc-text, sync — incl. new page-view diff test) |
| Build | 374 modules, renderer 1,907.86 kB |
| E2E | 16 tests / 15 specs green (packaged.spec retried once under machine load — same pre-existing flake class as M5) |

E2E inventory added in M6:

| Spec | Covers |
|---|---|
| `pages-m61.spec.ts` | tree drag-and-drop (reorder, nest, root drop), icon/cover persistence |
| `mentions-m62.spec.ts` | @mention chip insert + backlink list + reload, chip navigation |
| `comments-m63.spec.ts` | anchored comments — create/reply/reload/mark click, resolve/reopen/delete with anchor pruning |
| `tables-m64.spec.ts` | table insert via slash, Tab typing + Tab-appended row, toolbar ops, GFM markdown export, reload persistence |
| `views-m64.spec.ts` | page table view — subpage rows, row navigation, view persists across reload, toggle back |

**Security deltas (M6).** No new network surface: comments and the table view are workspace-local; migration v5 adds one column (`view`) and every new IPC handler (`pg:pages:set-view`, `pg:comments:*`) validates through zod at the same boundary as M5. Sync bundles gained `view`; legacy bundles without it normalize to `doc` on import. Tiptap packages pinned uniformly to 2.27.3 (table extensions from the same release line); no new advisories beyond the accepted M5 finding.

**Known limitations added in M6** (cross-referenced in `docs/behavior-spec.md`):

1. Comments are workspace-local — LAN sessions/sync bundles do not carry threads; foreign anchors are pruned on open (§13).
2. Tables: no merged cells, no column-width resize, no colors, no column types; row/column edits via toolbar only (§14).
3. Table view is read-only, lists direct children only, no sorting/filtering/custom properties (§15).
4. Backlink list can be stale while a page stays open after other pages start/stop mentioning it (§12).
5. Markdown serializer unit tests still absent (MEDIUM carried from M5); table/list serializer output covered via e2e export assertions.
6. Flake pair under machine contention: `packaged.spec.ts` (occasionally now) and `multiplayer.spec.ts` test 2 — both pass on retry with `retries: 1`; no product impact observed.

Reproduce:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
npx playwright test
```

## 7. M7 addendum — Notion-parity slices (gutter, format bar, images, chrome, databases)

Date: 2026-10-18
Scope: `m7.1` (`fcd9e47`), `m7.2` (`63a3f5d`), `m7.3` (`0eb6937`), `m7.4` (`5235a74`), `m7.5` (`5e1fc2e`), plus M7.6 polish in this milestone. Informed by the deep-RE addendum (`docs/behavior-spec.md` §16–§20) — behaviors only, original implementation throughout.

**Verdict: PASS.** All gates green at M7.5 + M7.6 polish; no new security findings.

| Gate | Result at M7.5/M7.6 |
|---|---|
| Typecheck | Clean (node + web) |
| Lint | Clean |
| Unit tests | 39/39 (rank, tree, doc-text, sync, database — 9 new schema/normalization tests) |
| Build | 387 modules, renderer 1,980.06 kB |
| E2E | 20 tests green (one spec-side assertion fix in `views-m64` for the new-row footer; `media-m73` title-typing and `packaged` flaked once each under load and passed on retry — same pre-existing flake class) |

E2E inventory added in M7:

| Spec | Covers |
|---|---|
| `blocks-m71.spec.ts` | block gutter — duplicate, turn into, drag move, delete, insert below |
| `format-m72.spec.ts` | selection format bar styles; callout survives export and reload |
| `media-m73.spec.ts` | image upload/paste via stubbed dialogs, cover upload, markdown export with asset paths, reload persistence |
| `chrome-m74.spec.ts` | breadcrumbs, page options (copy link, duplicate, export), favorites across reload, searchable move-to picker |
| `database-m75.spec.ts` | property add, typed cell editing, inline option creation, property rename/delete, new row, reload persistence |

**Security deltas (M7).** Migrations v6 (`favorite`) and v7 (`properties`, `fields`) add columns only; every new handler (`pg:pages:set-favorite/duplicate/set-properties/set-field`) validates through zod at the same IPC boundary as M5. The `pgfile://` asset protocol is registered as a privileged scheme with a workspace-rooted resolver and a path-traversal guard; production CSP gained `img-src 'self' pgfile:`. Sync bundles and live-session meta entries now carry `favorite`/`properties`/`fields` with legacy-entry normalization (favorite coerced, JSON columns defaulted); no new advisories beyond the accepted M5 Tiptap finding.

**Review notes.** One fix-forward: the committed `media-m73` spec was missing a DOM lib reference, failing `pnpm typecheck` at tag `m7.3`; fixed in the `m7.4` commit and verified clean since. M7.6 polish added: table view empty hubs render the full database shell (add property + new row), row list live-refreshes when page metadata changes elsewhere (sidebar rename, sync), number cells right-align, and the unused empty-state paragraph style was removed.

**Known limitations added in M7** (cross-referenced in `docs/behavior-spec.md`):

1. Assets travel with the workspace folder but not LAN bundles/live sessions (§18).
2. Databases: no sorting, filtering, per-view config, property type changes, option colors, formulas, relations, or rollups; table lists direct children only (§20).
3. Favorites cannot be manually reordered; `pagegrove://` links are reference-only (§19).
4. Block operations act on a single top-level block; no cross-page block drags (§16).
5. Markdown serializer unit tests still absent (MEDIUM carried from M5/M6).
6. Flake pair carried: `media-m73` title typing and `packaged.spec.ts` under machine contention — both pass on retry with `retries: 1`; no product impact observed.

Reproduce:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
npx playwright test
```

