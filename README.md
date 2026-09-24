# ارتق (Ertaki) — Quran memorization tracking

Arabic-first app for the **ارتق** program: **Flutter** (Android + iOS students/teachers) + **Next.js** supervisor admin + **NestJS** API + **SQLite** (default) or **PostgreSQL**.

```bash
git clone https://github.com/fayed23/Ertaki-Project.git
cd Ertaki-Project
```

Full product requirements: [`requirements.md`](./requirements.md)  
Professional rebuild / production curriculum: [`docs/ertaki-portable-production-guide.md`](./docs/ertaki-portable-production-guide.md)

---

## Prerequisites

| Tool | Notes |
|---|---|
| **Node.js 20+** | API + admin |
| **npm** | comes with Node |
| **Flutter 3.27+** | mobile / optional web preview |
| **Chrome** (optional) | `flutter run -d chrome` |
| **Docker** (optional) | PostgreSQL instead of SQLite |

No cloud API keys are required for local MVP (JWT + SQLite).

---

## Ports (defaults)

| Service | URL |
|---|---|
| API | http://127.0.0.1:43124/api |
| Admin (supervisor) | http://127.0.0.1:43123 |
| Flutter web preview (optional) | http://127.0.0.1:43125 |

---

## 1) API (NestJS + SQLite by default)

```bash
cd api
npm install
npm run start:dev
```

### Environment variables (API)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `43124` | HTTP port |
| `DB_TYPE` | `sqlite` | set `postgres` for PostgreSQL |
| `SQLITE_PATH` | `ertaki.dev.sqlite` | SQLite file path |
| `DATABASE_URL` | `postgres://ertaki:ertaki@localhost:5432/ertaki` | used when `DB_TYPE=postgres` |
| `TYPEORM_SYNC` | unset | set `true` to auto-sync schema on Postgres |
| `JWT_SECRET` | `ertaki-dev-secret-change-me` | change in any shared environment |

### Seed accounts (password for all: `password123`)

| Role | Phone |
|---|---|
| Supervisor | `0500000001` |
| Teacher | `0500000002` |
| Student | `0500000003` |

---

## 2) Supervisor admin (Next.js)

```bash
cd admin
npm install
# Windows cmd: set NEXT_PUBLIC_API_URL=http://127.0.0.1:43124/api
export NEXT_PUBLIC_API_URL=http://127.0.0.1:43124/api
npm run dev
```

Open http://127.0.0.1:43123 — login with supervisor `0500000001` / `password123`.

The same supervisor account also works in the Flutter app (`?phone=0500000001&auto=1` on web preview).

---

## 3) Flutter app (students + teachers + supervisors)

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:43124/api
```

(`API_BASE` still works as a legacy alias.)

### API base URL (phone / emulator)

| Context | Typical URL |
|---|---|
| Android emulator | `http://10.0.2.2:43124/api` (host loopback) |
| Phone on same Wi‑Fi as your PC | `http://YOUR_PC_LAN_IP:43124/api` (e.g. `http://192.168.1.10:43124/api`) |
| Tunnel / deployed host | `https://your-host.example/api` |

**Defaults:** build-time `--dart-define=API_BASE_URL=...` (APK default is emulator-friendly `http://10.0.2.2:43124/api`). On first login the app shows an **API base URL** field — change it to your PC LAN IP / ngrok / deployed URL. The value is saved on the device.

Find your PC LAN IP (PowerShell):

```powershell
ipconfig | findstr IPv4
```

API must listen on all interfaces when testing from a phone:

```powershell
cd api
$env:PORT="43124"
npm run start:dev
# Nest already binds 0.0.0.0 in this project
```

### Useful variants

```bash
# Android emulator (host loopback)
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:43124/api

# Chrome web preview
flutter run -d chrome --web-hostname=0.0.0.0 --web-port=43125 --dart-define=API_BASE_URL=http://127.0.0.1:43124/api

# Windows desktop (if Flutter Windows desktop enabled)
flutter run -d windows --dart-define=API_BASE_URL=http://127.0.0.1:43124/api

# Release APK
flutter build apk --release --dart-define=API_BASE_URL=http://10.0.2.2:43124/api
```

Demo query params on Flutter web: `?phone=0500000003&auto=1` (student) or `?phone=0500000002&auto=1` (teacher).

### How to install APK on phone

1. Download [`releases/ertaki-android-release.apk`](./releases/ertaki-android-release.apk) from this repo, or the GitHub Release **[v1.0.2-apk](https://github.com/fayed23/Ertaki-Project/releases/tag/v1.0.2-apk)** asset.
2. On Android: **Settings → Security / Apps → Install unknown apps** (or **Allow from this source**) for Chrome/Files.
3. Open the APK and install.
4. Start the API on your PC (same Wi‑Fi) or use a public URL.
5. Open **ارتق**, set **API base URL** to `http://YOUR_PC_LAN_IP:43124/api` (or your tunnel/deployed URL), then log in.

Seed logins (password `password123`):

| Role | Phone |
|---|---|
| Supervisor | `0500000001` |
| Teacher | `0500000002` |
| Student | `0500000003` |

**Notes:** The release APK is signed with the Flutter **debug** keystore for easy sideloading (not Play Store). Phone and PC must be able to reach each other — `127.0.0.1` on the phone means the phone itself, not your PC.

---

## Optional PostgreSQL

```bash
docker compose up -d
cd api
export DB_TYPE=postgres
export DATABASE_URL=postgres://ertaki:ertaki@localhost:5432/ertaki
export TYPEORM_SYNC=true
npm run start:dev
```

---

## Locked product decisions (MVP)

- Daily reports: **teachers/supervisors only** (students never see peers’ reports)
- No edit after submit
- **Deadline reminders** near midnight for students without a report (configurable); no auto-infraction on miss yet
- Staff alerts when a report, excuse, or absence is recorded (in-app + FCM when `FCM_SERVER_KEY` is set)
- Daily quota: **per student**
- Infraction consequences: **admin-configurable only**

---

## Recent UX (high-impact + polish)

- **Student:** home CTA «أرسل تقرير اليوم», single-screen daily report (all fields + sticky submit), weekly confirm, notes inbox, bottom nav الرئيسية / مجموعتي / تقرير / تقدّمي
- **Teacher:** priorities (لم يرسلوا / تقصير / مجلس اليوم), student file + notes (internal/visible), attendance marking, notifications list, nav الرئيسية / طلبة / حضور / إشعارات
- **Supervisor:** Flutter app (dashboard, join requests, groups, policies) **and** Next.js admin web — same account works on both
- Typography: Amiri for «ارتق» brand; Cairo for UI body

Still deferred: missing-by-deadline auto-infractions, full Firebase project wiring (optional `FCM_SERVER_KEY`), quota set UI (API exists; Flutter reads only)

### Push notifications

| Event | Recipients |
|---|---|
| Near midnight, no daily report | Student |
| Daily report submitted | Teacher + supervisors |
| Excuse submitted | Teacher + supervisors |
| Absence (excused / unexcused) | Teacher + supervisors (+ student) |

Set `FCM_SERVER_KEY` on the API for real device push. Without it, alerts are stored in `/notifications` and shown in the app (local notifications on Android/iOS when the app can schedule/poll).

---

## Repo layout

```
api/               NestJS API
admin/             Next.js supervisor UI (RTL)
mobile/            Flutter (Android + iOS + web)
releases/          Sideload Android APK(s)
docs/              Production / rebuild curriculum
requirements.md    Full Arabic product requirements
docker-compose.yml Optional Postgres
README.md          This file
```

GitHub: https://github.com/fayed23/Ertaki-Project
