# ارتق (Ertaki) — Quran memorization tracking

Arabic-first app for the **ارتق** program: **Flutter** (Android + iOS students/teachers) + **Next.js** supervisor admin + **NestJS** API + **SQLite** (default) or **PostgreSQL**.

Preferred Windows clone path: `D:\workStuff\Ertaki-Project`

```bat
git clone https://github.com/fayed23/Ertaki-Project.git "D:\workStuff\Ertaki-Project"
cd /d "D:\workStuff\Ertaki-Project"
```

Full product requirements: [`requirements.md`](./requirements.md)

---

## Prerequisites (PC)

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

Windows (cmd):

```bat
cd /d "D:\workStuff\Ertaki-Project\api"
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
set NEXT_PUBLIC_API_URL=http://127.0.0.1:43124/api
npm run dev
```

Windows (cmd):

```bat
cd /d "D:\workStuff\Ertaki-Project\admin"
npm install
set NEXT_PUBLIC_API_URL=http://127.0.0.1:43124/api
npm run dev
```

Open http://127.0.0.1:43123 — login with supervisor `0500000001` / `password123`.

---

## 3) Flutter app (students + teachers)

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE=http://127.0.0.1:43124/api
```

### Useful variants

```bash
# Android emulator (host loopback)
flutter run --dart-define=API_BASE=http://10.0.2.2:43124/api

# Chrome web preview
flutter run -d chrome --web-hostname=0.0.0.0 --web-port=43125 --dart-define=API_BASE=http://127.0.0.1:43124/api

# Windows desktop (if Flutter Windows desktop enabled)
flutter run -d windows --dart-define=API_BASE=http://127.0.0.1:43124/api
```

**Student seed:** `0500000003` / `password123`  
**Teacher seed:** `0500000002` / `password123`

Student tabs: home · my group · daily report · progress.

---

## Optional PostgreSQL

```bash
docker compose up -d
cd api
# Linux/macOS
export DB_TYPE=postgres
export DATABASE_URL=postgres://ertaki:ertaki@localhost:5432/ertaki
export TYPEORM_SYNC=true
npm run start:dev
```

Windows (cmd):

```bat
set DB_TYPE=postgres
set DATABASE_URL=postgres://ertaki:ertaki@localhost:5432/ertaki
set TYPEORM_SYNC=true
npm run start:dev
```

---

## Locked product decisions (MVP)

- Daily reports: **teachers/supervisors only** (students never see peers’ reports)
- No edit after submit
- No report deadlines / no missing-by-time infractions yet (config table ready)
- Daily quota: **per student**
- Infraction consequences: **admin-configurable only**

---

## Recent UX (high-impact + polish)

- **Student:** home CTA «أرسل تقرير اليوم», stepped daily report (حفظ → مراجعة → تكرار/تفسير → إرسال), weekly confirm, notes inbox, bottom nav الرئيسية / مجموعتي / تقرير / تقدّمي
- **Teacher:** priorities (لم يرسلوا / تقصير / مجلس اليوم), student file + notes (internal/visible), attendance marking, notifications list, nav الرئيسية / طلبة / حضور / إشعارات
- **Supervisor admin:** pending joins first, status chips, seat progress bars, action toasts
- Typography: Amiri for «ارتق» brand; Cairo for UI body

Still deferred: deadline enforcement, auto-infraction engine, FCM/SMS, quota set UI (API exists; Flutter reads only)

---

## Repo layout

```
api/               NestJS API
admin/             Next.js supervisor UI (RTL)
mobile/            Flutter (Android + iOS + web)
requirements.md    Full Arabic product requirements
docker-compose.yml Optional Postgres
README.md          This file
```

GitHub: https://github.com/fayed23/Ertaki-Project
