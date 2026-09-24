# Ertaki (ارتق) — Workflow & shipped capabilities

Living product map of what exists today.  
**Maintain both copies** when features ship: repo root `workflow.md` and  
`/cursor/stores/bc-440552b5-34ce-42cb-aad8-96e25c449c29/docs/workflow.md`  
(see `internal/workflow-maintenance.md`).

---

## Stack & delivery

- Monorepo: **Flutter** mobile (Android + iOS + web) · **NestJS** API · **Next.js** supervisor admin · **SQLite** (dev) / **PostgreSQL** (prod-ready)
- Self-host path: no SaaS seat limits; JWT + bcrypt auth
- Try Live ports (cloud): API `43124`, admin `43123`, Flutter web `43125`
- Public GitHub: https://github.com/fayed23/Ertaki-Project
- Sideload Android **release APK** (debug-signed): `releases/ertaki-android-release.apk` + GitHub Release `v1.0.5-apk`
- Configurable API base: `--dart-define=API_BASE_URL=...` + in-app field on login (persisted); cleartext HTTP allowed for LAN testing
- Docs: `requirements.md`, `docs/decisions.md` (store), `docs/ertaki-portable-production-guide.md`, root `README.md`

---

## Roles & access

- Roles: `student` · `teacher` · `supervisor` · `admin`
- **Student / teacher:** Flutter app
- **Supervisor:** Flutter app **and** Next.js admin — same account
- Seeds (password `password123`): supervisor `0500000001`, teacher `0500000002`, student `0500000003` (+ `0500000004`)
- Flutter web demo: `?phone=…&auto=1`
- Arabic RTL everywhere; Amiri for brand «ارتق», Cairo for UI

---

## Auth & identity

- Login / JWT session; password hashes excluded from API responses
- Role-based Nest guards + domain checks (server is source of truth)
- **Public self-registration (Flutter):** `student` or `teacher` only — not supervisor/admin
- **Student signup:** activates **immediately** (`new` + JWT); first-run locked until group membership — groups catalog / multi join requests
- **Teacher signup:** `pending_approval` / inactive until supervisor approves; login blocked with clear Arabic message
- Legacy pending students migrate to active+needs-group on login
- Endpoints: `POST /auth/register`, `GET/PATCH /account-approvals` (supervisor/admin — teachers)
- Device token registration endpoint for optional FCM
- Notify supervisors on new **teacher** pending signup; notify user on approve/reject

---

## Groups, membership & joins

- Groups: teacher, gender, seats, مجلس day + **start→finish** time, status (`pending_approval` / `open` / …), WhatsApp URL, description
- **Teacher create group** → `pending_approval` until supervisor `PATCH /groups/:id/approval`
- Supervisor/admin create → `open` immediately
- Membership history (`joinedAt` / `leftAt`)
- Join requests: student may request **one or many** open groups; visible to **group teacher and supervisors**
- Accept by **teacher OR supervisor** (single resolution clears for the other); reject supported
- After ≥1 accepted membership → student features unlock (`GET /memberships/has-group`)
- Group views (teacher + supervisor): **brief** (students + daily-submit status) / **detailed** (membership, attendance, notes, infractions, quotas; **report bodies only for teacher**)
- Supervisor directory: `GET /directory` — all students, teachers, groups
- Student “مجموعتي” with WhatsApp + excuse form

---

## Daily report (التقرير اليومي)

- Structured fields: حفظ القسط, times from–to, ورد المراجعة + times, 50 تكرار, مجلس واحد, تفسير
- Single-screen form + sticky submit; **time range sliders** (5‑min snap)
- **No edit after submit**
- Visibility (locked):
  - **Teacher** of the student’s group: list + full detail + `daily_report_submitted` notification
  - **Supervisor: no** daily report list, detail, dash widgets, or report notifications
  - **Student:** own reports only; never peers
- Content-based تقصير via policies — not clock-only missing-report infractions

---

## Weekly report

- Auto-generated after each week (cron Sat 00:15 Africa/Algiers) from daily + attendance
- **Teacher only:** brief + detailed list/detail (`GET /weekly-reports?mode=…`); staff notify on auto-gen
- **Supervisor: no** weekly list/detail/notifications
- Student confirmation (`PATCH …/confirm`) on progress screen

---

## Attendance & excuses

- Teacher marks weekly مجلس attendance (UI copy: **أسبوعي** / حفظ الحضور الأسبوعي — not daily)
- Student absence excuse; staff review
- Unexcused absence can create تقصير per policy
- Staff (+ student) notified on excused/unexcused recording

---

## Notes & quotas

- Teacher notes: **internal** or **student_visible**
- Student notes inbox on home / progress
- القسط اليومي **per student** (API set; Flutter reads on file/home)

---

## Infractions (تقصير)

- Types from content/attendance (missed quota, missed 50, unexcused absence, …)
- **InfractionPolicy** admin-configurable — no hard-coded thresholds in app logic
- Supervisor views policies in Flutter + edits via admin web

---

## Notifications & deadline reminders

- Near-midnight **reminders** for students without today’s report (default Africa/Algiers 23:59)
- Final reminder ~15 minutes before close
- **Teacher** alerts: daily report submitted · excuse · absence · weekly auto-gen
- **Supervisor** alerts: teacher account approval · join requests · group-creation approval — **not** student report content
- In-app inbox; optional FCM when `FCM_SERVER_KEY` set

---

## Dashboards & UX

- **Student:** first-run groups catalog (locked shell) → home CTA report; notes; progress + weekly confirm
- **Teacher:** priorities; join requests; create group; students **grouped by group**; group brief/detailed; weekly reports brief/detailed; attendance weekly copy
- **Supervisor Flutter:** metrics (no report counts); directory; group approve; joins + teacher account approvals; **no** daily/weekly report screens
- **Supervisor admin (Next):** تفعيل معلمين · joins · groups (approve) · directory · policies — **no** «تقارير اليوم» / weekly tabs

---

## Bottom navigation

- Student: الرئيسية / مجموعتي / تقرير / تقدّمي (catalog-only shell until membership)
- Teacher: الرئيسية / طلبة / حضور / إشعارات
- Supervisor: الرئيسية / طلبات / مجموعات / إشعارات

---

## Production / rebuild guidance

- Portable production curriculum: `docs/ertaki-portable-production-guide.md`
- Workflow maintenance: keep this file + store copy updated when capabilities ship
- Standing rule: product slices → update workflow · rebuild APK · GitHub Release · push with saved PAT

---

## Explicitly deferred / stubbed

- Clock-based “missing report” auto-infraction (reminders on; auto-flag off)
- Full FCM without `FCM_SERVER_KEY` + Firebase app config
- Quota **set** UI in Flutter (API exists; UI mostly reads)
- In-app messaging, advanced exports, in-app تسميع calls (phase 2+)
- Play/App Store release signing (sideload uses debug keystore)
