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
- Sideload Android **release APK** (debug-signed): `releases/ertaki-android-release.apk` + GitHub Release `v1.0.11-apk`
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
- Branding: launcher + in-app mark from transparent `assets/branding/app_logo.png` (adaptive bg `#0F3D2E`); login bottom-center + About (i) use transparent `assets/branding/GroupLogo.png` (no white box); teacher/supervisor hub shows `GroupLogo` only after scrolling down (tied to hub scroll content — hidden at top)

---

## Auth & identity

- Login / JWT session; password hashes excluded from API responses
- Role-based Nest guards + domain checks (server is source of truth)
- **Public self-registration (Flutter):** `student` or `teacher` only — not supervisor/admin
- **Student signup:** activates **immediately** (`new` + JWT); **gender required** (men/women); first-run locked until group membership — gender-filtered catalog / **one** join request (cancellable)
- **Teacher signup:** `pending_approval` / inactive until supervisor approves; login blocked with clear Arabic message
- Legacy pending students migrate to active+needs-group on login
- Endpoints: `POST /auth/register`, `GET/PATCH /account-approvals` (supervisor/admin — teachers)
- Device token registration endpoint for optional FCM
- Notify supervisors on new **teacher** pending signup; notify user on approve/reject

---

## Groups, membership & joins

- Groups: teacher, gender, seats, مجلس day + **start→finish** time, status (`pending_approval` / `open` / …), **WhatsApp URL** (on create + brief overview), description; **teacher can edit** own group params (`PATCH /groups/:id`); supervisors notified on teacher edits
- **Teacher create group** → `pending_approval` until supervisor `PATCH /groups/:id/approval`
- Supervisor/admin create → `open` immediately
- Membership history (`joinedAt` / `leftAt`)
- Join requests: student may request **one group at a time** (cancel supported); catalog filtered by student gender; visible to **group teacher and supervisors**
- Accept by **teacher OR supervisor** (single resolution clears for the other); reject supported
- After ≥1 accepted membership → student features unlock (`GET /memberships/has-group`)
- Group views (teacher + supervisor): **brief** (students + daily-submit status) / **detailed** (membership, attendance, notes, infractions, quotas; **report bodies only for teacher**)
- Supervisor directory: `GET /directory` — all students, teachers, groups
- Student “مجموعتي” with WhatsApp + excuse form

---

## Daily report (التقرير اليومي)

- Structured fields: حفظ القسط, **Qalūn surah + āyah from–to**, clock times from–to, ورد المراجعة + times, 50 تكرار, مجلس واحد, تفسير
- Single-screen form + sticky submit; **clock-style TimeOfDay pickers** (same as create-group — no sliders)
- Quran dataset: `mobile/assets/quran/qalun_surahs.json` + `api/data/quran/` — **قالون عن نافع** (6214 āyahs) from [quran-meta](https://github.com/quran-center/quran-meta) `QalunLists.ts` / KFGQPC QalounData (not Ḥafṣ)
- **No edit after submit**
- Visibility (locked):
  - **Teacher** of the student’s group: list + full detail + `daily_report_submitted` notification
  - **Supervisor: no** daily report list, detail, dash widgets, or report notifications
  - **Student:** own reports only; never peers
- Content-based تقصير via policies — not clock-only missing-report infractions

---

## Weekly report

- **Primary trigger:** teacher `POST /attendance/weekly` after saving مجلس التسميع attendance → generate/update each student’s weekly report for that Sat–Fri week
- PDF «التقرير الأسبوعي» fields: اسم الطالب · حضرت مجلس التسميع نعم/لا · عدّادات لم أرسل التقرير / لم أحفظ القسط / لم أكرر 50 / لم أكرر في مجلس واحد / لم آتِ بورد المراجعة (from that week’s dailies + attendance)
- Cron Sat 00:15 is **fallback only** (students who already have weekly attendance that week but still lack a report)
- **Teacher only:** brief + detailed; staff notify after attendance save
- **Supervisor: no** weekly list/detail/notifications
- Student confirmation (`PATCH …/confirm`) on progress screen

---

## Attendance & excuses

- Teacher marks weekly مجلس attendance (UI copy: **أسبوعي** / حفظ الحضور الأسبوعي — not daily); save via `/attendance/weekly` also builds weekly reports
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
- Notification taps **deep-link** to the matching screen
- Any role can **mark all read** or **clear all** notifications (`POST /notifications/mark-read`, `POST /notifications/clear`)
- In-app inbox; optional FCM when `FCM_SERVER_KEY` set

---

## Dashboards & UX

- **Student:** first-run groups catalog (locked shell) → home CTA report; notes; progress + weekly confirm
- **Teacher:** category hub home (مجموعات، طلبة، طلبات، حضور، تقارير، إنشاء، إشعارات); students **nested inside** each group card (not sibling top-level cards); light brand Atmosphere on all category pages (no black voids); group brief/detailed + WhatsApp; weekly PDF-format reports; attendance weekly copy
- **Supervisor Flutter:** category hub (تفعيل، انضمام، مجموعات، دليل، إشعارات); **no** daily/weekly report screens
- **Supervisor admin (Next):** تفعيل معلمين · joins · groups (approve) · directory · policies — **no** «تقارير اليوم» / weekly tabs
- **System Back:** nested navigators + PopScope — pops in-app routes first; non-home tab → home; home → confirm exit
- **Swipe:** horizontal PageView between bottom-nav destinations for all roles, synced with NavigationBar
- Hub category tiles show **unread/new count badges** (hidden when 0): joins, reports missing today, group approvals, notifications — counts **auto-refresh** when returning to the hub (route pop), switching back to الرئيسية, re-tapping home, or app resume (no full page reload)
- **Clock time pickers** everywhere (daily report, group schedule, admin deadline close) — no range/dual sliders

---

## Bottom navigation

- Student: الرئيسية / مجموعتي / تقرير / تقدّمي (catalog-only shell until membership) — swipeable
- Teacher: الرئيسية / طلبة / حضور / إشعارات — swipeable
- Supervisor: الرئيسية / طلبات / مجموعات / إشعارات — swipeable

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
