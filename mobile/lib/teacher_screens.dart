import 'package:flutter/material.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/groups_catalog.dart';
import 'package:ertaki_mobile/hub_menu.dart';
import 'package:ertaki_mobile/monitoring_calendar.dart';
import 'package:ertaki_mobile/report_detail.dart';
import 'package:ertaki_mobile/widgets.dart';

class TeacherHome extends StatefulWidget {
  const TeacherHome({
    super.key,
    required this.api,
    required this.me,
    this.onSelectTab,
    this.refreshTick,
  });
  final ApiClient api;
  final Map<String, dynamic> me;
  /// Switch shell bottom-nav tab (students=1, attendance=2, notifications=3).
  final ValueChanged<int>? onSelectTab;
  /// Shell bumps this when the home tab is shown / app resumes / home re-tapped.
  final ValueNotifier<int>? refreshTick;

  @override
  State<TeacherHome> createState() => _TeacherHomeState();
}

class _TeacherHomeState extends State<TeacherHome> with RouteAware {
  Map<String, dynamic>? data;
  bool loading = true;
  bool _routeSubscribed = false;

  @override
  void initState() {
    super.initState();
    widget.refreshTick?.addListener(_onRefreshTick);
    _load();
  }

  @override
  void didUpdateWidget(covariant TeacherHome oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshTick != widget.refreshTick) {
      oldWidget.refreshTick?.removeListener(_onRefreshTick);
      widget.refreshTick?.addListener(_onRefreshTick);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (!_routeSubscribed && route is PageRoute) {
      hubRouteObserver.subscribe(this, route);
      _routeSubscribed = true;
    }
  }

  @override
  void dispose() {
    widget.refreshTick?.removeListener(_onRefreshTick);
    if (_routeSubscribed) {
      hubRouteObserver.unsubscribe(this);
    }
    super.dispose();
  }

  void _onRefreshTick() {
    if (mounted) _load(quiet: true);
  }

  @override
  void didPopNext() {
    _load(quiet: true);
  }

  Future<void> _load({bool quiet = false}) async {
    try {
      final d = await widget.api.get('/dashboards/teacher') as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        data = d;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      if (!quiet || data == null) {
        setState(() => loading = false);
      }
      if (mounted && !quiet) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _open(Widget page) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ColoredBox(color: Brand.mist, child: page),
      ),
    );
    if (mounted) await _load(quiet: true);
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    final groups = (data?['groups'] as List<dynamic>?) ?? [];
    final badges = (data?['badges'] as Map?) ?? {};
    int missing = 0;
    int infra = 0;
    for (final g in groups) {
      missing += (g['missingToday'] as num?)?.toInt() ?? 0;
      infra += (g['openInfractions'] as num?)?.toInt() ?? 0;
    }
    final pendingJoins = (badges['pendingJoins'] as num?)?.toInt() ?? 0;
    final submittedToday = (badges['todaySubmittedReports'] as num?)?.toInt() ??
        groups.fold<int>(
          0,
          (sum, g) => sum + ((g['submittedToday'] as num?)?.toInt() ?? 0),
        );
    final unreadNotifs = (badges['unreadNotifications'] as num?)?.toInt() ?? 0;

