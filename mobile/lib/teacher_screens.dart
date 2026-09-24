import 'package:flutter/material.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/report_detail.dart';
import 'package:ertaki_mobile/widgets.dart';

class TeacherHome extends StatefulWidget {
  const TeacherHome({super.key, required this.api, required this.me});
  final ApiClient api;
  final Map<String, dynamic> me;

  @override
  State<TeacherHome> createState() => _TeacherHomeState();
}

class _TeacherHomeState extends State<TeacherHome> {
  Map<String, dynamic>? data;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await widget.api.get('/dashboards/teacher') as Map<String, dynamic>;
      setState(() {
        data = d;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    final groups = (data?['groups'] as List<dynamic>?) ?? [];
    int missing = 0;
    int infra = 0;
    final todayReports = <Map<String, dynamic>>[];
    for (final g in groups) {
      missing += (g['missingToday'] as num?)?.toInt() ?? 0;
      infra += (g['openInfractions'] as num?)?.toInt() ?? 0;
      final tr = (g['todayReports'] as List<dynamic>?) ?? [];
      for (final r in tr) {
        todayReports.add(Map<String, dynamic>.from(r as Map));
      }
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('مرحباً ${widget.me['firstName']}', style: ui(size: 22, weight: FontWeight.w700)),
          Text('لوحة المعلم · ${data?['today']}', style: ui(size: 13, color: Brand.muted)),
          const SizedBox(height: 12),
          SoftPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('أولويات اليوم', style: ui(size: 17, weight: FontWeight.w700)),
                const SizedBox(height: 12),
                _priorityRow(Icons.mark_email_unread_outlined, 'لم يرسلوا اليوم', '$missing', ChipTone.warn),
                const SizedBox(height: 8),
                _priorityRow(Icons.warning_amber_outlined, 'تقصير مفتوح', '$infra', ChipTone.danger),
                const SizedBox(height: 8),
                _priorityRow(Icons.event_outlined, 'مجلس اليوم', groups.isEmpty ? '—' : '${(groups.first['group'] as Map)['weeklySessionDay']} ${(groups.first['group'] as Map)['weeklySessionTime']}', ChipTone.neutral),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SoftPanel(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => StaffReportsListPage(
                    api: widget.api,
                    reportDate: '${data?['today'] ?? todayIso()}',
                  ),
                ),
              );
            },
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('تقارير اليوم', style: ui(size: 16, weight: FontWeight.w700)),
                      Text(
                        todayReports.isEmpty
                            ? 'لا تقارير بعد — اضغط لفتح القائمة'
                            : '${todayReports.length} تقرير — اضغط للعرض الكامل',
                        style: ui(size: 13, color: Brand.muted),
                      ),
                    ],
                  ),
                ),
                StatusChip(
                  label: '${todayReports.length}',
                  tone: todayReports.isEmpty ? ChipTone.neutral : ChipTone.ok,
                ),
                const Icon(Icons.chevron_left, color: Brand.muted),
              ],
            ),
          ),
          if (todayReports.isNotEmpty) ...[
            const SizedBox(height: 10),
            const SectionTitle('آخر ما وصل'),
            ...todayReports.take(5).map((r) {
              final name = r['studentName'] as String? ?? 'طالب';
              return SoftPanel(
                margin: const EdgeInsets.only(bottom: 6),
                onTap: () => openDailyReportDetail(
                  context,
                  widget.api,
                  reportId: '${r['id']}',
                  report: r,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '$name · ${r['reportDate']}',
                        style: ui(weight: FontWeight.w600),
                      ),
                    ),
                    const Icon(Icons.chevron_left, size: 20, color: Brand.muted),
                  ],
                ),
              );
            }),
          ],
          const SizedBox(height: 12),
          const SectionTitle('مجموعاتي'),
          if (groups.isEmpty)
            const EmptyState(
              icon: Icons.groups_outlined,
              title: 'لا مجموعات معيّنة',
              subtitle: 'اطلب من المشرف تعيينك لمجموعة',
            )
          else
            ...groups.map((g) {
              final group = g['group'] as Map<String, dynamic>;
              final missingToday = (g['missingToday'] as num?)?.toInt() ?? 0;
              return SoftPanel(
                margin: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text('${group['name']}', style: ui(size: 16, weight: FontWeight.w700)),
                        ),
                        StatusChip(
                          label: missingToday > 0 ? '$missingToday بلا تقرير' : 'اكتمل اليوم',
                          tone: missingToday > 0 ? ChipTone.warn : ChipTone.ok,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'طلبة ${g['studentCount']} · أرسلوا ${g['submittedToday']} · تقصير ${g['openInfractions']}',
                      style: ui(size: 13, color: Brand.muted),
                    ),
                    const SizedBox(height: 8),
                    SeatBar(
                      current: (group['currentStudentCount'] as num?)?.toInt() ?? 0,
                      total: (group['seatCount'] as num?)?.toInt() ?? 0,
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _priorityRow(IconData icon, String label, String value, ChipTone tone) {
    return Row(
      children: [
        Icon(icon, color: Brand.forestMid, size: 22),
        const SizedBox(width: 10),
        Expanded(child: Text(label, style: ui(weight: FontWeight.w600))),
        StatusChip(label: value, tone: tone),
      ],
    );
  }
}

class TeacherStudents extends StatefulWidget {
  const TeacherStudents({super.key, required this.api});
  final ApiClient api;

  @override
  State<TeacherStudents> createState() => _TeacherStudentsState();
}

class _TeacherStudentsState extends State<TeacherStudents> {
  List<Map<String, dynamic>> students = [];
  Map<String, dynamic>? dash;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await widget.api.get('/dashboards/teacher') as Map<String, dynamic>;
      final groups = (d['groups'] as List<dynamic>?) ?? [];
      final list = <Map<String, dynamic>>[];
      for (final g in groups) {
        final group = g['group'] as Map<String, dynamic>;
        for (final s in (g['students'] as List<dynamic>? ?? [])) {
          list.add({
            ...Map<String, dynamic>.from(s as Map),
            'groupId': group['id'],
            'groupName': group['name'],
          });
        }
      }
      setState(() {
        dash = d;
        students = list;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    final submittedIds = <String>{};
    // Approximate: refetch daily reports for group would be better; use dashboard missing for chips via second call
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('طلبة مجموعاتي', style: ui(size: 22, weight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text('إحصاء اليوم: ${dash?['today']}', style: ui(size: 13, color: Brand.muted)),
          const SizedBox(height: 12),
          if (students.isEmpty)
            const EmptyState(
              icon: Icons.school_outlined,
              title: 'لا طلبة بعد',
              subtitle: 'سيظهر الطلبة بعد قبول طلبات الانضمام',
            )
          else
            ...students.map((s) => SoftPanel(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('${s['name']}', style: ui(weight: FontWeight.w700)),
                    subtitle: Text('${s['groupName']} · ${s['phone']}', style: ui(size: 12, color: Brand.muted)),
                    trailing: const Icon(Icons.chevron_left),
                    onTap: () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => StudentFilePage(
                            api: widget.api,
                            studentId: s['id'] as String,
                            studentName: s['name'] as String,
                            groupId: s['groupId'] as String?,
                          ),
                        ),
                      );
                      await _load();
                    },
                  ),
                )),
          // silence unused
          if (submittedIds.isEmpty) const SizedBox.shrink(),
        ],
      ),
    );
  }
}

