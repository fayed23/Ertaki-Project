# Ertaki (ارتق) — Portable Production & Rebuild Guide

### Curriculum, architecture, and operations for a Quran-program tracking platform  
**Flutter (Android + iOS) · NestJS API · Next.js supervisor admin · PostgreSQL / SQLite**

> Adapted from a general portable mobile-platform curriculum. Reshaped for **ارتق**: multi-role Quran memorization tracking (student / teacher / supervisor), structured daily reports, مجلس التسميع attendance, تقصير policies, and self-hosted unlimited-user economics.  
> Product truth sources: `docs/requirements.md`, `docs/decisions.md`, `docs/mvp-plan.md`. When anything conflicts, **locked decisions win**.

**How to use this document**

1. **Parts 0–6** — principles and target architecture (read once before a professional rebuild).  
2. **Part 7** — phased curriculum (rebuild / harden levels).  
3. **Parts 8–10** — production checklist, failure playbook, one-page blueprint.  
4. **Repo reality** today: working MVP in this monorepo; treat this guide as the **professional restructure target**, not a list of current bugs.

---

# PART 0 — CORE PRINCIPLE: CONTROL AND PORTABILITY

> Pay for infrastructure when necessary. Never make the architecture depend on a vendor’s proprietary platform when an open, swappable alternative does the same job.

| Kind | Meaning | Ertaki choice |
|---|---|---|
| **Free software** | Run anywhere | Flutter, NestJS, Next.js, PostgreSQL, SQLite, TypeORM, Caddy/Nginx |
| **Free tier** | Limited vendor usage | Avoid as the *only* path (Auth0/Firebase quotas push rewrites) |
| **Paid infrastructure** | Commodity VPS / bandwidth | Acceptable and swappable |
| **Unavoidable platform cost** | Store gatekeepers | Apple Developer (~$99/yr), Google Play (~$25 one-time) |
| **Vendor lock-in** | Rewrite to leave | Proprietary BaaS user models, closed DB formats |

**Exit strategy (ask for every dependency):** What data do you own? How do you export it? Can you self-host a replacement? How many LOC change if you switch? Prepare exports and IaC **now**.

**Unlimited users:** Ertaki has no seat license. Scale cost is **your** VPS/DB, not a SaaS per-user meter.

---

# PART 1 — THE COMPLETE SYSTEM (ERTAKI)

## 1.1 Target architecture

```
                         INTERNET
                            |
                           DNS  (api.ertaki.example → VPS)
                            |
                          HTTPS (TLS)
                            |
         +------------------+------------------+
         |                  |                  |
         v                  v                  v
   Flutter Android    Flutter iOS      Next.js Admin (RTL)
   (student/teacher/  (same codebase)  (supervisor / admin)
    supervisor)
         |                  |                  |
         +------------------+------------------+
                            |
                     HTTPS / JSON REST
                            |
                      Reverse proxy
                      (Caddy / Nginx)
                            |
                       NestJS API
                    (modular monolith)
                            |
              +-------------+-------------+
              |             |             |
              v             v             v
         PostgreSQL      (optional)    Object storage*
         system of       Redis queue   (program videos,
         record          / cache*      exports — phase 2+)
              |
           Backups (3-2-1, encrypted, off-site)

* Add only when justified — MVP runs without Redis/object storage.
```

**Local / try-live defaults in this repo:** API `:43124/api`, admin `:43123`, Flutter web `:43125`, SQLite file for zero-secret boot; Postgres via `docker-compose` when ready.

## 1.2 What each component owns

| Component | Owns | Must not own |
|---|---|---|
| **Flutter app** | UI, local prefs (API URL, tokens), local notification scheduling | Business truth, peer report visibility, policy thresholds |
| **Next.js admin** | Supervisor workflows (joins, groups, policies, metrics) | Alternate copy of business rules |
| **NestJS API** | AuthN/AuthZ, validation, quotas, reports, attendance, تقصير engine hooks, audit, notification records | Secrets in client binaries |
| **PostgreSQL** | Users, memberships, reports, attendance, notes, infractions, policies | Files/blobs (use object storage later) |

## 1.3 Why the phone never talks to PostgreSQL

