import 'package:flutter/material.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/notify.dart';
import 'package:ertaki_mobile/widgets.dart';
import 'package:url_launcher/url_launcher.dart';

class StudentHome extends StatefulWidget {
  const StudentHome({
    super.key,
    required this.api,
    required this.me,
    required this.onGoReport,
  });
  final ApiClient api;
  final Map<String, dynamic> me;
  final VoidCallback onGoReport;

  @override
  State<StudentHome> createState() => _StudentHomeState();
}

class _StudentHomeState extends State<StudentHome> {
  Map<String, dynamic>? membership;
  List<dynamic> reports = [];
  List<dynamic> notes = [];
  Map<String, dynamic>? quota;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final m = await widget.api.get('/memberships/me');
      final r = await widget.api.get('/daily-reports') as List<dynamic>;
      final n = await widget.api.get('/notes') as List<dynamic>;
      final q = await widget.api.get('/quotas');
      setState(() {
        membership = m is Map<String, dynamic> ? m : null;
        reports = r;
        notes = n;
        quota = q is Map<String, dynamic> ? q : null;
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
    final group = membership?['group'] as Map<String, dynamic>?;
    final submitted = reports.any((r) => r['reportDate'] == todayIso());

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Text('مرحباً ${widget.me['firstName']}', style: ui(size: 22, weight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(
            group == null ? 'لم تُقبل في مجموعة بعد' : '${group['name']}',
            style: ui(size: 13, color: Brand.muted),
          ),
          const SizedBox(height: 14),
          SoftPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        submitted ? 'تم إرسال تقرير اليوم' : 'تقرير اليوم بانتظارك',
                        style: ui(size: 17, weight: FontWeight.w700),
                      ),
                    ),
                    StatusChip(
                      label: submitted ? 'مُرسل' : 'مطلوب',
                      tone: submitted ? ChipTone.ok : ChipTone.warn,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'القسط: ${quota?['dailyQuotaDescription'] ?? 'يحدده المعلم'}',
                  style: ui(size: 13, color: Brand.muted),
                ),
                const SizedBox(height: 14),
                FilledButton.icon(
                  onPressed: submitted ? null : widget.onGoReport,
                  icon: Icon(submitted ? Icons.check_circle_outline : Icons.send_rounded),
                  label: Text(submitted ? 'أُرسل اليوم' : 'أرسل تقرير اليوم'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const SectionTitle('ملاحظات المعلم'),
          if (notes.isEmpty)
            EmptyState(
              icon: Icons.mark_email_read_outlined,
              title: 'لا ملاحظات ظاهرة حالياً',
              subtitle: 'ستظهر هنا الملاحظات التي يشاركها معلمك معك',
            )
          else
            ...notes.map(
              (n) => SoftPanel(
                margin: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${n['body']}', style: ui()),
                    const SizedBox(height: 6),
                    Text('${n['noteDate']}', style: ui(size: 12, color: Brand.muted)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class StudentGroup extends StatefulWidget {
  const StudentGroup({super.key, required this.api});
  final ApiClient api;

  @override
  State<StudentGroup> createState() => _StudentGroupState();
}

class _StudentGroupState extends State<StudentGroup> {
  Map<String, dynamic>? membership;
  bool loading = true;
  final excuseCtrl = TextEditingController();
  bool sendingExcuse = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    excuseCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final m = await widget.api.get('/memberships/me');
      setState(() {
        membership = m is Map<String, dynamic> ? m : null;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _sendExcuse() async {
    final group = membership?['group'] as Map<String, dynamic>?;
    if (group == null || excuseCtrl.text.trim().isEmpty) return;
    setState(() => sendingExcuse = true);
    try {
      await widget.api.post('/excuse-requests', {
        'groupId': group['id'],
        'sessionDate': todayIso(),
        'reason': excuseCtrl.text.trim(),
      });
      excuseCtrl.clear();
      if (mounted) showToast(context, 'تم إرسال طلب العذر للمعلم والمشرف');
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => sendingExcuse = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    final group = membership?['group'] as Map<String, dynamic>?;
    final teacher = group?['teacher'] as Map<String, dynamic>?;
    if (group == null) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          EmptyState(
            icon: Icons.groups_outlined,
            title: 'لست منضماً لمجموعة',
            subtitle: 'اطلب الانضمام عبر تعريف البرنامج ولوحة المشرف',
          ),
        ],
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('مجموعتي', style: ui(size: 22, weight: FontWeight.w700)),
        const SizedBox(height: 12),
        SoftPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${group['name']}', style: brandStyle(size: 28)),
              const SizedBox(height: 8),
              StatusChip(label: '${group['status']}', tone: ChipTone.ok),
              const SizedBox(height: 10),
              Text('${group['weeklySessionDay']} · ${group['weeklySessionTime']}', style: ui(weight: FontWeight.w600)),
              Text(
                'المعلم: ${teacher?['firstName'] ?? ''} ${teacher?['lastName'] ?? ''}',
                style: ui(color: Brand.muted),
              ),
              const SizedBox(height: 10),
              SeatBar(
                current: (group['currentStudentCount'] as num?)?.toInt() ?? 0,
                total: (group['seatCount'] as num?)?.toInt() ?? 0,
              ),
              if (group['whatsappUrl'] != null) ...[
                const SizedBox(height: 14),
                FilledButton.tonal(
                  style: FilledButton.styleFrom(
                    backgroundColor: Brand.goldSoft,
                    foregroundColor: Brand.inkSoft,
                    minimumSize: const Size(48, 48),
                  ),
                  onPressed: () => launchUrl(
                    Uri.parse(group['whatsappUrl']),
                    mode: LaunchMode.externalApplication,
                  ),
                  child: const Text('فتح واتساب المجموعة'),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),
        const SectionTitle('طلب عذر غياب'),
        SoftPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: excuseCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'سبب العذر (مجلس اليوم)',
                ),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: sendingExcuse ? null : _sendExcuse,
                child: Text(sendingExcuse ? 'جاري الإرسال…' : 'إرسال العذر'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class StudentDailyReport extends StatefulWidget {
  const StudentDailyReport({super.key, required this.api, this.onSubmitted});
  final ApiClient api;
  final Future<void> Function()? onSubmitted;

  @override
  State<StudentDailyReport> createState() => _StudentDailyReportState();
}

class _StudentDailyReportState extends State<StudentDailyReport> {
  int step = 0;
  bool memorizedQuota = true;
  bool fifty = true;
  bool oneSitting = true;
  bool tafsir = false;
  final reviewCtrl = TextEditingController(text: 'الحزب 1');
  bool loading = false;
  bool alreadySubmitted = false;
  bool checking = true;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    try {
      final reports = await widget.api.get('/daily-reports') as List<dynamic>;
      setState(() {
        alreadySubmitted = reports.any((r) => r['reportDate'] == todayIso());
        checking = false;
      });
    } catch (_) {
      setState(() => checking = false);
    }
  }

  Future<void> submit() async {
    setState(() => loading = true);
    try {
      await widget.api.post('/daily-reports', {
        'reportDate': todayIso(),
        'memorizedQuota': memorizedQuota,
        'reviewPortion': reviewCtrl.text.trim(),
        'completedFiftyRepetitions': fifty,
        'repeatedInOneSitting': oneSitting,
        'readTafsir': tafsir,
      });
      setState(() => alreadySubmitted = true);
      await NotifyHub.instance.cancelDeadlineReminder();
      await widget.onSubmitted?.call();
      if (mounted) showToast(context, 'تم إرسال التقرير — لا يمكن تعديله');
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (checking) return const Center(child: CircularProgressIndicator());
    if (alreadySubmitted) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          EmptyState(
            icon: Icons.lock_outline,
            title: 'تقرير اليوم مُرسل',
            subtitle: 'لا تعديل بعد الإرسال حسب قواعد البرنامج',
          ),
        ],
      );
    }

    final steps = ['الحفظ', 'المراجعة', 'التكرار والتفسير', 'إرسال'];
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('التقرير اليومي', style: ui(size: 22, weight: FontWeight.w700)),
              const SizedBox(height: 8),
              Row(
                children: List.generate(steps.length, (i) {
                  final active = i <= step;
                  return Expanded(
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      height: 6,
                      decoration: BoxDecoration(
                        color: active ? Brand.forestMid : Brand.mistDeep,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 6),
              Text(steps[step], style: ui(size: 13, color: Brand.muted, weight: FontWeight.w600)),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              SoftPanel(
                child: switch (step) {
                  0 => SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      activeColor: Brand.forestMid,
                      title: Text('حفظت القسط اليومي', style: ui(weight: FontWeight.w700)),
                      value: memorizedQuota,
                      onChanged: (v) => setState(() => memorizedQuota = v),
                    ),
                  1 => TextField(
                      controller: reviewCtrl,
                      decoration: const InputDecoration(labelText: 'ورد المراجعة'),
                    ),
                  2 => Column(
                      children: [
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          activeColor: Brand.forestMid,
                          title: Text('أكملت 50 تكراراً', style: ui(weight: FontWeight.w700)),
                          value: fifty,
                          onChanged: (v) => setState(() => fifty = v),
                        ),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          activeColor: Brand.forestMid,
                          title: Text('التكرار في مجلس واحد', style: ui(weight: FontWeight.w700)),
                          value: oneSitting,
                          onChanged: (v) => setState(() => oneSitting = v),
                        ),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          activeColor: Brand.forestMid,
                          title: Text('قرأت ورد التفسير', style: ui(weight: FontWeight.w700)),
                          value: tafsir,
                          onChanged: (v) => setState(() => tafsir = v),
                        ),
                      ],
                    ),
                  _ => Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('مراجعة قبل الإرسال', style: ui(weight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Text('القسط: ${memorizedQuota ? 'نعم' : 'لا'}', style: ui()),
                        Text('المراجعة: ${reviewCtrl.text}', style: ui()),
                        Text('50 تكرار: ${fifty ? 'نعم' : 'لا'}', style: ui()),
                        Text('مجلس واحد: ${oneSitting ? 'نعم' : 'لا'}', style: ui()),
                        Text('تفسير: ${tafsir ? 'نعم' : 'لا'}', style: ui()),
                      ],
                    ),
                },
              ),
            ],
          ),
        ),
        SafeArea(
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            decoration: const BoxDecoration(
              color: Brand.paper,
              border: Border(top: BorderSide(color: Brand.line)),
            ),
            child: Row(
              children: [
                if (step > 0)
                  OutlinedButton(
                    onPressed: () => setState(() => step--),
                    child: const Text('رجوع'),
                  ),
                const Spacer(),
                if (step < 3)
                  FilledButton(
                    onPressed: () => setState(() => step++),
                    child: const Text('التالي'),
                  )
                else
                  FilledButton(
                    onPressed: loading ? null : submit,
                    child: Text(loading ? 'جاري الإرسال…' : 'إرسال التقرير'),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class StudentProgress extends StatefulWidget {
  const StudentProgress({super.key, required this.api, required this.me});
  final ApiClient api;
  final Map<String, dynamic> me;

  @override
  State<StudentProgress> createState() => _StudentProgressState();
}

class _StudentProgressState extends State<StudentProgress> {
  List<dynamic> reports = [];
  List<dynamic> weekly = [];
  List<dynamic> infractions = [];
  List<dynamic> notes = [];
  List<dynamic> notifs = [];
  Map<String, dynamic>? quota;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await widget.api.get('/daily-reports') as List<dynamic>;
      final w = await widget.api.get('/weekly-reports') as List<dynamic>;
      final i = await widget.api.get('/infractions') as List<dynamic>;
      final n = await widget.api.get('/notes') as List<dynamic>;
      final nf = await widget.api.get('/notifications') as List<dynamic>;
      final q = await widget.api.get('/quotas');
      setState(() {
        reports = r;
        weekly = w;
        infractions = i;
        notes = n;
        notifs = nf;
        quota = q is Map<String, dynamic> ? q : null;
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
    final quotaMet = reports.where((r) => r['memorizedQuota'] == true).length;
    final pendingWeekly = weekly.where((w) => w['studentConfirmedAt'] == null).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('تقدّمي', style: ui(size: 22, weight: FontWeight.w700)),
          Text(
            'المحفوظ: ${widget.me['currentMemorization'] ?? '—'}',
            style: ui(size: 13, color: Brand.muted),
          ),
          const SizedBox(height: 12),
          const SectionTitle('الإشعارات'),
          if (notifs.isEmpty)
            const EmptyState(
              icon: Icons.notifications_none,
              title: 'لا إشعارات',
              subtitle: 'ستظهر هنا تذكيرات الموعد وتنبيهات الغياب',
            )
          else
            ...notifs.take(8).map((n) => SoftPanel(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${n['title']}', style: ui(weight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text('${n['body']}', style: ui(color: Brand.muted)),
                    ],
                  ),
                )),
          const SizedBox(height: 8),
          SoftPanel(
            child: Column(
              children: [
                _kv('تقارير مُرسلة', '${reports.length}'),
                _kv('أيام حققت القسط', '$quotaMet'),
                _kv('القسط', '${quota?['dailyQuotaDescription'] ?? 'غير محدد'}'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const SectionTitle('تأكيد التقرير الأسبوعي'),
          if (pendingWeekly.isEmpty)
            const EmptyState(
              icon: Icons.calendar_month_outlined,
              title: 'لا تقارير أسبوعية بانتظار التأكيد',
              subtitle: 'عندما يولّد المعلم/المشرف تقريراً سيظهر هنا',
            )
          else
            ...pendingWeekly.map((w) => SoftPanel(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${w['weekStartDate']} → ${w['weekEndDate']}',
                          style: ui(weight: FontWeight.w600),
                        ),
                      ),
                      FilledButton(
                        onPressed: () async {
                          try {
                            await widget.api.patch('/weekly-reports/${w['id']}/confirm', {});
                            showToast(context, 'تم تأكيد التقرير الأسبوعي');
                            await _load();
                          } catch (e) {
                            showToast(context, e.toString(), error: true);
                          }
                        },
                        child: const Text('تأكيد'),
                      ),
                    ],
                  ),
                )),
          const SizedBox(height: 8),
          const SectionTitle('صندوق الملاحظات'),
          if (notes.isEmpty)
            const EmptyState(
              icon: Icons.inbox_outlined,
              title: 'صندوق الملاحظات فارغ',
            )
          else
            ...notes.map((n) => SoftPanel(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Text('${n['body']}', style: ui()),
                )),
          const SizedBox(height: 8),
          const SectionTitle('التقصير'),
          SoftPanel(
            child: infractions.isEmpty
                ? Text('لا سجل تقصير — أحسنت', style: ui(color: Brand.forestMid, weight: FontWeight.w600))
                : Column(
                    children: infractions
                        .take(6)
                        .map((i) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 4),
                              child: Row(
                                children: [
                                  Expanded(child: Text('${i['type']}', style: ui(size: 13))),
                                  Text('${i['occurredOn']}', style: ui(size: 12, color: Brand.muted)),
                                ],
                              ),
                            ))
                        .toList(),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Expanded(child: Text(k, style: ui(color: Brand.muted))),
            Text(v, style: ui(weight: FontWeight.w700, color: Brand.forest)),
          ],
        ),
      );
}
