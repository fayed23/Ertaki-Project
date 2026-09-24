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
- Notification taps **deep-link** to the relevant screen (join review, group approval, report detail for teachers, attendance, account approval, etc.).

Push delivery uses FCM when `FCM_SERVER_KEY` is set; otherwise notifications stay in-app and the Flutter client can surface them locally when open.

## Daily memorization quota (القسط اليومي)
Set per student (teacher/supervisor).

## Infraction consequences
Fully admin-configurable. Ship config + admin UI hooks; do not hardcode warn/freeze/remove thresholds in application logic.

## Student signup & group gate
- Student accounts activate immediately on register.
- Student **must** select gender (رجال/نساء) at signup.
- First-run: features locked until group membership; catalog shows **only groups matching student gender**.
- Student may have **at most one** pending join request or membership at a time (one group focus); can **cancel** a pending request.
- Teacher or supervisor may accept a join (one acceptance clears for the other).

## Group WhatsApp
Teacher create-group form includes WhatsApp group URL; shown on group **brief** overview after approval (and on student «مجموعتي»).

## Teacher / supervisor home
Main home is a **category hub** (icon buttons) that opens dedicated views — not dense stacked lists.
Teacher students list: students appear **only under their group sections** (no flat all-students list).


## Weekly report generation
- Generated **after the teacher saves weekly مجلس attendance** (`POST /attendance/weekly`), not on cron alone.
- Field semantics match PDF «التقرير الأسبوعي»: attended yes/no + miss counts for report/quota/50/single-sitting/review from that week’s dailies.
- Cron Saturday is fallback only when attendance already exists for the week.
- Supervisors still have **no** access to daily/weekly report content.

## Android navigation
- System Back pops the current in-app route; only exits (with confirm) on role home root.
- Bottom destinations are swipeable via PageView and stay in sync with the NavigationBar.


## Group editing
- Group teacher (owner) and supervisors may edit group params: name, WhatsApp, seats, description, schedule, gender (teacher: gender only when empty).
- Teacher edits notify supervisors (`group_updated`).

## Notifications clear & hub badges
- Any authenticated user may mark-all-read or clear-all their notifications; swipe L/R deletes one (`DELETE /notifications/:id`).
- Hub category badges use real unread/pending counts; badge hidden at 0.
- Teacher **التقارير** badge = today’s **submitted** report count (matches list), not missing students.
- Hub tiles with a bottom-nav equivalent switch that tab instead of pushing a duplicate route.


## Qalūn daily memorization ranges
- Daily report حفظ ward uses structured surah number/name + āyah from–to validated against **Qalūn ‘an Nāfi‘** counts (6214), not Ḥafṣ (6236).
- Dataset source: quran-center/quran-meta `QalunLists.ts` (KFGQPC Qaloun font metadata). See `mobile/assets/quran/DATASET.md`.

## Time entry UI
- All time fields use system clock / `showTimePicker` / HTML `<input type="time">` — no dual/range sliders.

## Teacher monitoring calendar
- **Reports** and **attendance** monitoring use a **month calendar**; tapping a day shows that day’s items **grouped by group**.
- Empty/loading/error states when a day has no data (including days whose dailies were rolled into a weekly).

## Report retention lifecycle
- **Daily → weekly:** When weekly reports are generated (after `POST /attendance/weekly` or weekly fallback), **delete that week’s daily reports** for each student. Only weeklies remain for that period.
- **Weekly → trimestrial (كل 3 أشهر):** On calendar-trimester close (cron 1 Jan/Apr/Jul/Oct 00:30 Africa/Algiers, or manual generate), **delete weeklies** in that trimester and generate a **trimestrial report per student/group** aggregating all weekly fields. Lists/views are **grouped by group**.
- **Trimestrial visibility:** teachers (their groups) **and supervisors** (all groups). Supervisors still have **no** access to daily or weekly report content.
- Trimesters: calendar quarters Jan–Mar · Apr–Jun · Jul–Sep · Oct–Dec (Africa/Algiers).
