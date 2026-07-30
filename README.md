# Collectab

A Toby-like browser extension bookmark manager with organizations, spaces, collections, drag-drop reorder, and real-time sync.

## Features

- **Organizations** — isolate work/hobby/personal bookmarks; invite collaborators
- **Spaces & Collections** — hierarchical organization (Org → Space → Collection → Bookmarks)
- **Drag & Drop** — reorder bookmarks within/across collections and reorder spaces
- **Import / Export** — import from NiceTab, Toby, or a previous export; export all data as JSON
- **Light & Dark Mode** — system-aware theme toggle
- **Self-hostable** — configurable API server URL
- **Save Session** — save all open tabs as a collection

## Structure

```
├── extension/          # WXT browser extension (React + HeroUI + Tailwind)
│   ├── entrypoints/
│   │   └── newtab/     # Main UI — new tab override
│   ├── components/
│   ├── hooks/
│   └── lib/
├── server/             # Hono API server
│   └── src/
│       ├── api/        # REST routes (auth, orgs, spaces, collections, bookmarks, import)
│       └── database/   # PostgreSQL schema (Drizzle ORM)
└── .github/workflows/  # CI + tag-based release
```

## Self-Deployment

### Quick Start (Docker Compose)

```bash
# 1. Clone and start all services (pulls pre-built image from ghcr.io)
git clone https://github.com/tiamed/Collectab.git && cd Collectab
docker compose up -d

# 2. Run database migrations
docker compose exec postgres psql -U postgres -d toby_bookmark \
  -f /dev/stdin < server/src/database/migrations/001_initial.sql
docker compose exec postgres psql -U postgres -d toby_bookmark \
  -f /dev/stdin < server/src/database/migrations/002_space_members.sql
docker compose exec postgres psql -U postgres -d toby_bookmark \
  -f /dev/stdin < server/src/database/migrations/003_organizations.sql
```

The server will be available at `http://localhost:3001/api`.

> **Note**: `docker compose up` will pull the pre-built server image from `ghcr.io/tiamed/collectab/server:latest`. To build locally instead, use `docker compose up --build`.

Or pull the server image directly:

```bash
docker pull ghcr.io/tiamed/collectab/server:latest
docker run -p 3001:3001 \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/toby_bookmark \
  -e JWT_SECRET=your-secret-here \
  -e JWT_REFRESH_SECRET=your-refresh-secret-here \
  ghcr.io/tiamed/collectab/server:latest
```

### Configure the Extension

1. Install the extension (load unpacked from `extension/.output/chrome-mv3/` or install the `.zip` from Releases).
2. Open a new tab → click the **Settings** gear icon.
3. Set the **Server URL** to your server's address (e.g. `http://your-server:3001/api`).
4. Click **Save & Test** to verify the connection.

### Environment Variables

Copy `server/.env.example` to `server/.env` and customize:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/toby_bookmark` |
| `JWT_SECRET` | Secret for signing access tokens (min 32 chars) | — |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | — |
| `PORT` | Server port | `3001` |
| `CORS_ORIGIN` | Allowed CORS origins | `*` |

> **Production**: Always change `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `POSTGRES_PASSWORD` to strong random values.

---

## Development

### Extension

```bash
cd extension
pnpm install
pnpm dev          # Chrome dev mode with HMR
pnpm dev:firefox  # Firefox dev mode
pnpm build        # Production build
pnpm zip          # Package as .zip for distribution
```

### Server

```bash
cd server
npm install
cp .env.example .env
docker compose up postgres -d   # Start PostgreSQL only
npm run dev
```

Run migrations before first use:

```bash
psql $DATABASE_URL -f src/database/migrations/001_initial.sql
psql $DATABASE_URL -f src/database/migrations/002_space_members.sql
psql $DATABASE_URL -f src/database/migrations/003_organizations.sql
```

## CI / Release

- **CI** (`.github/workflows/ci.yml`) — builds extension and server on every push to `main` and on PRs.
- **Release** (`.github/workflows/release.yml`) — when a `v*` tag is pushed, builds and zips the extension, then creates a GitHub Release with the `.zip` attached.

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Tech Stack

- **Extension**: WXT + React 19 + HeroUI v3 + Tailwind CSS v4 + Lucide icons
- **Server**: Hono + PostgreSQL + Drizzle ORM + JWT auth
- **Drag & Drop**: @dnd-kit/core + @dnd-kit/sortable