A mobile binary is untrusted. DB credentials in the APK equal a public database. The API is the **trust boundary**: authentication, authorization (per request), validation, transactions, rate limits, audit, and safe error shapes.

## 1.4 Anatomy of one request — “Student submits التقرير اليومي”

1. Student completes the single-screen daily report (حفظ + times, مراجعة + times, تكرار 50 / مجلس واحد, تفسير) and taps sticky submit.  
2. Flutter `POST /api/daily-reports` with `Authorization: Bearer <JWT>`.  
3. Nest validates role=`student`, rejects if a report for that date already exists (**no edit after submit**).  
4. Persists structured fields; evaluates **content** infractions (e.g. missed quota / missed 50 reps) via `InfractionPolicy` — **not** “late by clock” auto-infractions.  
5. Creates notification stubs for group teacher + supervisors (`daily_report_submitted`); FCM if `FCM_SERVER_KEY` set.  
6. Student local deadline reminder cancelled.  
7. Teacher/supervisor see report only on staff surfaces — **students never see peers’ reports or submit status**.

---

# PART 2 — TECHNOLOGY DECISIONS (LOCKED TO REPO REALITY)

## 2.1 Stack (do not re-litigate unless decisions.md changes)

| Layer | Choice | Why |
|---|---|---|
| Mobile | **Flutter** | One codebase Android+iOS, mature RTL/Arabic, free, no user cap |
| Supervisor web | **Next.js + Tailwind** | RTL admin, same language family as API |
| API | **NestJS + TypeORM** | Modules, guards, JWT, clear domain boundaries |
| DB | **SQLite (dev)** / **PostgreSQL (prod)** | Zero-secret local; open-source unlimited users in prod |
| Auth | **JWT + bcrypt** | Self-hosted; no Auth0/Firebase free-tier ceiling |
| Push | In-app + optional **FCM** (`FCM_SERVER_KEY`) | Ship without blocking on Firebase; enable later |
| Sideload | `releases/ertaki-android-release.apk` | Debug-signed release for phone tests; Play signing later |

**Not chosen for MVP core:** React Native/Expo (curriculum source default), Firebase/Supabase as system of record, microservices, Kubernetes.

## 2.2 Modular monolith modules (target layout)

```
api/src/
  auth/           login, JWT, password hashing
  domain/         groups, memberships, joins, reports, attendance,
                  notes, quotas, infractions, policies, deadlines,
                  notifications, push, reminders, dashboards
  entities/       TypeORM entities (source of truth schema)
  common/         roles guard, enums, decorators
  seed/           deterministic demo accounts
```

Flutter:

```
mobile/lib/
  api.dart / AppConfig     API_BASE_URL + in-app override
  gate.dart                login (all roles)
  shell.dart               role-based bottom nav
  student_screens.dart
  teacher_screens.dart
  supervisor_screens.dart
  notify.dart              local schedule + inbox poll
```

Admin: Next.js single RTL app for supervisor dashboards, joins, groups, policies.

## 2.3 Start as a modular monolith

One Nest deploy, clear module boundaries, shared DB. Split services only when a measured bottleneck or team boundary demands it — not before.

---

# PART 3 — DOMAIN MODEL & LOCKED PRODUCT RULES

## 3.1 Roles

| Role | Primary surface | Core powers |
|---|---|---|
| `student` | Flutter | Join request, daily report, weekly confirm, excuse request, progress, notes inbox |
| `teacher` | Flutter | Group priorities, student file, attendance, notes (internal/visible), notifications |
| `supervisor` / `admin` | Flutter **and** Next admin | Joins, groups, policies, program-wide metrics; same account both surfaces |

## 3.2 Core entities (rebuild checklist)