    return RefreshIndicator(
      onRefresh: _load,
      child: RoleHubHome(
        title: 'مرحباً ${widget.me['firstName']}',
        subtitle: 'لوحة المعلم · ${data?['today'] ?? ''}',
        header: SoftPanel(
          child: Row(
            children: [
              Expanded(
                child: Text(
                  missing > 0 ? '$missing بلا تقرير اليوم' : 'تقارير اليوم مكتملة',
                  style: ui(weight: FontWeight.w700),
                ),
              ),
              StatusChip(
                label: infra > 0 ? '$infra تقصير' : 'لا تقصير',
                tone: infra > 0 ? ChipTone.danger : ChipTone.ok,
              ),
            ],
          ),
        ),
        categories: [
          HubCategory(
            icon: Icons.groups_outlined,
            label: 'مجموعاتي',
            subtitle: 'موجز وتفصيلي · تعديل',
            onTap: () => _open(TeacherGroupsPage(api: widget.api)),
          ),
          HubCategory(
            icon: Icons.school_outlined,
            label: 'الطلبة',
            subtitle: 'حسب المجموعة فقط',
            onTap: () {
              if (widget.onSelectTab != null) {
                widget.onSelectTab!(1);
              } else {
                _open(TeacherStudents(api: widget.api));
              }
            },
          ),
          HubCategory(
            icon: Icons.how_to_reg_outlined,
            label: 'طلبات الانضمام',
            subtitle: 'قبول أو رفض',
            badgeCount: pendingJoins,
            onTap: () => _open(TeacherJoinsPage(api: widget.api)),
          ),
          HubCategory(
            icon: Icons.event_available_outlined,
            label: 'الحضور الأسبوعي',
            subtitle: 'مجلس الأسبوع',
            onTap: () {
              if (widget.onSelectTab != null) {
                widget.onSelectTab!(2);
              } else {
                _open(TeacherAttendance(api: widget.api));
              }
            },
          ),
          HubCategory(
            icon: Icons.insights_outlined,
            label: 'التقارير',
            subtitle: 'يومي وأسبوعي',
            badgeCount: submittedToday,
            onTap: () => _open(TeacherReportsHub(api: widget.api, today: '${data?['today'] ?? todayIso()}')),
          ),
          HubCategory(
            icon: Icons.add_circle_outline,
            label: 'إنشاء مجموعة',
            subtitle: 'يحتاج موافقة المشرف',
            onTap: () async {
              final ok = await Navigator.of(context).push<bool>(
                MaterialPageRoute(builder: (_) => CreateGroupPage(api: widget.api)),
              );
              if (ok == true) await _load(quiet: true);
            },
          ),
          HubCategory(
            icon: Icons.notifications_outlined,
            label: 'الإشعارات',
            badgeCount: unreadNotifs,
            onTap: () {
              if (widget.onSelectTab != null) {
                widget.onSelectTab!(3);
              }
            },
          ),
        ],
      ),
    );
  }
}

class TeacherGroupsPage extends StatefulWidget {
  const TeacherGroupsPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<TeacherGroupsPage> createState() => _TeacherGroupsPageState();
}

class _TeacherGroupsPageState extends State<TeacherGroupsPage> {
  List<dynamic> groups = [];
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
        groups = (d['groups'] as List<dynamic>?) ?? [];
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('مجموعاتي', style: ui(size: 18, weight: FontWeight.w700))),
      body: Atmosphere(
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (groups.isEmpty)
                      const EmptyState(icon: Icons.groups_outlined, title: 'لا مجموعات بعد')
                    else
                      ...groups.map((g) {
                        final group = Map<String, dynamic>.from(g['group'] as Map);
                        return SoftPanel(
                          margin: const EdgeInsets.only(bottom: 8),
                          onTap: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => GroupDetailPage(
                                  api: widget.api,
                                  groupId: '${group['id']}',
                                  groupName: '${group['name']}',
                                ),
                              ),
                            );
                          },
                          child: Row(
                            children: [
                              Expanded(
                                child: Text('${group['name']}', style: ui(weight: FontWeight.w700)),
                              ),
                              StatusChip(
                                label: '${g['studentCount'] ?? 0} طالب',
                                tone: ChipTone.neutral,
                              ),
                              const Icon(Icons.chevron_left, color: Brand.muted),
                            ],
                          ),
                        );
                      }),
                  ],
                ),
              ),
      ),
    );
  }
}

