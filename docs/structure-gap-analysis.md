# Ertaki — Structure Gap Analysis

## Applied (P0–P2) — 2026-09-28 (completed follow-up)

All P0 / P1 / P2 items are implemented on `main`, including review must-fixes:

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Dockerfiles + Compose + Caddy + `.env.example` | **Applied** | `docker-compose.yml`, Dockerfiles |
| 2 | Caddy TLS; Nest not public | **Applied** | `deploy/Caddyfile` |
| 3 | **Real** TypeORM SQL migrations (no synchronize bootstrap) | **Applied** | `api/src/migrations/1730000000000-InitialSchema.ts` |
| 4 | Health + healthchecks | **Applied** | `api/src/health/` |
| 5 | Strong secrets; seed gated; CORS allow-list; JWT 12h | **Applied** | `production-secrets.ts`, compose env |
| 6 | Backup + retention + optional GPG + restore proof | **Applied** | `deploy/scripts/*`, `RESTORE-PROOF.md` |
| 7 | Staging overlay | **Applied** | `docker-compose.staging.yml` |
| 8 | Structured logging + uptime notes | **Applied** | interceptor + runbook |
| 9 | CI green (lint/build/e2e/analyze) | **Applied** | `.github/workflows/ci.yml` |
| 10 | Secure storage + lan/prod flavors | **Applied** | `token_store.dart`, flavors |
| 11 | Sideload APK + keystore wiring | **Applied** | `releases/`, `key.properties.example` |
| 12 | Domain **service** split (not only controllers) | **Applied** | `domain-context` + groups/reports/attendance/policies/notifications/dashboards services |
| 13 | Audit on sensitive ops (incl. daily submit / join / attendance) | **Applied** | `auditLog` calls |
| 14 | Admin routes + joins panel + Next standalone image | **Applied** | `admin/src/app/(console)/*`, standalone Dockerfile |
| 15 | Stronger e2e (peer 403, policies, attendance/weekly) | **Applied** | `api/test/app.e2e-spec.ts` |

Runbook: `docs/vps-deploy.md`. Critical review: `docs/p0-p2-ship-review.md`.

---

## 1. Verdict

**Partially.** The repo followed the guide’s **product stack and trust model** (Flutter + NestJS + Next.js + JWT/bcrypt; clients talk only to the API; SQLite local / Postgres optional). It did **not** follow the guide’s **production / portable deploy structure**.

Today this is a **working self-hosted MVP / LAN-sideload platform**, not a VPS-ready portable production layout. Missing or incomplete vs the guide + user target: Dockerized API+admin+proxy, migrations, healthchecks, reverse proxy/TLS, backups, observability, CI, multi-env, and hardened secrets/token storage.

The guide itself frames current reality as “working MVP… treat this guide as the **professional restructure target**” — that framing matches what is in the tree.

---

## 2. Current architecture snapshot

| Layer | What exists today |
|---|---|
| **Mobile** | Flutter app (`mobile/`) — Android / iOS / web; roles student / teacher / supervisor; RTL Arabic; `ApiClient` + `AppConfig` (`API_BASE_URL` dart-define + in-app override in SharedPreferences); sideload APK under `releases/` (debug-signed). Cleartext HTTP allowed (`usesCleartextTraffic=true`). Tokens in SharedPreferences, not secure storage. |
| **API** | NestJS modular-monolith shape (`api/src/{auth,domain,entities,common,seed}`); global prefix `/api`; CORS open; binds `0.0.0.0`. Domain logic largely one fat `DomainController` + `DomainService`. JWT (7d) + bcrypt cost 10; `@Exclude()` on `passwordHash`. Cron reminders via `@nestjs/schedule`. Optional FCM via `FCM_SERVER_KEY`. |
| **Admin** | Next.js RTL supervisor UI (`admin/`) — single client page; `NEXT_PUBLIC_API_URL` → Bearer calls to Nest only. Token in `localStorage`. Port `43123`. |
| **DB** | Default **SQLite** (`better-sqlite3`, `synchronize: true`). Optional Postgres via root `docker-compose.yml` (Postgres **only**) + `DB_TYPE=postgres` + `TYPEORM_SYNC=true`. No TypeORM migration files / migration workflow. Entities cover the guide’s core domain (users, groups, memberships with `joinedAt`/`leftAt`, joins, daily/weekly reports, attendance, excuses, notes, quotas, infractions/policies, deadline config, notifications, device tokens, program content, audit log). |
| **Auth** | Self-hosted JWT + bcrypt — correct model for VPS (no Auth0/Firebase as system of record). Weak default `JWT_SECRET` (`ertaki-dev-secret-change-me`). No refresh tokens. No login/join rate limits. Register limited to student/teacher; supervisor seeded. |
| **Deploy** | Documented local/LAN runbooks in README. **No** API/admin Dockerfiles. Compose = Postgres only (hardcoded `ertaki/ertaki`). **No** Caddy/Nginx, TLS, health endpoint, backup scripts, staging/prod overlays, or CI (`.github` absent). |

