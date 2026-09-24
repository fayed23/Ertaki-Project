# Ertaki — locked product decisions

Updated: 2026-09-24

## Daily & weekly reports visibility
- **Teachers** (of the student’s group) can see daily and weekly report content.
- **Supervisors do NOT** receive, list, or open students’ daily or weekly reports (no report notifications, dash widgets, or detail for report content).
- **Students** see only their own reports; never peers’ reports or peer submit status.

## Daily report editing
No edits after submit.

## Daily report deadlines & reminders
- **Reminders ON:** students who have not submitted receive mobile/in-app reminders near midnight (default timezone `Africa/Algiers`, close `23:59`, first reminder 60 minutes before, final ~15 minutes before). Configurable via `report-deadline-config`.
- **Auto-infractions OFF:** do not auto-flag “missing report” as an infraction when the window closes. Keep that for a later admin toggle.

## Staff mobile notifications
- **Teacher** of the student: notify when a daily report is submitted, an absence excuse is submitted, or attendance is recorded as excused / unexcused absence.
- **Supervisor:** do **not** notify for student daily/weekly report submissions. Other ops notifications (join requests, group-creation approval, account/group management) remain OK.

Push delivery uses FCM when `FCM_SERVER_KEY` is set; otherwise notifications stay in-app and the Flutter client can surface them locally when open.

## Daily memorization quota (القسط اليومي)
Set per student (teacher/supervisor).

## Infraction consequences
Fully admin-configurable. Ship config + admin UI hooks; do not hardcode warn/freeze/remove thresholds in application logic.

## Student signup & group gate
Student accounts activate immediately on register. First-run features stay locked until group membership; student picks groups and requests join; teacher or supervisor may accept (one acceptance clears for the other).
