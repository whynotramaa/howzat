# Deploying Howzat

| Piece    | Where   | Why                                                                   |
| -------- | ------- | --------------------------------------------------------------------- |
| Web      | Vercel  | Static Vite build on a CDN                                             |
| API      | Railway | Long-lived process — Socket.IO needs a real, held-open TCP connection  |
| Postgres | Railway | Same project, private network, one less dashboard                      |
| Redis    | Railway | Socket.IO Redis adapter + OTP/rate-limit state                         |

The API cannot go on Vercel: its functions are request-scoped, so a WebSocket
has nothing to stay attached to.

Neon and Upstash still work if you prefer them — see the last section.

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

## 1. Railway project + databases

**New Project → Deploy from GitHub repo**, pick the repo. Then in the same
project: **New → Database → PostgreSQL**, and again for **Redis**. Keeping all
three in one project is what lets them talk over the private network.

`railway.json` supplies the build command, start command and health check, so
the service needs no build configuration in the dashboard.

## 2. Environment variables on the API service

Use **reference variables** for the databases rather than pasting URLs — they
follow the database if it is ever recreated:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
DIRECT_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
```

`DIRECT_URL` is the same value here. It exists because Neon's pooler cannot run
migrations; Railway's Postgres has no pooler, so both point at one endpoint.

The rest:

```
NODE_ENV=production
NIXPACKS_NODE_VERSION=22
API_BASE_URL=https://<your-service>.up.railway.app
WEB_BASE_URL=https://<your-app>.vercel.app
JWT_ACCESS_SECRET=<48 random bytes, base64>
JWT_REFRESH_SECRET=<48 random bytes, base64>
RESEND_API_KEY=<from resend.com/api-keys>
OTP_FROM_EMAIL=oct8@rama.codes
```

Generate the secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Do not set `PORT`. Railway injects it and `config/env.ts` reads it.

## 3. Get a public URL

**Settings → Networking → Generate Domain.** A Railway service has no public
address until you ask for one; without it the deploy looks healthy and nothing
can reach it. That domain is `API_BASE_URL`.

Check `GET /health` — it should report `"postgres": "ok", "redis": "ok"`.

## 4. Vercel (web)

**Add New → Project**, import the repo, leave the root directory at the repo
root. `vercel.json` sets the workspace build command, the output directory and
the SPA rewrite that keeps React Router's deep links from 404ing.

Two environment variables, both needed at **build** time — Vite inlines them
into the bundle, so changing either requires a redeploy, not a restart:

```
VITE_API_BASE_URL=https://<your-service>.up.railway.app
VITE_SOCKET_URL=https://<your-service>.up.railway.app
```

## 5. Close the loop

Set `WEB_BASE_URL` on Railway to the real Vercel URL and let it redeploy. It
feeds three things: the CORS allowlist, the Socket.IO CORS origin, and — via
the hostname comparison in `config/env.ts` — whether the refresh cookie is
issued `SameSite=None; Secure`. Get it wrong and login appears to work until
the first token refresh silently 401s.

## Known behaviours of this setup

- **Railway does not sleep**, so live scoring survives an idle gap and there is
  no cold start before a demo. It is not free beyond the trial credit; the API
  plus two databases is a small monthly bill.
- **Private networking is IPv6-only.** `lib/redis.ts` passes `family: 0` to
  ioredis for exactly this reason — the default asks for A records and fails
  with `ENOTFOUND` on a `.railway.internal` host that plainly exists.
- **Railway's internal Redis URL is `redis://`, not `rediss://`.** That is
  correct: the private network is not exposed, so there is no TLS to terminate.
  A public Upstash URL *must* be `rediss://`.
- **Vercel preview deployments get their own URLs** and are not in the CORS
  allowlist, so only the production URL works end to end. Widen the `origin`
  array in `app.ts` if previews need to function.
- **`db:deploy:ci` runs on every deploy.** It is `prisma migrate deploy`, which
  only applies pending migrations and is safe to repeat.
- **Seeding is manual** — `railway run npm run db:seed` once, if you want demo
  data against the production database.

## If you use Neon and Upstash instead

Only the variables change. `DATABASE_URL` is Neon's **pooled** string (host
contains `-pooler`) and `DIRECT_URL` is the same host without it — Prisma
cannot migrate through the pooler. `REDIS_URL` is Upstash's `rediss://` URL;
a plain `redis://` connects and then dies as a confusing
`MaxRetriesPerRequestError`.

`render.yaml` in this repo describes the same API service on Render, kept as a
fallback host. Railway ignores it.
