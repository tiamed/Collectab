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

PostgreSQL is **required**.

### Option A — Docker Compose (recommended)

```bash
git clone https://github.com/tiamed/Collectab.git && cd Collectab
docker compose up -d
```

This starts **PostgreSQL** and the API server. The server applies SQL migrations automatically on startup.

API: `http://localhost:3001/api`  
Postgres (host): `localhost:5432` — database `collectab`, user/password `postgres` / `postgres` (override with `POSTGRES_PASSWORD`).

> Existing installs using the old database name `toby_bookmark` can keep their `DATABASE_URL` as-is, or rename the DB (`ALTER DATABASE toby_bookmark RENAME TO collectab`) and update the connection string.

> `docker compose up` pulls `ghcr.io/tiamed/collectab/server:latest`. To build locally: `docker compose up --build`.

### Option B — PostgreSQL + server separately

**1. Start PostgreSQL** (pick one):

```bash
# From this repo (Postgres only)
docker compose up postgres -d

# Or a one-off container (no compose)
docker run -d --name collectab-pg \
  -e POSTGRES_DB=collectab \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -v collectab-pgdata:/var/lib/postgresql/data \
  postgres:17-alpine
```

Wait until ready:

```bash
docker compose exec postgres pg_isready -U postgres
# or: docker exec collectab-pg pg_isready -U postgres
```

**2. Run the API server** (image or local Node):

```bash
docker pull ghcr.io/tiamed/collectab/server:latest
docker run --rm -p 3001:3001 \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/collectab \
  -e JWT_SECRET=your-secret-at-least-32-chars-long \
  -e JWT_REFRESH_SECRET=your-refresh-secret-at-least-32-chars \
  ghcr.io/tiamed/collectab/server:latest
```

On Linux, if `host.docker.internal` is unavailable, use the host gateway IP or run with `--network host` and `DATABASE_URL=...@127.0.0.1:5432/collectab`.

Migrations run on server start. To apply SQL manually instead:

```bash
# Compose Postgres
for f in server/src/database/migrations/*.sql; do
  docker compose exec -T postgres psql -U postgres -d collectab < "$f"
done

# One-off container
for f in server/src/database/migrations/*.sql; do
  docker exec -i collectab-pg psql -U postgres -d collectab < "$f"
done
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
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/collectab` |
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
docker compose up postgres -d   # Start PostgreSQL (required)
# or: docker run -d --name collectab-pg -e POSTGRES_DB=collectab \
#      -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
#      -p 5432:5432 -v collectab-pgdata:/var/lib/postgresql/data postgres:17-alpine
npm run dev                     # migrations run automatically on startup
```

To apply migrations manually:

```bash
for f in src/database/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
# or: npm run db:migrate
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
