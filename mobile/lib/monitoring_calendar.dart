import 'package:flutter/material.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/report_detail.dart';
import 'package:ertaki_mobile/widgets.dart';

enum MonitoringKind { reports, attendance }

class MonitoringCalendarPage extends StatefulWidget {
  const MonitoringCalendarPage({
    super.key,
    required this.api,
    required this.kind,
    this.title,
  });

  final ApiClient api;
  final MonitoringKind kind;
  final String? title;

  @override
  State<MonitoringCalendarPage> createState() => _MonitoringCalendarPageState();
}

class _MonitoringCalendarPageState extends State<MonitoringCalendarPage> {
  late DateTime _month;
  Map<String, int> _counts = {};
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
    _load();
  }

  String get _title =>
      widget.title ??
      (widget.kind == MonitoringKind.reports
          ? 'تقويم التقارير'
          : 'تقويم الحضور');

  String _iso(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final start = DateTime(_month.year, _month.month, 1);
      final end = DateTime(_month.year, _month.month + 1, 0);
      final from = _iso(start);
      final to = _iso(end);
      final counts = <String, int>{};
      if (widget.kind == MonitoringKind.reports) {
        final list = await widget.api.get('/daily-reports?from=$from&to=$to')
            as List<dynamic>;
        for (final raw in list) {
          final d = '${(raw as Map)['reportDate']}';
          counts[d] = (counts[d] ?? 0) + 1;
        }
      } else {
        final list = await widget.api.get('/attendance?from=$from&to=$to')
            as List<dynamic>;
        for (final raw in list) {
          final d = '${(raw as Map)['sessionDate']}';
          counts[d] = (counts[d] ?? 0) + 1;
        }
      }
      if (!mounted) return;
      setState(() {
        _counts = counts;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = e.toString();
      });
    }
  }

  void _shiftMonth(int delta) {
    setState(() {
      _month = DateTime(_month.year, _month.month + delta);
    });
    _load();
  }

  Future<void> _openDay(DateTime day) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MonitoringDayPage(
          api: widget.api,
          kind: widget.kind,
          date: _iso(day),
        ),
      ),
    );
    if (mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    final monthLabel = '${_month.year}/${_month.month.toString().padLeft(2, '0')}';
    final first = DateTime(_month.year, _month.month, 1);
    // Grid starts Saturday (program week) — weekday: Mon=1 … Sat=6 Sun=7
    final lead = first.weekday == DateTime.saturday
        ? 0
        : (first.weekday == DateTime.sunday ? 1 : first.weekday + 1);
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final today = todayIso();

    return Scaffold(
      appBar: AppBar(
        title: Text(_title, style: ui(size: 18, weight: FontWeight.w700)),
      ),
      body: Atmosphere(
        child: loading && _counts.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : error != null && _counts.isEmpty
                ? ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      EmptyState(
                        icon: Icons.error_outline,
                        title: 'تعذّر تحميل التقويم',
                        subtitle: error,
                        actionLabel: 'إعادة المحاولة',
                        onAction: _load,
                      ),
                    ],
                  )
                : Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(8, 12, 8, 4),
                        child: Row(
                          children: [
                            IconButton(
                              onPressed: () => _shiftMonth(1),
                              icon: const Icon(Icons.chevron_left),
                              tooltip: 'الشهر التالي',
                            ),
                            Expanded(
                              child: Text(
                                monthLabel,
                                textAlign: TextAlign.center,
                                style: ui(size: 18, weight: FontWeight.w700),
                              ),
                            ),
                            IconButton(
                              onPressed: () => _shiftMonth(-1),
                              icon: const Icon(Icons.chevron_right),
                              tooltip: 'الشهر السابق',
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Row(
                          children: ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج']
                              .map(
                                (d) => Expanded(
                                  child: Text(
                                    d,
                                    textAlign: TextAlign.center,
                                    style: ui(
                                      size: 12,
                                      weight: FontWeight.w700,
                                      color: Brand.muted,
                                    ),
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Expanded(
                        child: GridView.builder(
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 7,
                            mainAxisSpacing: 6,
                            crossAxisSpacing: 6,
                          ),
                          itemCount: lead + daysInMonth,
                          itemBuilder: (_, i) {
                            if (i < lead) return const SizedBox.shrink();
                            final dayNum = i - lead + 1;
                            final date = DateTime(
                              _month.year,
                              _month.month,
                              dayNum,
                            );
                            final iso = _iso(date);
                            final count = _counts[iso] ?? 0;
                            final isToday = iso == today;
                            return Material(
                              color: isToday
                                  ? Brand.leaf.withValues(alpha: 0.18)
                                  : Brand.paper.withValues(alpha: 0.9),
                              borderRadius: BorderRadius.circular(12),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(12),
                                onTap: () => _openDay(date),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      '$dayNum',
                                      style: ui(
                                        size: 14,
                                        weight: FontWeight.w700,
                                        color: isToday
                                            ? Brand.forest
                                            : Brand.ink,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    if (count > 0)
                                      Container(
                                        width: 6,
                                        height: 6,
                                        decoration: const BoxDecoration(
                                          color: Brand.forestMid,
                                          shape: BoxShape.circle,
                                        ),
                                      )
                                    else
                                      const SizedBox(height: 6),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      if (loading)
                        const LinearProgressIndicator(minHeight: 2),
                    ],
                  ),
      ),
    );
  }
}

class MonitoringDayPage extends StatefulWidget {
  const MonitoringDayPage({
    super.key,
    required this.api,
    required this.kind,
    required this.date,
  });

  final ApiClient api;
  final MonitoringKind kind;
  final String date;

  @override
  State<MonitoringDayPage> createState() => _MonitoringDayPageState();
}

class _MonitoringDayPageState extends State<MonitoringDayPage> {
  bool loading = true;
  String? error;
  List<_GroupBucket> buckets = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final Map<String, _GroupBucket> map = {};
      if (widget.kind == MonitoringKind.reports) {
        final list = await widget.api
                .get('/daily-reports?reportDate=${widget.date}')
            as List<dynamic>;
        for (final raw in list) {
          final r = Map<String, dynamic>.from(raw as Map);
          final gid = '${r['groupId'] ?? r['group']?['id'] ?? '_'}';
          final gname = '${r['groupName'] ?? r['group']?['name'] ?? 'بدون مجموعة'}';
          final bucket = map.putIfAbsent(
            gid,
            () => _GroupBucket(groupId: gid, groupName: gname, items: []),
          );
          bucket.items.add(r);
        }
      } else {
        final list = await widget.api
                .get('/attendance?sessionDate=${widget.date}')
            as List<dynamic>;
        for (final raw in list) {
          final r = Map<String, dynamic>.from(raw as Map);
          final gid = '${r['groupId'] ?? '_'}';
          final gname = '${r['groupName'] ?? 'بدون مجموعة'}';
          final bucket = map.putIfAbsent(
            gid,
            () => _GroupBucket(groupId: gid, groupName: gname, items: []),
          );
          bucket.items.add(r);
        }
      }
      if (!mounted) return;
      final sorted = map.values.toList()
        ..sort((a, b) => a.groupName.compareTo(b.groupName));
      setState(() {
        buckets = sorted;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = e.toString();
      });
    }
  }

  String _statusLabel(String? s) {
    return switch (s) {
      'present' => 'حاضر',
      'excused' => 'بعذر',
      'unexcused' => 'بلا عذر',
      _ => s ?? '—',
    };
  }

  @override
  Widget build(BuildContext context) {
    final isReports = widget.kind == MonitoringKind.reports;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          isReports ? 'تقارير ${widget.date}' : 'حضور ${widget.date}',
          style: ui(size: 18, weight: FontWeight.w700),
        ),
      ),
      body: Atmosphere(
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : error != null
                ? ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      EmptyState(
                        icon: Icons.error_outline,
                        title: 'تعذّر التحميل',
                        subtitle: error,
                        actionLabel: 'إعادة المحاولة',
                        onAction: _load,
                      ),
                    ],
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        SoftPanel(
                          child: Text(
                            isReports
                                ? 'اضغط تقريراً لعرض التفاصيل · مجمّعة حسب المجموعة'
                                : 'سجلات حضور هذا اليوم · مجمّعة حسب المجموعة',
                            style: ui(size: 13, color: Brand.muted),
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (buckets.isEmpty)
                          EmptyState(
                            icon: Icons.event_busy_outlined,
                            title: isReports
                                ? 'لا تقارير لهذا اليوم'
                                : 'لا حضور لهذا اليوم',
                            subtitle: isReports
                                ? 'بعد توليد التقرير الأسبوعي تُحذف التقارير اليومية لذلك الأسبوع'
                                : 'عند حفظ حضور المجلس يظهر هنا',
                          )
                        else
                          ...buckets.expand((b) {
                            return [
                              SectionTitle(b.groupName),
                              ...b.items.map((item) {
                                if (isReports) {
                                  final name = item['studentName'] as String? ??
                                      '${(item['student'] as Map?)?['firstName'] ?? ''} ${(item['student'] as Map?)?['lastName'] ?? ''}'
                                          .trim();
                                  return SoftPanel(
                                    margin: const EdgeInsets.only(bottom: 8),
                                    onTap: () => openDailyReportDetail(
                                      context,
                                      widget.api,
                                      reportId: '${item['id']}',
                                      report: item,
                                    ),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            name.isEmpty ? 'طالب' : name,
                                            style: ui(
                                              size: 15,
                                              weight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                        const Icon(
                                          Icons.chevron_left,
                                          color: Brand.muted,
                                        ),
                                      ],
                                    ),
                                  );
                                }
                                final name =
                                    item['studentName'] as String? ?? 'طالب';
                                return SoftPanel(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          name,
                                          style: ui(
                                            size: 15,
                                            weight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                      StatusChip(
                                        label: _statusLabel(
                                          '${item['status']}',
                                        ),
                                        tone: item['status'] == 'present'
                                            ? ChipTone.ok
                                            : item['status'] == 'excused'
                                                ? ChipTone.warn
                                                : ChipTone.danger,
                                      ),
                                    ],
                                  ),
                                );
                              }),
                              const SizedBox(height: 8),
                            ];
                          }),
                      ],
                    ),
                  ),
      ),
    );
  }
}

class _GroupBucket {
  _GroupBucket({
    required this.groupId,
    required this.groupName,
    required this.items,
  });
  final String groupId;
  final String groupName;
  final List<Map<String, dynamic>> items;
}