- **User** — role, status (new / pending_group / active / paused / withdrawn / suspended / completed), profile, current memorization  
- **Group** — teacher, gender, seats, مجلس day/time, status, `whatsappUrl`  
- **GroupMembership** — `joinedAt` / `leftAt` / reason (history over time; no fixed “groupId” only on user)  
- **JoinRequest** — pending / accepted / rejected / cancelled  
- **DailyReport** — structured fields only; unique (student, date); immutable after submit  
- **ReportDeadlineConfig** — timezone, closeTimeLocal, reminderMinutesBefore, enabled  
- **WeeklyReport** — generated from daily + attendance; `studentConfirmedAt`  
- **Attendance** — present / excused / unexcused (+ optional late / left early)  
- **AbsenceExcuseRequest** — student → staff review  
- **StudentNote** — internal vs student_visible  
- **Infraction** + **InfractionPolicy** — types from content/attendance; thresholds/actions **admin-configurable only**  
- **StudentQuota** — القسط اليومي per student  
- **NotificationStub** / device tokens — inbox + optional FCM  
- **ProgramContent** — intro / rules editable without app store release  
- **AuditLog** — actor, action, before/after for sensitive ops  

## 3.3 Locked decisions (non-negotiable)

| # | Rule |
|---|---|
| 1 | Daily reports: **staff only** — no peer visibility, not even “submitted yes/no” |
| 2 | **No edit** after submit |
| 3 | **Reminders** near midnight if missing report; **no auto-infraction** solely because the clock passed |
| 4 | القسط **per student** |
| 5 | Staff notified on report submit, excuse submit, excused/unexcused absence |
| 6 | تقصير consequences from **InfractionPolicy** config — never hardcode warn/freeze/remove thresholds in app logic |
| 7 | Group change requires **supervisor** approval |
| 8 | Stage-1 WhatsApp = **external group link** only |

## 3.4 Illustrative API surface (REST/JSON)

```
POST   /auth/login | /auth/register
GET    /auth/me
GET|POST /groups , GET /groups/:id
POST   /join-requests , GET /join-requests , PATCH /join-requests/:id
GET    /memberships/me , POST /memberships/change-group
POST|GET /daily-reports
POST   /weekly-reports/generate , PATCH /weekly-reports/:id/confirm , GET /weekly-reports
POST|GET /attendance
POST|GET|PATCH /excuse-requests
POST|GET /notes
GET|POST /infractions , GET|POST /infraction-policies
GET|POST /quotas
GET|POST /report-deadline-config
GET    /notifications
POST   /device-tokens , POST /device-tokens/unregister
GET    /dashboards/teacher , /dashboards/supervisor
```

Authorization is enforced **server-side on every call** (Nest guards + domain checks). Never trust Flutter role flags alone.

---

# PART 4 — AUTH, SECURITY, ARABIC/RTL

## 4.1 AuthN / AuthZ

- bcrypt password hashes; JWT access tokens; `@Exclude()` on `passwordHash`.  
- Roles guard on routes; finer checks inside services (e.g. teacher only their groups’ students).  
- Assume the client is hostile: forged roles, replayed tokens, tampered report bodies.

## 4.2 Mobile security checklist

- No secrets in the APK beyond public API URL defaults.  
- Persist tokens in platform-secure storage when you harden beyond SharedPreferences.  
- Certificate pinning optional later; always HTTPS in production.  
- Cleartext HTTP allowed **only** for LAN sideload testing (`usesCleartextTraffic`).  
- Configurable `API_BASE_URL` (dart-define + in-app) so phones never depend on `127.0.0.1`.

## 4.3 Arabic / RTL

- Flutter: `flutter_localizations`, root `Directionality.rtl`, Amiri for brand «ارتق», Cairo for UI.  
- Next admin: `lang="ar"` `dir="rtl"`, Arabic-first copy.  
- API: Arabic user-facing error messages; English technical field names.

---

# PART 5 — NOTIFICATIONS, REMINDERS, FILES

## 5.1 Notifications (current design)

| Event | Recipients |
|---|---|
| Near midnight, no daily report | Student (reminder) |
| Daily report submitted | Teacher + supervisors |
| Excuse submitted | Teacher + supervisors |
| Absence excused / unexcused | Teacher + supervisors (+ student) |

Pipeline: write `notification_stubs` → optional FCM if `FCM_SERVER_KEY` → Flutter polls inbox / schedules local reminders.

## 5.2 Deadline reminders vs infractions

- Cron (Nest `@nestjs/schedule`) honors `ReportDeadlineConfig` (e.g. Africa/Algiers, 23:59, −60m and −15m).  
- Reminder ≠ تقصير. Clock-based missing-report infractions stay **off** until product explicitly enables them.