class TeacherReportsHub extends StatelessWidget {
  const TeacherReportsHub({super.key, required this.api, required this.today});
  final ApiClient api;
  final String today;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('التقارير', style: ui(size: 18, weight: FontWeight.w700))),
      body: Atmosphere(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            SoftPanel(
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => MonitoringCalendarPage(
                      api: api,
                      kind: MonitoringKind.reports,
                      title: 'تقويم التقارير اليومية',
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
                        Text('تقويم التقارير', style: ui(size: 16, weight: FontWeight.w700)),
                        Text(
                          'اضغط يوماً · مجمّعة حسب المجموعة · اليوم $today',
                          style: ui(size: 13, color: Brand.muted),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.calendar_month_outlined, color: Brand.muted),
                ],
              ),
            ),
            const SizedBox(height: 8),
            SoftPanel(
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => WeeklyReportsPage(api: api)),
                );
              },
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('التقارير الأسبوعية', style: ui(size: 16, weight: FontWeight.w700)),
                        Text(
                          'بعد حفظ حضور المجلس · مجمّعة حسب المجموعة · تُحذف اليومية لذلك الأسبوع',
                          style: ui(size: 13, color: Brand.muted),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_left, color: Brand.muted),
                ],
              ),
            ),
            const SizedBox(height: 8),
            SoftPanel(
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => TrimestrialReportsPage(api: api),
                  ),
                );
              },
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('التقارير الفصلية', style: ui(size: 16, weight: FontWeight.w700)),
                        Text(
                          'كل 3 أشهر · تجميع الأسبوعي · مجمّعة حسب المجموعة',
                          style: ui(size: 13, color: Brand.muted),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_left, color: Brand.muted),
                ],
              ),
            ),
          ],
        ),
      ),
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
  List<Map<String, dynamic>> groupBlocks = [];
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
      final blocks = <Map<String, dynamic>>[];
      final seenIds = <String>{};
      for (final g in groups) {
        final group = Map<String, dynamic>.from(g['group'] as Map);
        final students = <Map<String, dynamic>>[];
        for (final raw in (g['students'] as List<dynamic>? ?? [])) {
          final s = Map<String, dynamic>.from(raw as Map);
          final sid = '${s['id']}';
          if (seenIds.contains(sid)) continue;
          seenIds.add(sid);
          students.add({
            ...s,
            'groupId': group['id'],
            'groupName': group['name'],
          });
        }
        blocks.add({'group': group, 'students': students});
      }
      setState(() {
        dash = d;
        groupBlocks = blocks;
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
    final asPage = ModalRoute.of(context)?.isFirst == false;
    final body = RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  asPage ? 'الطلبة' : 'طلبة حسب المجموعة',
                  style: ui(size: 22, weight: FontWeight.w700),
                ),
              ),
              IconButton(
                tooltip: 'إنشاء مجموعة',
                onPressed: () async {
                  final ok = await Navigator.of(context).push<bool>(
                    MaterialPageRoute(builder: (_) => CreateGroupPage(api: widget.api)),
                  );
                  if (ok == true) await _load();
                },
                icon: const Icon(Icons.add_circle_outline),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'كل طالب يظهر داخل مجموعته فقط · ${dash?['today'] ?? ''}',
            style: ui(size: 13, color: Brand.muted),
          ),
          const SizedBox(height: 14),
          if (groupBlocks.isEmpty)
            const EmptyState(
              icon: Icons.school_outlined,
              title: 'لا مجموعات بعد',
              subtitle: 'أنشئ مجموعة أو انتظر تعيين المشرف',
            )
          else
            ...groupBlocks.map((block) {
              final group = block['group'] as Map<String, dynamic>;
              final students = block['students'] as List<Map<String, dynamic>>;
              final status = '${group['status'] ?? ''}';
              return SoftPanel(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    InkWell(
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => GroupDetailPage(
                              api: widget.api,
                              groupId: '${group['id']}',
                              groupName: '${group['name']}',
                            ),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            const Icon(Icons.groups_rounded, color: Brand.forestMid),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('${group['name']}', style: ui(size: 17, weight: FontWeight.w700)),
                                  Text(
                                    status == 'pending_approval'
                                        ? 'بانتظار موافقة المشرف · موجز / تفصيلي'
                                        : 'اضغط لعرض المجموعة',
                                    style: ui(size: 12, color: Brand.muted),
                                  ),
                                ],
                              ),
                            ),
                            StatusChip(
                              label: '${students.length} طالب',
                              tone: ChipTone.neutral,
                            ),
                            const Icon(Icons.chevron_left, color: Brand.muted),
                          ],
                        ),
                      ),
                    ),
                    if (students.isEmpty)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(8, 10, 4, 6),
                        child: Text(
                          'لا طلبة في هذه المجموعة بعد',
                          style: ui(size: 13, color: Brand.muted),
                        ),
                      )
                    else ...[
                      const SizedBox(height: 8),
                      const Divider(height: 1, color: Brand.line),
                      ...students.asMap().entries.map((entry) {
                        final i = entry.key;
                        final s = entry.value;
                        return Column(
                          children: [
                            if (i > 0)
                              const Divider(height: 1, color: Brand.line),
                            InkWell(
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
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
                                child: Row(
                                  children: [
                                    const SizedBox(width: 8),
                                    const Icon(Icons.person_outline, color: Brand.forestMid, size: 22),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text('${s['name']}', style: ui(weight: FontWeight.w700)),
                                          Text('${s['phone']}', style: ui(size: 12, color: Brand.muted)),
                                        ],
                                      ),
                                    ),
                                    const Icon(Icons.chevron_left, color: Brand.muted, size: 20),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        );
                      }),
                    ],
                  ],
                ),
              );
            }),
        ],
      ),
    );
    if (!asPage) return body;
    return Scaffold(
      backgroundColor: Brand.mist,
      appBar: AppBar(
        title: Text('الطلبة', style: ui(size: 18, weight: FontWeight.w700)),
      ),
      body: Atmosphere(child: body),
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
  @override
  Widget build(BuildContext context) {
    final asPage = ModalRoute.of(context)?.isFirst == false;
    final body = ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (!asPage)
          Text('الحضور', style: ui(size: 22, weight: FontWeight.w700)),
        SoftPanel(
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => MonitoringCalendarPage(
                  api: widget.api,
                  kind: MonitoringKind.attendance,
                  title: 'تقويم الحضور',
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
                    Text('تقويم الحضور', style: ui(size: 16, weight: FontWeight.w700)),
                    Text(
                      'اضغط يوماً لعرض الحضور مجمّعاً حسب المجموعة',
                      style: ui(size: 13, color: Brand.muted),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.calendar_month_outlined, color: Brand.muted),
            ],
          ),
        ),
        const SizedBox(height: 8),
        SoftPanel(
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => TeacherAttendanceMarkPage(api: widget.api),
              ),
            );
          },
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('تسجيل حضور المجلس الأسبوعي', style: ui(size: 16, weight: FontWeight.w700)),
                    Text(
                      'حفظ الحضور يولّد التقارير الأسبوعية ويحذف اليومية لذلك الأسبوع',
                      style: ui(size: 13, color: Brand.muted),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_left, color: Brand.muted),
            ],
          ),
        ),
      ],
    );
    if (!asPage) return body;
    return Scaffold(
      backgroundColor: Brand.mist,
      appBar: AppBar(
        title: Text('الحضور', style: ui(size: 18, weight: FontWeight.w700)),
      ),
      body: Atmosphere(child: body),
    );
  }
}

