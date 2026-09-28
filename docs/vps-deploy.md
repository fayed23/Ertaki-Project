# Ertaki — VPS deploy runbook

Dockerized production path for the Nest API + Next admin + Postgres behind Caddy.  
Clients (Flutter / admin browser) talk **only** to the API over HTTPS/JSON.

## Prerequisites

- Docker Engine + Compose v2
- A VPS with ports **80/443** open
- DNS A/AAAA for your `DOMAIN` (or use `localhost` for HTTP-only smoke)
- Copy env template: `cp .env.example .env` and set **strong** secrets

Required in `.env` for production:

| Variable | Notes |
|---|---|
| `JWT_SECRET` | ≥32 chars; not a documented default |
| `POSTGRES_PASSWORD` | not the demo `ertaki` |
| `DOMAIN` | public hostname for Caddy TLS (or `localhost`) |
| `NEXT_PUBLIC_API_URL` | browser-facing API URL, e.g. `https://your.domain/api` |
| `ACME_EMAIL` | Let's Encrypt contact when `DOMAIN` is public |

## Production compose

Services: **postgres + api + admin + caddy**.

- Nest listens inside the network only — **not** published on the host.
- Caddy exposes `:80` / `:443` and reverse-proxies `/api*` → api, everything else → admin.
- Compose healthchecks on postgres, api (`GET /api/health`), and admin.

## Local DB modes

| Mode | How | Schema |
|---|---|---|
| **Local SQLite** | `cd api && npm run start:dev` | `synchronize: true` (dev only) |
| **Local Postgres** | `docker compose -f docker-compose.dev.yml up -d` + host Nest with `DB_TYPE=postgres` | set `TYPEORM_SYNC=true` for experiments, or run migrations |
| **Production Compose** | `docker compose up -d --build` | Postgres + **TypeORM migrations** (`RUN_MIGRATIONS=true`, `TYPEORM_SYNC=false`) |

## Boot production stack

```bash
cp .env.example .env
# edit JWT_SECRET, POSTGRES_PASSWORD, DOMAIN, NEXT_PUBLIC_API_URL, ACME_EMAIL

docker compose up -d --build
curl -fsS https://$DOMAIN/api/health   # or http://localhost/api/health
```

Health: `GET /api/health` (process + DB ping; expect `{"status":"ok","db":"up"}`).

Seed accounts (if `SEED_ON_EMPTY=true` and DB empty): supervisor `0500000001` / `password123` — **change immediately** on a real VPS.

## Staging overlay

```bash
cp .env.example .env.staging
# separate JWT_SECRET + POSTGRES_PASSWORD + DOMAIN

docker compose -f docker-compose.yml -f docker-compose.staging.yml \
  --env-file .env.staging -p ertaki-staging up -d --build
```

Uses separate volumes (`ertaki_pg_staging`) and project name so staging does not share prod data.

## Backups (3-2-1)

Scripts live under `deploy/scripts/`:

```bash
chmod +x deploy/scripts/*.sh
./deploy/scripts/backup-postgres.sh
# → deploy/backups/ertaki-*.sql.gz (+ ertaki-latest.sql.gz symlink)
```

Restore (destructive):

```bash
./deploy/scripts/restore-postgres.sh deploy/backups/ertaki-YYYYMMDDT….sql.gz
docker compose restart api
```

Encrypt and copy dumps **off-box** (object storage / another region). Practice restore on a clean machine periodically.

## Observability

- API emits **structured JSON** HTTP logs (method, path, status, ms, userId) via `StructuredLoggingInterceptor`.
- Point an uptime checker at `GET /api/health`.
- Docker `restart: unless-stopped` + healthchecks cover basic process recovery.

## Auth hardening (shipped)

- Production refuses weak `JWT_SECRET` / demo DB password (`api/src/common/production-secrets.ts`).
- Rate limits: login/register (10/min) and join-requests (20/min); global throttle otherwise.
- JWT + bcrypt remain the system of record (no Auth0/Firebase).

## Mobile / APK

| Flavor | Cleartext HTTP | Use |
|---|---|---|
| `lan` | allowed | LAN sideload pilots |
| `prod` | disabled | HTTPS production API |

```bash
cd mobile
flutter build apk --release --flavor lan \
  --dart-define=API_BASE_URL=http://10.0.2.2:43124/api
# or --flavor prod --dart-define=API_BASE_URL=https://api.example.com/api
```

- Tokens: **flutter_secure_storage** on device (SharedPreferences on web) — see `mobile/lib/token_store.dart`.
- Sideload artifact: `releases/ertaki-android-release.apk` (lan-flavor, debug-signed by default).
- Store signing: copy `mobile/android/key.properties.example` → `mobile/android/key.properties` (gitignored) with your upload keystore.

## CI

GitHub Actions (`.github/workflows/ci.yml`): API lint/build/e2e, admin build, `flutter analyze` + tests.

## Related

- Portable production curriculum: `docs/ertaki-portable-production-guide.md`
- Gap analysis (P0–P2 applied): `docs/structure-gap-analysis.md`
- Product map: `workflow.md`
