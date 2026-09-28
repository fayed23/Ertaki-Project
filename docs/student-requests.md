# Student requests & excuses

Reusable **Student Request** workflow for daily-report excuses and weekly-session absences (extensible types).

## Types

| Type | Value | On approve |
|---|---|---|
| Daily report excuse | `daily_report_excuse` | Creates/updates `daily_reports` with `status=excused` + `excuseRequestId` |
| Weekly session absence | `weekly_session_absence` | Attendance `status=excused` + `excuseRequestId` |

Statuses: `pending` → `approved` / `rejected` / `cancelled` (student cancel while pending).

## API

| Method | Path | Who |
|---|---|---|
| POST | `/student-requests` (multipart: `type`, `relevantDate`, `reason`, optional `attachment`) | student |
| GET | `/student-requests` (filters: status, type, groupId, teacherId, studentId, from, to) | scoped |
| GET | `/student-requests/stats` | supervisor/admin |
| GET | `/student-requests/:id` | scoped |
| GET | `/student-requests/:id/attachment` | authenticated download |
| PATCH | `/student-requests/:id/cancel` | student (pending only) |
| PATCH | `/student-requests/:id/review` `{ approve, reviewerNote? }` | teacher (own groups) / supervisor |

Legacy `/excuse-requests` remains as a weekly-absence alias.

## Attachments

- Allowed: PDF, JPG, PNG · max **5 MB**
- Stored under `UPLOAD_DIR` (default `uploads/student-requests`)
- Not public URLs — Bearer required

## Clients

- Flutter: `StudentRequestsPage` (student), `StaffRequestsPage` (teacher/supervisor)
- Admin: tab **الأعذار** (`/requests`)
