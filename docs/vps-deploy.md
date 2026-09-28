# Ertaki — VPS deploy runbook

Dockerized production path for the Nest API + Next admin + Postgres behind Caddy.  
Clients (Flutter / admin browser) talk **only** to the API over HTTPS/JSON.

## Prerequisites

- Docker Engine + Compose v2
- A VPS with ports **80/443** open
- DNS A/AAAA for your `DOMAIN` (or use `localhost` for HTTP-only smoke)
- Copy env template: `cp .env.example .env` and set **strong** secrets (leave no placeholders)

Required in `.env` for production:

| Variable | Notes |
|---|---|
| `JWT_SECRET` | ≥32 chars; must not contain `change-me` / documented defaults |
| `POSTGRES_PASSWORD` | not demo `ertaki` / placeholders |
| `DOMAIN` | public hostname for Caddy TLS (or `localhost`) |
| `NEXT_PUBLIC_API_URL` | browser-facing API URL, e.g. `https://your.domain/api` |
| `CORS_ORIGINS` | comma-separated admin origins (required for browser admin in prod) |
| `ACME_EMAIL` | Let's Encrypt contact when `DOMAIN` is public |

Optional:

| Variable | Default | Notes |
|---|---|---|
| `SEED_ON_EMPTY` | `false` | demo accounts; also requires `ALLOW_DEMO_SEED=true` in production |
| `JWT_EXPIRES_IN` | `12h` | access-token TTL |
| `GPG_RECIPIENT` | — | encrypt backups when set |

## Production compose

Services: **postgres + api + admin + caddy**.

- Nest listens inside the network only — **not** published on the host.
- Caddy exposes `:80` / `:443` and reverse-proxies `/api*` → api, everything else → admin.
- Compose healthchecks on postgres, api (`GET /api/health`), and admin.
- `TYPEORM_SYNC` is forced off; schema comes from **real SQL migrations**.

## Local DB modes

| Mode | How | Schema |
|---|---|---|
| **Local SQLite** | `cd api && npm run start:dev` | `synchronize: true` (dev/test only; never prod) |
| **Local Postgres** | `docker compose -f docker-compose.dev.yml up -d` + host Nest | migrations preferred; `TYPEORM_SYNC=true` only for experiments |
| **Production Compose** | `docker compose up -d --build` | Postgres + **TypeORM SQL migrations** (`RUN_MIGRATIONS=true`) |

## Boot production stack

```bash
cp .env.example .env
# set JWT_SECRET, POSTGRES_PASSWORD, DOMAIN, NEXT_PUBLIC_API_URL, CORS_ORIGINS, ACME_EMAIL

docker compose up -d --build
curl -fsS https://$DOMAIN/api/health   # or http://localhost/api/health
```

Health: `GET /api/health` (process + DB ping; expect `{"status":"ok","db":"up"}`).

Demo seed is **off** by default. To allow it on a throwaway VPS only:

```bash
SEED_ON_EMPTY=true ALLOW_DEMO_SEED=true
```

Seed phones use `password123` — rotate or disable immediately.

## Staging overlay

```bash
cp .env.example .env.staging
# separate JWT_SECRET + POSTGRES_PASSWORD + DOMAIN + CORS_ORIGINS

docker compose -f docker-compose.yml -f docker-compose.staging.yml \
  --env-file .env.staging -p ertaki-staging up -d --build
```

## Backups (3-2-1)

```bash
chmod +x deploy/scripts/*.sh
./deploy/scripts/backup-postgres.sh
# → deploy/backups/ertaki-*.sql.gz (+ latest symlink)
# optional: GPG_RECIPIENT=you@example.com ./deploy/scripts/backup-postgres.sh
```

Nightly cron example:

```cron
0 2 * * * cd /opt/ertaki && ./deploy/scripts/backup-postgres.sh >>deploy/backups/backup.log 2>&1
```

Retention defaults to **14 days** (`BACKUP_KEEP_DAYS`). Copy encrypted dumps off-box.

Restore (destructive):

```bash
./deploy/scripts/restore-postgres.sh deploy/backups/ertaki-YYYYMMDDT….sql.gz
```

Prove restore on a disposable Postgres:

```bash
./deploy/scripts/prove-restore.sh
# writes deploy/backups/RESTORE-PROOF.md
```

## Observability

- API emits **structured JSON** HTTP logs via `StructuredLoggingInterceptor`.
- Point an uptime checker (Uptime Kuma, etc.) at `GET /api/health`.
- Docker `restart: unless-stopped` + healthchecks cover process recovery.

## Auth hardening

- Production refuses weak JWT / demo DB passwords and forbids `TYPEORM_SYNC=true`.
- CORS deny-by-default in production unless `CORS_ORIGINS` is set.
- Rate limits: login/register (10/min) and join-requests (20/min).
- JWT access TTL defaults to **12h** (`JWT_EXPIRES_IN`).

## Mobile / APK

| Flavor | Cleartext HTTP | Use |
|---|---|---|
| `lan` | allowed | LAN sideload pilots |
| `prod` | disabled | HTTPS production API |

```bash
cd mobile
flutter build apk --release --flavor lan \
  --dart-define=API_BASE_URL=http://10.0.2.2:43124/api
```

- Tokens: **flutter_secure_storage** on device.
- Sideload artifact: `releases/ertaki-android-release.apk`.

## CI

GitHub Actions: API lint/build/e2e (peer invisibility, immutability, policies, attendance/weekly), admin build, Flutter analyze + tests.

## Related

- Gap analysis: `docs/structure-gap-analysis.md`
- Ship review: `docs/p0-p2-ship-review.md`
- Product map: `workflow.md`