## 5.3 Files / media

MVP: WhatsApp deep links + external video URLs in `ProgramContent`.  
Phase 2+: S3-compatible object storage for uploads/exports — not DB BYTEA.

## 5.4 Offline

Don’t over-engineer: optimistic UI optional; source of truth remains API. Queue local drafts only if you later require airplane-mode report capture — still submit once online, still enforce no-edit-after-submit server-side.

---

# PART 6 — ENVIRONMENTS, SECRETS, RELEASES

## 6.1 Environments

| Env | DB | API URL | Notes |
|---|---|---|---|
| Local | SQLite | `http://127.0.0.1:43124/api` | Seeds; no cloud keys |
| LAN phone test | SQLite/Postgres on PC | `http://PC_LAN_IP:43124/api` | Bind API `0.0.0.0`; set in-app URL |
| Staging | Postgres | `https://api-staging…` | Separate JWT secret, copy of anonymized data |
| Production | Postgres | `https://api…` | Backups, monitoring, HTTPS only |

## 6.2 Secrets (never commit)

`JWT_SECRET`, `DATABASE_URL`, `FCM_SERVER_KEY`, store signing keys, TLS material. Inject via env / secret manager. Rotate JWT secret = force re-login.

## 6.3 Mobile releases

- **Sideload:** `releases/ertaki-android-release.apk` (release build, debug-signed for testing).  
- **Play / App Store:** create proper release keystores; bump `versionCode` / `versionName`; map store privacy questionnaires.  
- Document `API_BASE_URL` bake-in vs in-app override in every release note.

## 6.4 CI (target)

```
PR → lint (ESLint / dart analyze) → api unit/e2e smoke → admin build →
     flutter analyze + widget tests → (optional) APK artifact upload
main → deploy API+admin to staging → manual smoke → promote production
```

Keep mobile store submit manual until Level 20+ of the curriculum.

---

# PART 7 — CURRICULUM: REBUILD / HARDEN LEVELS

Use these as a **professional restructure track**. Many levels already have an MVP foothold in-repo — re-do them cleanly with tests and migrations when you “rebuild professionally.”

| Level | Goal | Done when |
|---|---|---|
| **1** | Flutter shell, RTL, gate login, `AppConfig` API URL | All three roles can authenticate against a configurable base URL |
| **2** | Nest modular skeleton, health, config | `GET /api` health; env-based config; no hardcoded secrets |
| **3** | Postgres locally (Docker) + SQLite fallback | Schema sync/migrations documented for both |
| **4** | TypeORM entities = domain model above | Membership history works; no denormalized-only group on user |
| **5** | Seed users + policies + deadline config | `0500000001/2/3` + password documented |
| **6** | JWT login/register + bcrypt | Password hashes never serialized to clients |
| **7** | Secure token storage on device | Tokens survive restart; logout clears them |
| **8** | RBAC guards + domain authz | Student cannot read peers’ daily reports (automated test) |
| **9** | Groups, joins, WhatsApp link | Supervisor accept/reject; seat counts |
| **10** | Daily report single-screen UX + immutability | Second POST same day → 400; staff notified |
| **11** | Weekly generate + student confirm | Confirm endpoint idempotent |
| **12** | Attendance + excuses | Unexcused creates content-sourced تقصير per policy |
| **13** | Notes internal/visible + quotas per student | Student sees only visible notes |
| **14** | InfractionPolicy admin UI + engine reads config | Changing threshold changes behavior without code deploy |
| **15** | Deadline reminders cron | Reminders fire; **no** clock-only infraction |
| **16** | Notifications inbox + optional FCM | Device token register; staff see events |
| **17** | Next admin parity (joins/groups/policies/metrics) | Same supervisor account as Flutter |
| **18** | Docker Compose prod-like | API + Postgres + Caddy TLS on a VPS |
| **19** | Backups 3-2-1 | Restored DB verified on a clean machine |
| **20** | Observability | Structured logs, uptime check, error rate alert |
| **21** | CI pipeline | Main green required before deploy |
| **22** | Signed Play/App Store builds | Replace debug signing; store listings |
| **23** | Load test report submit + dashboards | Know concurrent-user ceiling of your VPS |
| **24** | DR drill | “VPS gone” restore runbook executed once |
| **25** | Phase-2 backlog triage | Messaging, exports, advanced stats — scheduled, not accidental |

