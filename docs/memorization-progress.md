# Memorization progress

Normalized **plan / active progress / history / achievements / assessments / certificates / plan-change / reset** model for student Quran memorization tracking (Qalūn pickers).

## Concepts

| Piece | Role |
|---|---|
| **Plan** | Start surah + āyah, daily pace (`half_page` \| `one_page`), `studentMayEdit` |
| **Active progress** | Current position, cycle number, hizbs-in-cycle counter |
| **Progress history** | Archived snapshots on reset (never auto-deleted) |
| **Hizb completions** | Unique per `(student, hizb, cycle)`; preserved on reset |
| **Achievements** | Medals / cycle badges / certificates; preserved on reset |
| **Assessments** | Per 10-hizb cycle (`pending` → `scheduled` → `passed` / `failed` / `retake`) |
| **Certificates** | Issued on pass; unique per `(student, cycle)`; starts next cycle |
| **Plan changes** | Audit: previous / new / who / when / reason |
| **Resets** | Destructive archive + re-init; **admin/supervisor only** by default |

## Edit vs reset

- **Pace change** updates the plan only — never clears completions or achievements.
- **Starting-point change after progress** requires `confirmMode`:
  - `plan_only` — Option A: plan fields only
  - `plan_and_reset` — Option B: plan + full progress reset (supervisor/admin)
- **Reset** is a separate POST with `confirm: true` + reason; archives active progress then re-inits from plan start.

## Setup (post-join)

Student (or staff) calls setup with Qalūn surah/ayah + pace and must send `confirmNew: true` + `confirmSequential: true`. Visible to student, group teacher, and supervisor/admin.

## API

| Method | Path | Who |
|---|---|---|
| GET | `/memorization?studentId=` | scoped snapshot |
| POST | `/memorization/setup` | student / teacher / supervisor |
| PATCH | `/memorization/plan` | student (if allowed) / teacher / supervisor |
| POST | `/memorization/reset` | supervisor / admin only |
| POST | `/memorization/hizb-completions` | student / teacher / supervisor |
| POST | `/memorization/assessments` | teacher / supervisor |
| POST | `/memorization/certificates` | teacher / supervisor |

Cycle progress bar: completed hizbs in current cycle / **10**. At 10, a pending assessment is created; pass issues a certificate and advances the cycle.

## Clients

- Flutter: `MemorizationProgressSection` on student **تقدّمي** and teacher **ملف الطالب**
- Admin: tab **الحفظ** (`/memorization`) — view + reset

## Migration

`MemorizationProgress1750000000000` — runs under `RUN_MIGRATIONS=true` (Postgres). Local SQLite uses TypeORM `synchronize`.
