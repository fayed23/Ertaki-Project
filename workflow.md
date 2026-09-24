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
- Sideload Android **release APK** (debug-signed): `releases/ertaki-android-release.apk` + GitHub Release `v1.0.2-apk`
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
- New signups start as `pending_approval` / inactive; login blocked with clear Arabic message until supervisor approves
- Supervisor **approve** → account active (student `new` for join flow, teacher `active`); **reject** → stays blocked with optional reason
- Seeded accounts remain active; join-group requests stay a separate workflow from account activation
- Endpoints: `POST /auth/register`, `GET/PATCH /account-approvals` (supervisor/admin)
- Device token registration endpoint for optional FCM
- Notify supervisors on new pending signup; notify user on approve/reject (in-app stub + FCM when keyed)

---

## Groups, membership & joins

- Groups: teacher, gender, seats, مجلس day/time, status, external **WhatsApp** URL
- Membership history (`joinedAt` / `leftAt`) — not a single static group field on user
- Join requests: pending / accepted / rejected; supervisor accept/reject (admin web + Flutter)
- Seat progress bars + status chips on group lists
- Student “مجموعتي” with WhatsApp button + excuse request form

---

## Daily report (التقرير اليومي)

- Structured fields (not free text): حفظ القسط, times from–to, ورد المراجعة + times, 50 تكرار, مجلس واحد, تفسير
- **Single-screen form** (all fields visible) + sticky submit — no step wizard
- **No edit after submit**; locked empty state if already sent today
- Visibility: **staff only** — students never see peers’ reports or submit status
- Content-based تقصير evaluation (quota / reps / etc.) via policies — not clock-only missing-report infractions

---

## Weekly report

- System-generated from daily + attendance
- Student confirmation flow (`PATCH …/confirm`) on progress screen

---

## Attendance & excuses

- Teacher marks present / بعذر / بلا عذر (optional late / left early fields in model)
- Student can submit absence excuse; staff review endpoints
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
- **InfractionPolicy** admin-configurable thresholds/actions — no hard-coded warn/freeze/remove in app logic
- Supervisor can view policies in Flutter + edit via admin web

---

## Notifications & deadline reminders

- Near-midnight **reminders** for students without today’s report (configurable timezone/close/reminder minutes; default Africa/Algiers 23:59)
- Final reminder ~15 minutes before close
- Staff alerts: report submitted · excuse submitted · absence recorded
- In-app notification inbox; optional FCM when `FCM_SERVER_KEY` set
- Flutter local notification schedule + poll on resume

---

## Dashboards & UX

- **Student home:** primary CTA «أرسل تقرير اليوم» / submitted state; notes empty states
- **Teacher home:** لم يرسلوا اليوم / تقصير / مجلس اليوم; group cards with chips/seat bars
- **Teacher:** students list → student file; attendance tab; notifications tab
- **Supervisor Flutter:** home metrics + pending account-activation / joins CTAs; طلبات tab = account approvals + join requests; groups; notifications (policies via web / home note)
- **Supervisor admin (Next):** تفعيل الحسابات tab + pending joins, chips, seat bars, toasts, RTL brand
- Soft panels, empty states with CTAs, ≥48px tap targets, denser layouts (Phase A/B polish)

---

## Bottom navigation

- Student: الرئيسية / مجموعتي / تقرير / تقدّمي  
- Teacher: الرئيسية / طلبة / حضور / إشعارات  
- Supervisor: الرئيسية / طلبات (تفعيل + انضمام) / مجموعات / إشعارات  

---

## Production / rebuild guidance

- Portable production curriculum: `docs/ertaki-portable-production-guide.md` (architecture, locked rules, 25 harden levels, checklists)
- Workflow maintenance rule: keep this file updated when capabilities ship

---

## Explicitly deferred / stubbed

- Clock-based “missing report” auto-infraction (reminders on; auto-flag off)
- Full FCM without `FCM_SERVER_KEY` + Firebase app config
- Quota **set** UI in Flutter (API exists; UI mostly reads)
- In-app messaging, advanced exports, in-app تسميع calls (phase 2+)
- Play/App Store release signing (sideload uses debug keystore)