**API boundary (important):** Mobile and admin use HTTP JSON to Nest only. No DB credentials or direct SQLite/Postgres access from clients. That matches Part 1.3 of the guide and the user’s “clients talk only via APIs” intent.

**Local ports (as documented):** API `:43124/api`, admin `:43123`, Flutter web `:43125`.

---

## 3. Gap list vs guide + user target (prioritized)

### P0 — Blockers for “deploy anywhere / VPS Dockerized backend”

| Gap | Guide / target expectation | Current state |
|---|---|---|
| **Dockerized backend stack** | Level 18 / blueprint: Compose with API + Postgres (+ admin) suitable for VPS | Compose runs **Postgres only**. No `Dockerfile` for Nest or Next. Cannot `docker compose up` a full backend. |
| **Reverse proxy + HTTPS** | Caddy/Nginx TLS in front of Nest (+ admin) | None. Clients hit Nest/Next ports directly; prod HTTPS not wired. |
| **Schema migrations** | Level 3/rebuild: migrations documented for Postgres (and SQLite path) | `synchronize: true` always on SQLite; Postgres only if `TYPEORM_SYNC=true`. Unsafe / non-reproducible for prod schema evolution. |
| **Secrets / env for deploy** | Never commit secrets; strong `JWT_SECRET`; inject via env | Defaults bake weak JWT + compose DB password `ertaki`. `.env` gitignored but no `.env.example` / prod secret contract. Seed password `password123` documented (fine for demo, not prod). |
| **Healthchecks** | Level 2 / ops checklist: health + process restart | No dedicated `GET /api` (or `/health`) probe. Compose has no healthchecks. |
| **Auth hardening for shared deploy** | Rate-limit login/join; assume hostile client | No throttling. JWT long-lived (7d), no rotation/refresh story. Fine for LAN MVP; weak for public VPS. |

### P1 — Required soon for portable production credibility

| Gap | Guide / target | Current |
|---|---|---|
| **Backups 3-2-1** | Level 19; nightly encrypted off-site dump + restore drill | No backup scripts, schedule, or restore runbook in repo. |
| **Multi-env** | Local / LAN / staging / production table | Env vars exist ad hoc; no staging compose, separate JWT secrets, or deploy promotion path. |
| **Observability** | Level 20: structured logs, uptime, error alerts | Console logs only; no metrics/alerts. |
| **CI pipeline** | Part 6.4 / Level 21 | No GitHub Actions (or other CI). Lint/test/build/deploy gates are manual. |
| **Product correctness tests** | Checklist: peer invisibility, no-edit-after-submit, reminder≠infraction, policy-driven thresholds | One thin auth e2e smoke; one Flutter widget test. Domain rules largely unguarded by automation. |
| **Mobile token storage** | Level 7: platform-secure storage | JWT in SharedPreferences (and admin `localStorage`). Guide explicitly marks secure storage as harden step. |
| **Prod Android networking** | HTTPS in prod; cleartext only for LAN | `usesCleartextTraffic=true` globally — OK for pilots, wrong default for store/VPS HTTPS builds. |
| **Play/App Store signing** | Level 22; replace debug signing | Release APK is **debug-signed** by design for sideload — correct for pilots, not for stores. |

### P2 — Structure / quality debt (align later, not ship-blockers for first VPS)

