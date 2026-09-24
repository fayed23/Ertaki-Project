import 'package:flutter/material.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/widgets.dart';

Future<void> openDailyReportDetail(
  BuildContext context,
  ApiClient api, {
  String? reportId,
  Map<String, dynamic>? report,
}) {
  return Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => DailyReportDetailPage(
        api: api,
        reportId: reportId,
        initial: report,
      ),
    ),
  );
}

class DailyReportDetailPage extends StatefulWidget {
  const DailyReportDetailPage({
    super.key,
    required this.api,
    this.reportId,
    this.initial,
  });
  final ApiClient api;
  final String? reportId;
  final Map<String, dynamic>? initial;

  @override
  State<DailyReportDetailPage> createState() => _DailyReportDetailPageState();
}

class _DailyReportDetailPageState extends State<DailyReportDetailPage> {
  Map<String, dynamic>? report;
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    report = widget.initial;
    _load();
  }

  Future<void> _load() async {
    final id = widget.reportId ?? widget.initial?['id']?.toString();
    if (id == null || id.isEmpty) {
      setState(() {
        loading = false;
        error = report == null ? 'معرّف التقرير غير متوفر' : null;
      });
      return;
    }
    try {
      final r = await widget.api.get('/daily-reports/$id') as Map<String, dynamic>;
      setState(() {
        report = r;
        loading = false;
        error = null;
      });
    } catch (e) {
      setState(() {
        loading = false;
        if (report == null) error = e.toString();
      });
      if (mounted && report == null) {
        showToast(context, e.toString(), error: true);
      }
    }
  }

  String _yn(bool? v) => v == true ? 'نعم' : 'لا';

  @override
  Widget build(BuildContext context) {
    final r = report;
    final name = r == null
        ? ''
        : (r['studentName'] as String? ??
            '${(r['student'] as Map?)?['firstName'] ?? ''} ${(r['student'] as Map?)?['lastName'] ?? ''}'
                .trim());
    final groupName =
        r?['groupName'] as String? ?? (r?['group'] as Map?)?['name'] as String?;

    return Scaffold(
      appBar: AppBar(
        title: Text('تفاصيل التقرير', style: ui(size: 18, weight: FontWeight.w700)),
      ),
      body: Atmosphere(
        child: loading && r == null
            ? const Center(child: CircularProgressIndicator())
            : error != null && r == null
                ? Center(child: Text(error!, style: ui(color: Brand.danger)))
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        SoftPanel(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name.isEmpty ? 'طالب' : name,
                                style: ui(size: 20, weight: FontWeight.w800),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'تاريخ التقرير: ${r?['reportDate'] ?? '—'}',
                                style: ui(size: 14, color: Brand.muted),
                              ),
                              if (groupName != null && groupName.isNotEmpty)
                                Text(
                                  'المجموعة: $groupName',
                                  style: ui(size: 14, color: Brand.muted),
                                ),
                              if (r?['submittedAt'] != null)
                                Text(
                                  'أُرسل: ${r!['submittedAt']}',
                                  style: ui(size: 12, color: Brand.muted),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),
                        const SectionTitle('حفظ القسط'),
                        SoftPanel(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _row('حفظ القسط اليومي', _yn(r?['memorizedQuota'] as bool?)),
                              if (r?['memorizationSurahName'] != null || r?['memorizationSurahNumber'] != null)
                                _row(
                                  'السورة (قالون)',
                                  '${r?['memorizationSurahNumber'] ?? ''} · ${r?['memorizationSurahName'] ?? ''}',
                                ),
                              if (r?['memorizationAyahFrom'] != null)
                                _row(
                                  'الآيات',
                                  '${r?['memorizationAyahFrom']} → ${r?['memorizationAyahTo']}',
                                ),
                              _row(
                                'وقت من',
                                '${r?['memorizationFrom'] ?? '—'}',
                              ),
                              _row(
                                'وقت إلى',
                                '${r?['memorizationTo'] ?? '—'}',
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        const SectionTitle('ورد المراجعة'),
                        SoftPanel(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _row('الورد', '${r?['reviewPortion'] ?? '—'}'),
                              _row('من', '${r?['reviewFrom'] ?? '—'}'),
                              _row('إلى', '${r?['reviewTo'] ?? '—'}'),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        const SectionTitle('التكرار والتفسير'),
                        SoftPanel(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _row(
                                'أكمل 50 تكراراً',
                                _yn(r?['completedFiftyRepetitions'] as bool?),
                              ),
                              _row(
                                'في مجلس واحد',
                                _yn(r?['repeatedInOneSitting'] as bool?),
                              ),
                              _row(
                                'قرأ التفسير',
                                _yn(r?['readTafsir'] as bool?),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(label, style: ui(color: Brand.muted))),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              style: ui(weight: FontWeight.w700),
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }
}

class StaffReportsListPage extends StatefulWidget {
  const StaffReportsListPage({
    super.key,
    required this.api,
    this.title = 'تقارير اليوم',
    this.reportDate,
  });
  final ApiClient api;
  final String title;
  final String? reportDate;

  @override
  State<StaffReportsListPage> createState() => _StaffReportsListPageState();
}

class _StaffReportsListPageState extends State<StaffReportsListPage> {
  List<dynamic> reports = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final date = widget.reportDate ?? todayIso();
      final r = await widget.api.get('/daily-reports?reportDate=$date') as List<dynamic>;
      setState(() {
        reports = r;
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
      appBar: AppBar(
        title: Text(widget.title, style: ui(size: 18, weight: FontWeight.w700)),
      ),
      body: Atmosphere(
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(
                      'اضغط تقريراً لعرض كل الحقول واسم الطالب',
                      style: ui(size: 13, color: Brand.muted),
                    ),
                    const SizedBox(height: 12),
                    if (reports.isEmpty)
                      const EmptyState(
                        icon: Icons.inbox_outlined,
                        title: 'لا تقارير لهذا اليوم',
                        subtitle: 'عندما يرسل طالب تقريراً سيظهر هنا',
                      )
                    else
                      ...reports.map((raw) {
                        final r = Map<String, dynamic>.from(raw as Map);
                        final name = r['studentName'] as String? ??
                            '${(r['student'] as Map?)?['firstName'] ?? ''} ${(r['student'] as Map?)?['lastName'] ?? ''}'
                                .trim();
                        return SoftPanel(
                          margin: const EdgeInsets.only(bottom: 8),
                          onTap: () => openDailyReportDetail(
                            context,
                            widget.api,
                            reportId: '${r['id']}',
                            report: r,
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name.isEmpty ? 'طالب' : name,
                                      style: ui(size: 16, weight: FontWeight.w700),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${r['reportDate']} · ${r['groupName'] ?? r['group']?['name'] ?? '—'}',
                                      style: ui(size: 13, color: Brand.muted),
                                    ),
                                  ],
                                ),
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