class TeacherAttendanceMarkPage extends StatefulWidget {
  const TeacherAttendanceMarkPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<TeacherAttendanceMarkPage> createState() =>
      _TeacherAttendanceMarkPageState();
}

class _TeacherAttendanceMarkPageState extends State<TeacherAttendanceMarkPage> {
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
      final entries = students.map((s) {
        final id = s['id'] as String;
        return {
          'studentId': id,
          'status': statusByStudent[id] ?? 'present',
        };
      }).toList();
      final res = await widget.api.post('/attendance/weekly', {
        'groupId': groupId,
        'sessionDate': todayIso(),
        'entries': entries,
      }) as Map<String, dynamic>;
      final n = (res['generated'] as num?)?.toInt() ?? entries.length;
      showToast(
        context,
        'تم حفظ الحضور وتوليد $n تقريراً أسبوعياً · حُذفت التقارير اليومية لهذا الأسبوع',
      );
    } catch (e) {
      showToast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Scaffold(
        appBar: AppBar(
          title: Text('حضور المجلس الأسبوعي', style: ui(size: 18, weight: FontWeight.w700)),
        ),
        body: const Atmosphere(child: Center(child: CircularProgressIndicator())),
      );
    }
    Widget body;
    if (students.isEmpty) {
      body = ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          EmptyState(
            icon: Icons.event_busy_outlined,
            title: 'لا طلبة لتسجيل الحضور',
          ),
        ],
      );
    } else {
      body = Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Align(
              alignment: Alignment.centerRight,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${groupName ?? ''} · أسبوع ${todayIso()}', style: ui(size: 13, color: Brand.muted)),
                  Text(
                    'بعد الحفظ تُولَّد التقارير الأسبوعية وتُحذف اليومية لذلك الأسبوع',
                    style: ui(size: 12, color: Brand.muted),
                  ),
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
                child: Text(saving ? 'جاري الحفظ…' : 'حفظ الحضور الأسبوعي'),
              ),
            ),
          ),
        ],
      );
    }
    return Scaffold(
      backgroundColor: Brand.mist,
      appBar: AppBar(
        title: Text('حضور المجلس الأسبوعي', style: ui(size: 18, weight: FontWeight.w700)),
      ),
      body: Atmosphere(child: body),
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
