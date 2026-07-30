# toby-bookmark - Work Plan

## TL;DR (For humans)

**What you'll get:** A functional dark-theme bookmark manager running on your machine. You'll open a webpage, see your collections as card grids (like Toby), add/edit/reorder bookmarks, and all changes sync in real-time across browser tabs. A server handles auth and persistence so your data survives restarts.

**Why this approach:** Loro CRDT gives us conflict-free drag-drop reordering for free, and Hocuspocus handles WebSocket room management so we don't re-invent connection state machines. A server-relayed sync model (instead of P2P) simplifies auth and persistence.

**What it will NOT do:** Light mode, PWA/mobile app, browser extension, AI auto-tagging, or third-party OAuth login.

**Effort:** Medium — 3 waves, ~16 todos
**Risk:** Low — skeleton code exists, core libraries are mature
**Decisions to sanity-check:** Loro (not Yjs) as CRDT; dark theme only; server-relayed (not P2P) sync

Your next move: Review and approve, or ask for high-accuracy review.

---

> TL;DR (machine): Medium effort, low risk. 3 execution waves: (1) bridge WS sync, (2) CRDT CRUD + drag-drop, (3) deploy + polish. ~16 todos.

## Scope
### Must have
- Server starts, REST API responds, WS accepts connections
- Client renders OpenPencil dark theme UI with sidebar + collection cards
- Client connects to WS, sends Loro updates, receives broadcasts from other clients
- CRUD: create/rename/delete collections, add/edit/delete bookmarks
- Drag-drop reorder bookmarks (within and between collections)
- Auth: register/login with JWT, protected routes
- Persistence: CRDT snapshots survive server restart
- Docker Compose: one command to bring up full stack

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Light mode or theme toggle
- Mobile/PWA
- Browser extension
- OAuth providers (Google/GitHub)
- AI features
- Markdown/rich text notes
- P2P/WebRTC
- Performance testing or load testing

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after (manual QA per todo) + lsp_diagnostics
- Evidence: .omo/evidence/toby-bookmark/task-<N>/

## Execution strategy
### Parallel execution waves
Wave 1 (WS Bridge): 1, 2, 3 — can run in parallel
Wave 2 (CRDT CRUD): 4, 5, 6 — depend on wave 1, parallel with each other
Wave 3 (Drag-Drop): 7, 8 — depend on wave 2
Wave 4 (Deploy): 9, 10 — depend on wave 3

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
|---|---|---|---|
| 1. Server-Client WS connect | — | 3, 4, 5 | 2 |
| 2. Auth UI + flow | — | 4 | 1 |
| 3. Loro import/export over WS | 1 | 5, 6 | — |
| 4. Collection CRUD UI | 2, 3 | 7 | 5, 6 |
| 5. Bookmark CRUD UI | 3 | 7 | 4, 6 |
| 6. Search UI | 3 | — | 4, 5 |
| 7. Drag-drop reorder | 4, 5 | 8 | — |
| 8. Cross-collection move | 7 | 9 | — |
| 9. Docker Compose test | 8 | 10 | — |
| 10. E2E smoke test | 9 | — | — |

## Todos

<!-- APPEND TASK BATCHES BELOW THIS LINE - never rewrite the headers above. -->

### Wave 1 — WebSocket Sync Bridge

- [ ] 1. **Client-Server WebSocket connection + Loro binary handshake**
  What to do / Must NOT do:
  - In `client/src/store/sync-manager.ts`: connect to `ws://localhost:3001/ws/workspace/{id}?token={jwt}`
  - On open: send initial LoroDoc snapshot request
  - Server receives, creates room via `LoroRoomManager`, returns snapshot
  - Client imports snapshot → UI renders
  - Must NOT use Yjs sync protocol — pure Loro binary over raw WS
  - Must handle: connection retry (3 attempts, 2s backoff), clean disconnect
  Parallelization: Wave 1 | Blocked by: — | Blocks: 3, 4, 5
  References:
  - server/src/index.ts:45-75 (WS upgrade handler)
  - server/src/server/loro-manager.ts:30-55 (loadFromPersistence)
  - client/src/store/sync-manager.ts:35-70 (connect skeleton)
  - Loro docs: subscribeLocalUpdates + export/import
  Acceptance criteria: Opening two browser tabs shows the same initial state
  QA scenarios:
  - Happy: connect → receive snapshot → same data in both tabs
  - Failure: wrong roomId → error returned, connection closed gracefully
  Commit: N (squash at end)

- [ ] 2. **Auth UI — Login / Register / Token storage**
  What to do / Must NOT do:
  - Create `client/src/app/auth/login.tsx` and `register.tsx` pages with HeroUI form
  - Wire to `POST /api/auth/login` and `/register`
  - Store accessToken + refreshToken in memory + httpOnly cookie
  - `client/src/lib/api-client.ts` — auto-attach Bearer token, handle 401 → refresh
  - Must NOT store tokens in localStorage
  - Show sync status indicator only after auth
  Parallelization: Wave 1 | Blocked by: — | Blocks: 4
  References:
  - server/src/api/routes/auth.ts:1-120
  - client/src/lib/api-client.ts:25-80
  - HeroUI: Button, Input, Card, Form patterns
  Acceptance criteria: Can register, login, see token in response, protected routes return 401 without token
  QA scenarios:
  - Happy: register → login → token received → /api/auth/me returns user
  - Failure: wrong password → 401 with error message
  Commit: N