---

# PART 8 — PRODUCTION CHECKLIST

## 8.1 Security

- [ ] HTTPS everywhere in prod; HSTS at proxy  
- [ ] Strong `JWT_SECRET`; bcrypt cost ≥ 10  
- [ ] Rate-limit login and join endpoints  
- [ ] Parameterized queries only (TypeORM)  
- [ ] Audit log on join review, attendance edits, policy changes  
- [ ] No PII in client logs  

## 8.2 Data & backups

- [ ] Nightly encrypted Postgres dump off-site  
- [ ] Restore tested quarterly  
- [ ] Retention policy for withdrawn students  

## 8.3 Operations

- [ ] Separate staging  
- [ ] Health check + process supervisor (systemd/Docker restart)  
- [ ] Disk/CPU alerts  
- [ ] Runbook links in `docs/`  

## 8.4 Product correctness gates (automated tests)

- [ ] Peer report invisibility  
- [ ] No edit after submit  
- [ ] Reminder without auto-infraction  
- [ ] Policy-driven thresholds  

---

# PART 9 — FAILURE PLAYBOOK (SHORT)

| Symptom | Likely layer | First checks |
|---|---|---|
| Phone “network error” | Connectivity | In-app API URL; PC firewall; API bound `0.0.0.0`; same Wi‑Fi / tunnel |
| Login 401 | Auth | Seed password; JWT secret mismatch after redeploy |
| Teacher missing student report | AuthZ / membership | Active `GroupMembership`; teacherId on group |
| Reminder spam / none | Cron / timezone | `ReportDeadlineConfig`; server clock; duplicate notification dedupe |
| تقصير wrong | Policy engine | Policy rows enabled? Content fields vs clock rule (clock must stay off) |
| APK can’t install | Android | Unknown sources; incompatible ABI (build fat APK / splits) |

---

# PART 10 — ONE-PAGE PRODUCTION BLUEPRINT

```
OWN:     Flutter + Nest + Next code, Postgres schema, backups, JWT issuer
SWAP:    VPS, DNS, object storage, FCM provider
NEVER:   DB credentials in the app; peer report leaks; edit-after-submit;
         hard-coded تقصير thresholds; clock-only missing-report infractions (until decided)

DEPLOY:  Caddy → Nest (:43124 internal) + Next admin
         Postgres managed or on-box with nightly off-site dump
MOBILE:  Flutter CI artifact → Play/App Store (or releases/*.apk for pilots)
CONFIG:  API_BASE_URL dart-define + in-app override for pilots
SCALE:   Vertical VPS → managed Postgres → Redis/queues only with evidence
ROLES:   student / teacher / supervisor(+admin) · WhatsApp link stage-1
```

---

# PART 11 — HOW THIS GUIDE WAS RESHAPED

| Source curriculum | Ertaki adaptation |
|---|---|
| RN + Expo school/grades platform | **Flutter** + Nest + **Next admin**; Quran program domain |
| “My Grades” request story | Daily report submit + staff-only visibility |
| Generic students/teachers/admin | student / teacher / supervisor with dual Flutter+web for supervisor |
| Expo EAS-centric mobile CI | Flutter CLI / Gradle APK; optional store later; sideload path documented |
| Toy courses/grades schema | Groups, memberships, joins, daily/weekly reports, attendance, notes, quotas, تقصير policies |
| Push as generic chapter | Concrete events + midnight **reminders** without auto-infraction |
| Free-tier BaaS temptation | Explicit self-host / unlimited-users path matching `mvp-plan.md` |

**Out of scope for this blueprint (phase 2+):** full in-app messaging, advanced exports, in-app تسميع calls, Kubernetes.

---

## Related docs

- Product requirements: `docs/requirements.md`  
- Locked decisions: `docs/decisions.md`  
- MVP plan: `docs/mvp-plan.md`  
- Repo runbook: root `README.md`  
- APK status: project store `internal/apk-release-status.md`  

GitHub: https://github.com/fayed23/Ertaki-Project
