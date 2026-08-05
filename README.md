# Collectab

<img width="2288" height="1260" alt="newtab preview" src="https://github.com/user-attachments/assets/1f83a103-fba6-45d4-8147-8f4a3a511535" />


A Toby-like browser extension bookmark manager with organizations, spaces, collections, drag-drop reorder, and CRDT-based real-time sync.

## Features

- **Organizations** — isolate work/hobby/personal bookmarks; invite collaborators
- **Spaces & Collections** — hierarchical organization (Org → Space → Collection → Bookmarks)
- **Drag & Drop** — reorder bookmarks within/across collections and reorder spaces
- **Real-time Sync** — Loro CRDT + WebSocket keeps bookmark order in sync across tabs
- **Import / Export** — import from NiceTab, Toby, or a previous export; export all data as JSON
- **Light & Dark Mode** — system-aware theme toggle
- **Self-hostable** — configurable API server URL
- **Save Session** — save all open tabs as a collection

## Structure

```
├── extension/          # WXT browser extension (React + Tailwind)
│   ├── entrypoints/
│   │   └── newtab/     # Main UI — new tab override
│   ├── components/
│   ├── hooks/
│   └── lib/
├── server/             # Hono API server
│   └── src/
│       ├── api/        # REST routes (auth, orgs, spaces, collections, bookmarks, search, import)
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

> **Port conflict?** If port 5432 on the host is already taken (e.g. another PostgreSQL instance), edit `docker-compose.yml` and change the Postgres `ports` mapping to a free host port, e.g. `15433:5432`. The server connects to Postgres over the internal Docker network (`postgres:5432`), so its `DATABASE_URL` stays unchanged — only host-side access to the database moves to `localhost:15433`.

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

> If port 5432 is taken on the host, change `-p 5432:5432` to a free port (e.g. `-p 15433:5432`) and use that port in the server's `DATABASE_URL` below (e.g. `host.docker.internal:15433`).

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
  -e BETTER_AUTH_SECRET=your-secret-at-least-32-chars-long \
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
| `BETTER_AUTH_SECRET` | Secret for signing auth tokens (min 32 chars) | — |
| `BETTER_AUTH_URL` | Public URL of the API server | `http://localhost:3001` |
| `PORT` | Server port | `3001` |
| `CORS_ORIGIN` | Allowed CORS origins | `*` |
| `TRUSTED_ORIGINS` | Comma-separated extra origins (e.g. `chrome-extension://<id>`) | — |
| `DEFAULT_ROLE` | Role assigned on signup (`guest` / `user` / `admin`) | `guest` |
| `ADMIN_USER_IDS` | Comma-separated user IDs with admin privileges | — |
| `ROLE_QUOTAS` | Per-role bookmark quotas (`guest=10,user=500,admin=unlimited`) | default quotas |
| `DISABLE_QUOTAS` | `true` to disable all bookmark quotas | `false` |
| `INVITE_MODE` | `open` (anyone can sign up as guest) or `invite-only` | `open` |
| `RESEND_API_KEY` | Optional — enables password-reset email + private invites | — |
| `RESEND_FROM_EMAIL` | From address for auth emails | `Collectab <noreply@collectab.app>` |
| `OAUTH_GOOGLE_CLIENT_ID` | Optional — enables Google sign-in | — |
| `OAUTH_GOOGLE_CLIENT_SECRET` | Google OAuth client secret | — |
| `RATE_LIMIT_WINDOW_SECONDS` | Rate-limit window | `60` |
| `RATE_LIMIT_MAX` | Max requests per window per IP | `20` |

> **Production**: Always change `BETTER_AUTH_SECRET` and `POSTGRES_PASSWORD` to strong random values.

### Authentication & Roles

- **Self-hosted control**: set `INVITE_MODE=invite-only` to require an invitation before anyone can register. In `open` mode (default), anyone can register but gets the limited `guest` role.
- **Roles** control the bookmark quota: `guest` = 10 bookmarks, `user` = 500, `admin` = unlimited (adjust with `ROLE_QUOTAS`, or set `DISABLE_QUOTAS=true` to remove all limits). To create invites or change roles, set `ADMIN_USER_IDS` to your account's user ID.
- **Create an invite** (from an admin account): `POST /api/admin/invite` with `{ "role": "user" }` — the response contains a shareable link. Invitees sign up themselves and set their own password; no email service required.
- **Email is optional**: without `RESEND_API_KEY`, password-reset links are printed to the server console and private invites fall back to manual link sharing. Set a Resend key to enable email delivery.
- **Google sign-in**: configure the `OAUTH_GOOGLE_*` variables and add the callback URL `<BETTER_AUTH_URL>/api/auth/callback/google` to your Google OAuth app.

---

## Development

### Extension

```bash
cd extension
pnpm install
pnpm dev          # Chrome dev mode with HMR
pnpm dev:firefox  # Firefox dev mode
pnpm build        # Production build
pnpm test         # Run vitest unit tests (CRDT order, transfer flow, drag-back)
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

- **Extension**: WXT + React 19 + Tailwind CSS v4 + Lucide icons
- **Server**: Hono + PostgreSQL + Drizzle ORM + Better Auth
- **Drag & Drop**: @dnd-kit/core + @dnd-kit/sortable
- **Real-time Sync**: Loro CRDT (loro-crdt) + WebSocket