- [ ] 3. **Bidirectional Loro sync — subscribe + broadcast**
  What to do / Must NOT do:
  - On connect, client calls `doc.subscribeLocalUpdates(update => ws.send(update))`
  - WS message handler calls `doc.import(new Uint8Array(data))`
  - On server: `LoroRoomManager.applyUpdate()` imports + exports diff, broadcasts to other clients in same room
  - Broadcast uses Hocuspocus's room peer list (iterate connected clients)
  - Must NOT echo update back to sender
  - Handle concurrent edits: CRDT auto-merges
  - Log sync stats: bytes sent, ops per second
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 5, 6
  References:
  - server/src/server/loro-manager.ts:60-90 (applyUpdate)
  - server/src/extensions/loro-sync.extension.ts:35-60
  - client/src/lib/loro-adapter.ts:85-100 (onLocalUpdate, importUpdate)
  - Loro docs: subscribeLocalUpdates
  Acceptance criteria: Editing in tab A instantly reflects in tab B without refresh
  QA scenarios:
  - Happy: tab A adds bookmark → tab B shows it
  - Conflict: both tabs edit same bookmark title concurrently → last-writer-wins (Loro default)
  Commit: N

### Wave 2 — CRDT CRUD + UI

- [ ] 4. **Collection CRUD — create, rename, delete**
  What to do / Must NOT do:
  - "New Collection" button triggers HeroUI Modal with name + icon picker
  - Calls `LoroAdapter.addCollection()` → pushes to `LoroList("collections")`
  - Sidebar re-renders from LoroDoc subscription
  - Collection context menu (rename, delete, duplicate, change icon)
  - Delete triggers confirmation dialog
  - All operations sync via WS to other clients in real time
  - Use LoroMap for each collection: name, icon, color, items list
  Parallelization: Wave 2 | Blocked by: 2, 3 | Blocks: 7
  References:
  - client/src/lib/loro-adapter.ts:35-55 (addCollection)
  - client/src/components/layout/Sidebar.tsx:60-90 (spaces nav)
  - HeroUI: Modal, DropdownMenu, Button
  - OpenPencil design: sidebar spaces list
  Acceptance criteria: Create → appears in sidebar + main area. Rename → updates everywhere. Delete → removed with confirmation.
  QA scenarios:
  - Happy: create "Work" → sidebar shows it → rename to "Office" → reflects
  - Failure: delete with bookmarks → confirmation dialog → confirm → removed
  Commit: N

- [ ] 5. **Bookmark CRUD — add, edit, delete, favicon**
  What to do / Must NOT do:
  - "Add Bookmark" button in CollectionPanel header → Modal with URL + title + tags
  - Auto-fetch title + favicon from URL (server-side via `POST /api/bookmarks/import`)
  - Calls `LoroAdapter.addBookmark()` → pushes to collection's `LoroList("items")`
  - BookmarkCard context menu: Edit, Move to..., Delete
  - Edit modal pre-fills existing data
  - Favicon displayed in 20×20 colored icon box (fallback to first letter)
  - Tags as LoroList<string>, rendered as tiny chips on card
  Parallelization: Wave 2 | Blocked by: 3 | Blocks: 7
  References:
  - client/src/lib/loro-adapter.ts:60-80 (addBookmark)
  - client/src/components/bookmark/BookmarkCard.tsx:1-60
  - client/src/components/collection/CollectionPanel.tsx:30-55
  - HeroUI: Modal, Input, Chip, Button
  - OpenPencil design: card 168×92, icon + title + desc
  Acceptance criteria: Add → card appears in collection. Edit → card updates. Delete → card removed.
  QA scenarios:
  - Happy: add "GitHub" → card shows favicon + title + desc
  - Failure: invalid URL → server returns 400, client shows error toast
  Commit: N

- [ ] 6. **Search UI — full-text across bookmarks**
  What to do / Must NOT do:
  - Implement `client/src/app/search/page.tsx` — search results page
  - SearchBar component → debounced input (300ms) → `GET /api/search?q=`
  - Server-side: PostgreSQL full-text search on title + url + description
  - Results rendered as same BookmarkCard grid, grouped by collection
  - Empty state: "No results found" with illustration
  - Must NOT search on every keystroke — debounce 300ms
  Parallelization: Wave 2 | Blocked by: 3 | Blocks: —
  References:
  - server/src/api/routes/search.ts:1-35
  - client/src/components/ui/SearchBar.tsx:1-30
  - PostgreSQL: `websearch_to_tsquery('english', query)`
  Acceptance criteria: Type "bilibili" → finds card with "bilibili" in title/desc
  QA scenarios:
  - Happy: search "bilibili" → shows B站 card
  - Empty: search "zzzznonexistent" → "No results" state
  Commit: N

