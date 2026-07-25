# Deploying Howzat

Four managed pieces, all with a usable free tier:

| Piece    | Where               | Why                                                        |
| -------- | ------------------- | ---------------------------------------------------------- |
| Web      | Vercel              | Static Vite build on a CDN                                  |
| API      | Render (Web Service) | Long-lived process — Socket.IO needs a real, held-open TCP connection |
| Postgres | Neon                | Serverless Postgres; Prisma needs the non-pooled URL to migrate |
| Redis    | Upstash             | Socket.IO Redis adapter + OTP/rate-limit state              |

The API cannot go on Vercel: its functions are request-scoped, so a WebSocket
has nothing to stay attached to.

## 0. Prerequisites

A GitHub repo. Both platforms deploy from one.

```bash
git init -b main
git add -A
git commit -m "Howzat"
gh repo create howzat --private --source=. --push
```

`.env` is gitignored and must stay that way — every secret below is entered in
a dashboard, not committed.

## 1. Neon (Postgres)

Create a project, then copy two strings from the dashboard:

- `DATABASE_URL` — the **pooled** string (host contains `-pooler`)
- `DIRECT_URL` — the same host without `-pooler`

Migrations run through `DIRECT_URL`; the pooler cannot execute them.

## 2. Upstash (Redis)

Create a database and copy the TLS URL — it starts with `rediss://`, two `s`.
A plain `redis://` URL connects and then dies, surfacing as
`MaxRetriesPerRequestError` rather than a refusal.

## 3. Render (API)

Blueprint route: **New → Blueprint**, point it at the repo, and `render.yaml`
supplies the build command, start command and health check. Fill in the
`sync: false` variables when prompted. Set `WEB_BASE_URL` to a placeholder for
now — Vercel has not issued a URL yet.

Manual route, if you prefer the dashboard: **New → Web Service**, root
directory blank (the repo root — npm workspaces need it), and

- Build: `npm ci && npm run db:generate --workspace @howzat/api && npm run db:deploy:ci --workspace @howzat/api && npm run build --workspace @howzat/api`
- Start: `node apps/api/dist/index.js`
- Health check path: `/health/live`

Do not set `PORT`. Render injects it, and `env.ts` reads it.

Generate the two JWT secrets locally if you are not using the blueprint:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

The service URL is `https://howzat-api.onrender.com` — that is `API_BASE_URL`.
`GET /health` should return `"postgres": "ok", "redis": "ok"`.

## 4. Vercel (web)

**Add New → Project**, import the repo, leave the root directory at the repo
root. `vercel.json` sets the workspace build command, the output directory and
the SPA rewrite that keeps React Router's deep links from 404ing.

Two environment variables, both needed at **build** time — Vite inlines them
into the bundle, so changing either requires a redeploy, not a restart:

```
VITE_API_BASE_URL=https://howzat-api.onrender.com
VITE_SOCKET_URL=https://howzat-api.onrender.com
```

## 5. Close the loop

Set `WEB_BASE_URL` on Render to the real Vercel URL and let it redeploy. It
feeds three things: the CORS allowlist, the Socket.IO CORS origin, and — via
the hostname comparison in `config/env.ts` — whether the refresh cookie is
issued `SameSite=None; Secure`. Get it wrong and login appears to work until
the first token refresh silently 401s.

## Known behaviours of this setup

- **Render's free tier sleeps after 15 minutes idle.** The next request pays a
  ~50s cold start, and any open socket dropped in the meantime. For a live
  scoring demo, wake the API before showing it, or move to the paid instance.
- **Vercel preview deployments get their own URLs** and are not in the CORS
  allowlist, so only the production URL works end to end. Widen the `origin`
  array in `app.ts` if previews need to function.
- **`db:deploy:ci` runs on every deploy.** It is `prisma migrate deploy`,
  which only applies pending migrations and is safe to repeat.
- **Seeding is manual.** Run it once from a shell with the production
  `DATABASE_URL` exported, if you want demo data.
