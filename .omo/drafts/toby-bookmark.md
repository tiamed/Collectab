---
slug: toby-bookmark
status: awaiting-approval
intent: clear
pending-action: write .omo/plans/toby-bookmark.md
approach: Incrementally bridge skeleton code → functional prototype → production-ready
---

# Draft: toby-bookmark

## Components (topology ledger)
| id | outcome | status | evidence path |
|---|---|---|---|
| server-core | Express + Hocuspocus + WS upgrade handler | ✅ active | server/src/index.ts:1-85 |
| server-loro | LoroRoomManager (getOrCreate, applyUpdate, persist) | ✅ active | server/src/server/loro-manager.ts:1-160 |
| server-api | REST routes (auth, collections, bookmarks, search, share) | ✅ active | server/src/api/routes/ |
| server-db | PostgreSQL schema + Drizzle client + migrations | ✅ active | server/src/database/ |
| server-ext | Auth + LoroSync + Persistence extensions | ✅ active | server/src/extensions/ |
| client-loro | LoroAdapter (CRUD, subscribe, import/export) | ✅ active | client/src/lib/loro-adapter.ts |
| client-sync | SyncManager (WS connect, status, presence) | ✅ active | client/src/store/sync-manager.ts |
| client-ui | HeroUI dark theme + components | ✅ active | client/src/components/ |
| ws-bridge | Loro binary ↔ WebSocket real-time sync | 🔄 deferred | bridge not yet end-to-end tested |
| dnd | CRDT MovableList drag-and-drop reorder | 🔄 deferred | not implemented |
| browser-ext | Chrome extension for one-click bookmark | 🔄 deferred | not started |
| deploy | Docker Compose full stack | 🔄 deferred | docker-compose.yml exists, untested |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
|---|---|---|---|
| Auth provider | JWT with bcrypt + refresh rotation | Self-contained, no 3rd party dependency | Yes |
| Loro sync mode | Server-relayed binary updates via export/import | Simpler than P2P, Hocuspocus manages rooms | No |
| CRDT room key | "workspace:{uuid}" for full workspace sync | Isolates user data by workspace | No |
| DB for CRDT | PostgreSQL BYTEA for snapshots + update log | Already have PG, avoids extra infra | Yes |
| Card grid layout | Fixed 168×92 cards in flex-wrap, 12px gap | Matches OpenPencil design spec | Yes |

## Findings (cited - path:lines)
- Hocuspocus is Yjs-native, needs custom LoroSyncExtension to bridge Loro binary: server/src/extensions/loro-sync.extension.ts:1-70
- Loro subscribeLocalUpdates emits Uint8Array diffs: loro-crdt docs, client/src/lib/loro-adapter.ts:90-95
- Loro export({mode:"snapshot"}) for full state, export({mode:"update", from:version}) for incremental: server/src/server/loro-manager.ts:105-115
- OpenPencil design spec: cards 168×92, #3d3d52 bg, 6px radius, 12px title: docs/ARCHITECTURE.md §4.3
- HeroUI v3 dark mode: data-theme="dark", CSS vars via @heroui/react: client/src/app/globals.css

## Decisions (with rationale)
1. **Loro as primary CRDT, not Yjs** — MovableList for drag-drop, WASM small size, Rust support
2. **Hocuspocus for WS management** — room isolation, auth hooks, extension system off-the-shelf
3. **Server-relayed sync** (not P2P) — simpler auth, persistence, and room management
4. **Dark theme only (no light toggle initially)** — matches existing OpenPencil design, reduces scope
5. **Lucide icons** — tree-shakable, HeroUI-compatible, consistent outline style

## Scope IN
- Server: Express REST API + Hocuspocus WS + Loro CRDT room sync
- Client: Next.js + HeroUI dark theme + real-time bookmark CRUD
- Real-time sync: Loro binary over WebSocket via Hocuspocus
- CRDT data model: Workspace → Collection → Bookmark (LoroMap + LoroList)
- Auth: JWT register/login/refresh
- Persistence: PostgreSQL snapshots + update log via Drizzle
- OpenPencil design: dark theme #1e1e2e, 168×92 cards, spaces sidebar

## Scope OUT (Must NOT have)
- Light mode / theme toggle
- P2P sync (WebRTC) — server-relayed only
- Mobile app or PWA
- Self-hosted WebRTC signaling
- Third-party OAuth (Google/GitHub) — JWT only
- Markdown notes or rich text on bookmarks
- Browser extension in v1 (deferred to next phase)
- AI features (auto-tag, screenshot capture)

## Open questions
None — architecture decisions are locked. Remaining work is implementation.

## Approval gate
status: awaiting-approval
Approach: 3 execution waves — (1) bridge WS sync, (2) CRDT drag-drop + CRUD, (3) deploy + polish.
User to review the plan under `.omo/plans/toby-bookmark.md`.