| Gap | Notes |
|---|---|
| **Domain module split** | Guide shows modular folders; reality is one large `domain.service.ts` / controller. Still a modular monolith, but hard to test and evolve. |
| **Audit coverage** | `AuditLog` entity + some writes exist; not clearly applied to all sensitive ops (e.g. every policy/attendance change) per Part 8.1. |
| **Admin app structure** | Single ~1k-line client page vs multi-route Next app — works; splits later for maintainability. |
| **Redis / object storage** | Guide: optional, phase 2+. Correctly absent. |
| **Certificate pinning** | Optional later — not a gap yet. |
| **Load test / DR drill** | Levels 23–24 — after first stable VPS deploy. |
| **FCM full wiring** | Optional key path exists; full Firebase project still deferred (acceptable per guide). |

---

## 4. What already aligns

- **Stack lock-in matches guide:** Flutter + NestJS + TypeORM + Next.js + SQLite/Postgres + JWT/bcrypt + optional FCM — not Firebase/Auth0 as system of record, not Expo/RN, not microservices/K8s.
- **Trust boundary:** Phone and admin never talk to the DB; all business truth via REST/JSON + server-side guards (`JwtAuthGuard` + `RolesGuard` + domain checks).
- **Domain model footprint:** Core entities from Part 3.2 are present, including membership history (`joinedAt` / `leftAt`) and admin-configurable `InfractionPolicy`.
- **Illustrative API surface:** Auth, groups, joins, memberships, daily/weekly reports, attendance, excuses, notes, infractions/policies, quotas, deadline config, notifications, device tokens, teacher/supervisor dashboards — largely implemented.
- **Product rules foothold:** Staff-only peer report visibility direction, no-edit-after-submit intent, reminders without clock-only auto-infraction, per-student quota, supervisor dual surface (Flutter + Next).
- **Configurable API URL:** dart-define + in-app override — required for real phones / any deploy host.
- **Local Postgres option:** Compose Postgres service exists as a stepping stone toward Level 3 (DB only, not full stack).
- **Arabic/RTL:** Flutter Directionality + Amiri/Cairo; admin `lang="ar"` `dir="rtl"`.
- **Portability principle (Part 0):** Self-hostable, unlimited-user economics, swappable VPS — architecture *direction* is right; packaging for that direction is the gap.
- **Curriculum Levels ~1–17 (product MVP):** Substantial foothold. Gaps concentrate in **Levels 18–24** (Docker prod-like, backups, observability, CI, store signing, load/DR).

---

## 5. Recommended phased path (do not implement here)

Ordered for the user’s target (real app + API-only clients + Docker/VPS + suitable auth) without boiling the ocean.

### Phase A — Make the backend VPS-bootable (P0)
1. Add Dockerfiles for **API** and **admin**; extend Compose to `postgres + api + admin` with env files (no committed secrets).
2. Add **Caddy or Nginx** service: TLS termination, route `api.*` → Nest, admin host → Next; internal-only Nest port.
3. Replace `synchronize` in prod with **TypeORM migrations**; keep SQLite+sync for local-only if desired, but document the split.
4. Add **`GET /api/health`** (process + DB ping); wire Compose/systemd restart + healthchecks.
5. Require strong `JWT_SECRET` / DB password when `NODE_ENV=production`; ship `.env.example`; rate-limit `/auth/login` and join endpoints.

### Phase B — Operability (P1)
6. Nightly encrypted Postgres dump + off-site copy; one documented restore test.
7. Staging Compose/env twin (separate JWT secret, anonymized data).
8. Structured logging + uptime check + basic error alert.
9. CI: lint + API e2e smoke (peer-report / immutability gates) + admin build + `flutter analyze`.

### Phase C — Client harden for “real” distribution (P1/P2)
10. Flutter secure storage for tokens; production builds HTTPS-only (cleartext flavor for LAN pilots only).
11. Proper Android/iOS release signing when moving beyond sideload.
12. Split Nest domain modules and admin routes as needed; expand audit + automated policy tests.

### Phase D — Later curriculum
13. Load test report submit; DR “VPS gone” drill; phase-2 backlog (messaging, exports, object storage) only with evidence.

**Do not** start with Kubernetes, Redis, or BaaS rewrites — the guide and current stack already reject those for this stage.

---

## Summary line

Ertaki **already looks like the guide’s modular-monolith product**; it **does not yet ship as the guide’s portable production platform**. Closing the gap is mostly **packaging, migrations, proxy/TLS, secrets, health, backups, CI, and auth harden** — not a rewrite of Flutter/Nest/Next or abandoning the API boundary.
