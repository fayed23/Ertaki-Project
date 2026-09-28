# P0–P2 ship review — critical

**Reviewed:** `c6a90c4` (“Ship P0–P2 VPS production structure and APK 1.0.14”) + `f1bca8f` (post-ship docs) + CI follow-up `71a4888` (green CI).  
**Intent:** Close structure-gap P0–P2 so the stack is VPS-bootable, operable, and lightly hardened — without rewriting product features.

## Verdict

The ship **materially advances** packaging (Compose + Caddy + Dockerfiles + runbook + APK flavors). It does **not** fully deliver what the gap analysis claimed under “migrations,” “domain module split,” or “CI.” Treat **v1.0.14** as a usable first VPS bootstrap with known production debt — not as “portable production complete.”

CI on `main` went **red immediately** after the ship because the new workflow enforced lint/analyze that the P2 controller split left dirty. That is a process failure of the P1 CI item itself.

---

## Correctness vs P0–P2 intent

| Area | Claimed | Reality | Grade |
|---|---|---|---|
| **P0 Docker + Compose + Caddy** | Full stack, Nest not public | Present: postgres/api/admin/caddy; api has no host ports; Caddy routes `/api*` | **Pass** |
| **P0 Migrations** | TypeORM migrations for prod | `InitialSchema` calls `connection.synchronize()` if tables missing — not a real SQL migration. Future entity changes have no reproducible `up`/`down`. | **Fail (core)** |
| **P0 Health** | `/api/health` + DB ping + compose checks | Implemented and covered by e2e | **Pass** |
| **P0 Secrets / throttle** | Strong JWT/DB; rate-limit login/join | Throttles exist. Secret gate existed but **accepted the `.env.example` JWT** (`change-me-to-a-long-random-string-at-least-32-chars`) until the CI follow-up. Demo DB password blocked only for literal `ertaki`. `SEED_ON_EMPTY` defaults **true** with `password123` seed accounts. | **Partial → fixed JWT example** |
| **P1 Backups** | Dump + restore notes | Scripts exist; no scheduled job, no encryption, no off-site automation. Docs describe 3-2-1 aspiration, not shipped practice. | **Partial** |
| **P1 Staging overlay** | Twin compose | Overlay exists; still operator-manual | **Pass (thin)** |
| **P1 Logging / uptime** | Structured logs + health usage | JSON HTTP interceptor + runbook pointer. No alerts/metrics. | **Partial** |
| **P1 CI** | Lint/build/smoke | Workflow added, then failed on unused imports + Flutter warnings. E2e suite is thin (4 tests). | **Fail until follow-up green** |
| **P1 Secure storage / flavors** | Secure token store; lan vs prod HTTPS | `TokenStore` + migration from prefs; `lan`/`prod` cleartext flavors | **Pass** |
| **P1 Sideload signing** | Keep sideload; keystore wiring | Debug-signed release APK + `key.properties.example` | **Pass (pilot)** |
| **P2 Domain split** | Clearer modules | Controllers split; **`domain.service.ts` still ~2500 lines** — the hard part was not split | **Cosmetic** |
| **P2 Audit** | Sensitive ops covered | More audit calls (policies/quota/excuse/notes/deadline/content/group review). Attendance / join accept / daily submit still uneven or absent as first-class audit events. | **Partial** |
| **P2 Admin split** | Route/file split | Helpers extracted; still one large `page.tsx` (~840 lines), no routes | **Partial** |
| **P2 Critical tests** | Peer invisibility / immutability | Present but soft: peer test can no-op if peer seed missing; teacher test only asserts `Array.isArray` | **Thin pass** |

---

## Deploy safety

**What works**
- Compose refuses missing `JWT_SECRET` / `POSTGRES_PASSWORD` via `${VAR:?…}`.
- Nest is internal-only; Caddy terminates TLS when `DOMAIN` is public.
- Entrypoint runs migrations when `RUN_MIGRATIONS=true`.
- Healthchecks on postgres/api/admin.