class StudentFilePage extends StatefulWidget {
  const StudentFilePage({
    super.key,
    required this.api,
    required this.studentId,
    required this.studentName,
    this.groupId,
  });
  final ApiClient api;
  final String studentId;
  final String studentName;
  final String? groupId;

  @override
  State<StudentFilePage> createState() => _StudentFilePageState();
}

class _StudentFilePageState extends State<StudentFilePage> {
  List<dynamic> reports = [];
  List<dynamic> notes = [];
  List<dynamic> infractions = [];
  Map<String, dynamic>? quota;
  bool loading = true;
  final noteCtrl = TextEditingController();
  bool noteVisible = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await widget.api.get('/daily-reports?studentId=${widget.studentId}') as List<dynamic>;
      final n = await widget.api.get('/notes?studentId=${widget.studentId}') as List<dynamic>;
      final i = await widget.api.get('/infractions?studentId=${widget.studentId}') as List<dynamic>;
      final q = await widget.api.get('/quotas?studentId=${widget.studentId}');
      setState(() {
        reports = r;
        notes = n;
        infractions = i;
        quota = q is Map<String, dynamic> ? q : null;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _addNote() async {
    if (noteCtrl.text.trim().isEmpty) return;
    try {
      await widget.api.post('/notes', {
        'studentId': widget.studentId,
        'body': noteCtrl.text.trim(),
        'visibility': noteVisible ? 'student_visible' : 'internal',
        'noteDate': todayIso(),
      });
      noteCtrl.clear();
      showToast(context, 'تم حفظ الملاحظة');
      await _load();
    } catch (e) {
      showToast(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.studentName, style: ui(size: 18, weight: FontWeight.w700))),
      body: Atmosphere(
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  SoftPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('ملف الطالب', style: ui(size: 17, weight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        Text('القسط: ${quota?['dailyQuotaDescription'] ?? 'غير محدد'}', style: ui(color: Brand.muted)),
                        Text('تقارير: ${reports.length} · تقصير: ${infractions.length}', style: ui(color: Brand.muted)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  const SectionTitle('آخر التقارير'),
                  if (reports.isEmpty)
                    const Text('لا تقارير', style: TextStyle(color: Brand.muted))
                  else
                    ...reports.take(8).map((raw) {
                      final r = Map<String, dynamic>.from(raw as Map);
                      return SoftPanel(
                        margin: const EdgeInsets.only(bottom: 6),
                        onTap: () => openDailyReportDetail(
                          context,
                          widget.api,
                          reportId: '${r['id']}',
                          report: r,
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                '${r['reportDate']} · القسط ${r['memorizedQuota'] == true ? '✓' : '✗'} · 50 ${r['completedFiftyRepetitions'] == true ? '✓' : '✗'}',
                                style: ui(size: 13),
                              ),
                            ),
                            const Icon(Icons.chevron_left, size: 18, color: Brand.muted),
                          ],
                        ),
                      );
                    }),
                  const SizedBox(height: 8),
                  const SectionTitle('إضافة ملاحظة'),
                  SoftPanel(
                    child: Column(
                      children: [
                        TextField(
                          controller: noteCtrl,
                          maxLines: 3,
                          decoration: const InputDecoration(labelText: 'نص الملاحظة'),
                        ),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text('ظاهرة للطالب', style: ui(weight: FontWeight.w600)),
                          value: noteVisible,
                          activeColor: Brand.forestMid,
                          onChanged: (v) => setState(() => noteVisible = v),
                        ),
                        FilledButton(onPressed: _addNote, child: const Text('حفظ الملاحظة')),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  const SectionTitle('الملاحظات السابقة'),
                  ...notes.map((n) => SoftPanel(
                        margin: const EdgeInsets.only(bottom: 6),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${n['body']}', style: ui()),
                            StatusChip(
                              label: n['visibility'] == 'student_visible' ? 'ظاهرة' : 'داخلية',
                              tone: n['visibility'] == 'student_visible' ? ChipTone.ok : ChipTone.neutral,
                            ),
                          ],
                        ),
                      )),
                ],
              ),
      ),
    );
  }
}