### Wave 3 — Drag-Drop Reorder

- [ ] 7. **Within-collection drag-drop reorder**
  What to do / Must NOT do:
  - Use `LoroList` CRDT operations: `doc.getList("items").splice(from, 1)` then `.insert(to, item)`
  - Drag handle on hover (left edge of card, grip icon)
  - Drop zone highlight between cards
  - Syncs via WS: other clients see the new order
  - Must NOT use HTML5 drag-and-drop API directly — use Loro's CRDT MovableList semantics
  - Must handle concurrent drags from different clients (CRDT merge)
  Parallelization: Wave 3 | Blocked by: 4, 5 | Blocks: 8
  References:
  - client/src/lib/loro-adapter.ts:85-95 (moveBookmark)
  - Loro docs: LoroList.splice(), LoroList.insert()
  - OpenPencil design: cards in flex-wrap grid
  Acceptance criteria: Drag card to new position → order updates → other tab shows same order
  QA scenarios:
  - Happy: drag card #3 to position #1 → card #3 at top
  - Concurrent: two clients drag different cards → CRDT merge, no data loss
  Commit: N

- [ ] 8. **Cross-collection move bookmarks**
  What to do / Must NOT do:
  - "Move to..." in card context menu → dropdown listing all collections
  - Calls `LoroAdapter.moveBookmark(fromList, index, toList, toIndex)`
  - Source collection removes card, target collection inserts it
  - Both views update in real time across all clients
  - Undo support via Loro's version ops (optional)
  Parallelization: Wave 3 | Blocked by: 7 | Blocks: 9
  References:
  - client/src/lib/loro-adapter.ts:85-95 (moveBookmark)
  - OpenPencil design: sections are independent collections
  Acceptance criteria: Move card from Collection A to Collection B → card disappears from A, appears in B
  QA scenarios:
  - Happy: move card from "Work" to "Personal" → card in Personal
  - Failure: move to same collection → no-op
  Commit: N

### Wave 4 — Deploy + Polish

- [ ] 9. **Docker Compose full-stack smoke test**
  What to do / Must NOT do:
  - `docker compose up` starts: PostgreSQL, Redis, server, client
  - Server health check: `GET /health` returns 200
  - Client builds and serves on `localhost:3000`
  - API routes return proper responses
  - WS connection established between client and server
  - Must NOT hardcode secrets in docker-compose.yml — use .env
  - Add `.env.example` files for both server and client
  Parallelization: Wave 4 | Blocked by: 8 | Blocks: 10
  References:
  - docker-compose.yml:1-45
  - server/Dockerfile:1-25
  - server/src/index.ts:1-85
  Acceptance criteria: `docker compose up` → all containers healthy → client loads → WS connects
  QA scenarios:
  - Happy: full stack up, register user, create collection, see it in UI
  - Failure: postgres down → server logs error, fails gracefully
  Commit: N

- [ ] 10. **End-to-end smoke test + polish**
  What to do / Must NOT do:
  - Chain: register → login → create collection → add 3 bookmarks → drag-reorder → verify in new tab
  - UI polish: loading skeletons for async data, empty states for each section
  - Error boundaries around Loro operations
  - SyncIndicator shows correct connection status
  - Clean console: no unhandled errors in browser devtools
  - LSP diagnostics: zero errors in all changed files
  Parallelization: Wave 4 | Blocked by: 9 | Blocks: —
  References:
  - All components
  - lsp_diagnostics for server/src/ and client/src/
  Acceptance criteria: Full user flow works end-to-end without console errors
  QA scenarios:
  - Full flow: register → login → create → drag → verify sync across tabs
  - Edge: rapid repeated add/delete → no CRDT corruption
  Commit: Y | feat: complete bookmark management MVP with CRDT sync

## Final verification wave
- [ ] F1. Plan compliance audit — all 10 todos completed
- [ ] F2. Code quality review — lsp_diagnostics clean on server/ + client/
- [ ] F3. Real manual QA — open two browser tabs, full CRUD cycle
- [ ] F4. Scope fidelity — no light mode, no browser extension, no P2P

## Commit strategy
Squash all commits into one at todo 10: `feat: toby-like bookmark management with Loro CRDT real-time sync`
Commit message body will reference all files changed and the OpenPencil design.

## Success criteria
1. Server starts with `docker compose up` — REST API + WS on :3001
2. Client serves on :3000, renders dark theme UI matching OpenPencil design
3. Register/login flow works with JWT
4. Create collection → add bookmarks → displayed as 168×92 cards in grid
5. Drag-reorder bookmarks within a collection — syncs across tabs in real time
6. Move bookmark between collections
7. Search finds bookmarks by title/url/description
8. Server restart preserves all CRDT data (PostgreSQL snapshot)
9. Zero unhandled errors in console
10. LSP diagnostics clean on all modified files