**Risks**
1. **Fake migration** — first boot `synchronize()` can diverge from later entity metadata; production schema drift is likely the first real upgrade pain.
2. **Example secrets** — until follow-up, copying `.env.example` verbatim could boot “production.” JWT example now rejected; still require operators to rotate seed passwords immediately.
3. **CORS `origin: true` + credentials** — any origin allowed behind the proxy; fine for early VPS, wrong for a hardened public API.
4. **Backup script** — uses `docker compose exec` from the host; no retention policy, no encryption, `DATABASE_URL` branch still dumps via compose postgres (URL is unused for connection). Easy to think backups are “done.”
5. **Admin image** copies full `node_modules` into runner (not a slim Next standalone). Works; image size/attack surface larger than necessary.
6. **No migration dry-run / rollback drill** in CI or runbook beyond `down()` DROP TABLE list.

---

## Auth / API boundary

- Clients still talk HTTP JSON to Nest only — **boundary preserved**.
- JWT + bcrypt SoR preserved; login/register/join throttled.
- Gaps that remain intentional or deferred: 7-day JWT with no refresh/rotation; admin token in `localStorage`; web Flutter still prefs-backed; no certificate pinning.
- `GET /groups/:id` is authenticated but not clearly membership-scoped in the controller (enrichment available to any logged-in role). Review as authorization tightness, not a new ship regression.

---

## Regressions / process

- **CI red on ship commit** — P2 copied fat import blocks into new controllers; eslint `--fix` failed. Mobile had two analyzer **warnings** (`unnecessary_non_null_assertion`, `unnecessary_cast`) which fail `--no-fatal-infos`. Admin job was green.
- **Gap analysis marked “Applied”** for items that are only partially true (migrations, domain split, CI). Status docs overstate completeness.
- Product behavior appears preserved; APK 1.0.14 is lan/debug-signed as before.

---

## Must-fix (before treating VPS as “real”)

1. **Replace `synchronize()` bootstrap with a real InitialSchema SQL migration** (generated or hand-written) and a workflow that forbids silent sync in prod.
2. **Keep CI green on `main`** — lint/build/e2e/analyze must gate every push (this follow-up).
3. **Reject documented placeholder secrets** (JWT example / `change-me*`) — done in CI follow-up; extend to other placeholders if added.
4. **Disable or force-off `SEED_ON_EMPTY` for public VPS** (or require an explicit `ALLOW_DEMO_SEED=true`).
5. **Tighten CORS** to known admin/mobile origins in production.
6. **Prove restore once** on a clean machine; document the timestamped evidence.

## Nice-to-have (next)

- Split `DomainService` into groups/reports/attendance/policies services (actual P2).
- Admin App Router routes instead of one page.
- Expand e2e: join review, attendance audit, policy thresholds, refresh/expiry behavior.
- Nightly cron + encrypted off-site backup; image slim Next `output: 'standalone'`.
- Refresh tokens or shorter JWT TTL; store release signing when leaving sideload.
- Alerting on health failure (Uptime Kuma / equivalent).

---

## Bottom line

Ship **unlocked** `docker compose up` behind Caddy with healthchecks, rate limits, secure mobile tokens, and a runbook — that is real P0 progress. It **over-claimed** migrations, domain modularity, and CI readiness. Do not schedule a second VPS “production cutover” until real migrations and green CI are boringly true.

**APK:** no rebuild in the CI follow-up (lint/analyzer/secret-gate only; no product UX change).

---

## Follow-up completion (this delivery)

Must-fixes and nice-to-haves from this review were implemented on `main`:

- Real SQL `InitialSchema` migration (no synchronize bootstrap); prod forbids `TYPEORM_SYNC`
- `SEED_ON_EMPTY` default false + `ALLOW_DEMO_SEED` gate; CORS allow-list; JWT TTL 12h
- Backup retention + optional GPG; `prove-restore.sh` evidence in `deploy/backups/RESTORE-PROOF.md`
- Domain **services** split (`DomainContext` + groups/reports/attendance/policies/notifications/dashboards)
- Stronger e2e; peer daily-report probe returns 403; admin joins panel + App Router routes; Next standalone image
- APK **1.0.15+15**