class TeacherAttendance extends StatefulWidget {
  const TeacherAttendance({super.key, required this.api});
  final ApiClient api;

  @override
  State<TeacherAttendance> createState() => _TeacherAttendanceState();
}

class _TeacherAttendanceState extends State<TeacherAttendance> {
  List<Map<String, dynamic>> students = [];
  String? groupId;
  String? groupName;
  final Map<String, String> statusByStudent = {};
  bool loading = true;
  bool saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await widget.api.get('/dashboards/teacher') as Map<String, dynamic>;
      final groups = (d['groups'] as List<dynamic>?) ?? [];
      if (groups.isEmpty) {
        setState(() => loading = false);
        return;
      }
      final g = groups.first;
      final group = g['group'] as Map<String, dynamic>;
      final list = <Map<String, dynamic>>[];
      for (final s in (g['students'] as List<dynamic>? ?? [])) {
        list.add(Map<String, dynamic>.from(s as Map));
      }
      setState(() {
        groupId = group['id'] as String?;
        groupName = group['name'] as String?;
        students = list;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _saveAll() async {
    if (groupId == null) return;
    setState(() => saving = true);
    try {
      for (final s in students) {
        final id = s['id'] as String;
        final status = statusByStudent[id] ?? 'present';
        await widget.api.post('/attendance', {
          'studentId': id,
          'groupId': groupId,
          'sessionDate': todayIso(),
          'status': status,
        });
      }
      showToast(context, 'تم حفظ حضور مجلس اليوم');
    } catch (e) {
      showToast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (students.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          EmptyState(
            icon: Icons.event_busy_outlined,
            title: 'لا طلبة لتسجيل الحضور',
          ),
        ],
      );
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Align(
            alignment: Alignment.centerRight,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('حضور المجلس', style: ui(size: 22, weight: FontWeight.w700)),
                Text('${groupName ?? ''} · ${todayIso()}', style: ui(size: 13, color: Brand.muted)),
              ],
            ),
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: students.length,
            itemBuilder: (_, i) {
              final s = students[i];
              final id = s['id'] as String;
              final status = statusByStudent[id] ?? 'present';
              return SoftPanel(
                margin: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${s['name']}', style: ui(weight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      children: [
                        _attChip(id, 'present', 'حاضر', status),
                        _attChip(id, 'excused', 'بعذر', status),
                        _attChip(id, 'unexcused', 'بلا عذر', status),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: FilledButton(
              onPressed: saving ? null : _saveAll,
              child: Text(saving ? 'جاري الحفظ…' : 'حفظ حضور اليوم'),
            ),
          ),
        ),
      ],
    );
  }

  Widget _attChip(String id, String value, String label, String current) {
    final selected = current == value;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => setState(() => statusByStudent[id] = value),
      selectedColor: Brand.leaf.withValues(alpha: 0.25),
      labelStyle: ui(size: 13, weight: FontWeight.w600, color: selected ? Brand.forest : Brand.inkSoft),
    );
  }
}

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<dynamic> items = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final n = await widget.api.get('/notifications') as List<dynamic>;
      setState(() {
        items = n;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('الإشعارات', style: ui(size: 22, weight: FontWeight.w700)),
          const SizedBox(height: 12),
          if (items.isEmpty)
            const EmptyState(
              icon: Icons.notifications_none,
              title: 'لا إشعارات جديدة',
              subtitle: 'ستظهر هنا تنبيهات القبول والملاحظات والتقارير',
            )
          else
            ...items.map((n) {
              final item = Map<String, dynamic>.from(n as Map);
              final payload = item['payload'] is Map
                  ? Map<String, dynamic>.from(item['payload'] as Map)
                  : <String, dynamic>{};
              final reportId = payload['reportId']?.toString();
              final canOpen = item['type'] == 'daily_report_submitted' &&
                  reportId != null &&
                  reportId.isNotEmpty;
              return SoftPanel(
                margin: const EdgeInsets.only(bottom: 8),
                onTap: canOpen
                    ? () => openDailyReportDetail(
                          context,
                          widget.api,
                          reportId: reportId,
                        )
                    : null,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text('${item['title']}', style: ui(weight: FontWeight.w700)),
                        ),
                        if (canOpen)
                          Text('عرض', style: ui(size: 12, color: Brand.forestMid, weight: FontWeight.w700)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('${item['body']}', style: ui(color: Brand.muted)),
                    if (canOpen) ...[
                      const SizedBox(height: 6),
                      Text(
                        'اضغط لفتح التقرير الكامل للطالب',
                        style: ui(size: 12, color: Brand.forestMid),
                      ),
                    ],
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
