import 'package:flutter/material.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/widgets.dart';
import 'package:url_launcher/url_launcher.dart';

class SupervisorHome extends StatefulWidget {
  const SupervisorHome({
    super.key,
    required this.api,
    required this.me,
    required this.onGoJoins,
  });
  final ApiClient api;
  final Map<String, dynamic> me;
  final VoidCallback onGoJoins;

  @override
  State<SupervisorHome> createState() => _SupervisorHomeState();
}

class _SupervisorHomeState extends State<SupervisorHome> {
  Map<String, dynamic>? data;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final d = await widget.api.get('/dashboards/supervisor') as Map<String, dynamic>;
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
    final pendingJoins = (data?['pendingJoins'] as num?)?.toInt() ?? 0;
    final pendingAccounts = (data?['pendingAccounts'] as num?)?.toInt() ?? 0;
    final metrics = [
      ('تفعيل حسابات', pendingAccounts),
      ('طلبات انضمام', pendingJoins),
      ('تقارير اليوم', (data?['reportsToday'] as num?)?.toInt() ?? 0),
      ('تقصير مفتوح', (data?['openInfractions'] as num?)?.toInt() ?? 0),
      ('نشطون', (data?['activeStudents'] as num?)?.toInt() ?? 0),
      ('الطلبة', (data?['students'] as num?)?.toInt() ?? 0),
      ('المعلمون', (data?['teachers'] as num?)?.toInt() ?? 0),
      ('المجموعات', (data?['groups'] as num?)?.toInt() ?? 0),
    ];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Text('مرحباً ${widget.me['firstName']}', style: ui(size: 22, weight: FontWeight.w700)),
          Text('لوحة المشرف · ${data?['today']}', style: ui(size: 13, color: Brand.muted)),
          const SizedBox(height: 12),
          if (pendingAccounts > 0)
            SoftPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'حسابات بانتظار التفعيل ($pendingAccounts)',
                          style: ui(size: 17, weight: FontWeight.w700),
                        ),
                      ),
                      const StatusChip(label: 'مطلوب', tone: ChipTone.warn),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'وافق أو ارفض تسجيلات الطلبة والمعلمين قبل طلبات الانضمام',
                    style: ui(size: 13, color: Brand.muted),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: widget.onGoJoins,
                    icon: const Icon(Icons.verified_user_outlined),
                    label: const Text('مراجعة الحسابات'),
                  ),
                ],
              ),
            )
          else if (pendingJoins > 0)
            SoftPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'طلبات انضمام بانتظارك ($pendingJoins)',
                          style: ui(size: 17, weight: FontWeight.w700),
                        ),
                      ),
                      const StatusChip(label: 'مطلوب', tone: ChipTone.warn),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'راجعها أولاً قبل بقية المؤشرات',
                    style: ui(size: 13, color: Brand.muted),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: widget.onGoJoins,
                    icon: const Icon(Icons.how_to_reg_outlined),
                    label: const Text('فتح الطلبات'),
                  ),
                ],
              ),
            )
          else
            SoftPanel(
              child: Row(
                children: [
                  const Icon(Icons.check_circle_outline, color: Brand.forestMid),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text('لا حسابات أو طلبات معلّقة', style: ui(weight: FontWeight.w600)),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 14),
          const SectionTitle('نظرة اليوم'),
          SoftPanel(
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              children: metrics
                  .map(
                    (m) => SizedBox(
                      width: 96,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(m.$1, style: ui(size: 12, color: Brand.muted)),
                          const SizedBox(height: 4),
                          Text('${m.$2}', style: ui(size: 22, weight: FontWeight.w700, color: Brand.forest)),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: 14),
          SoftPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('لوحة الويب أيضاً متاحة', style: ui(size: 15, weight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(
                  'يمكنك إدارة البرنامج من التطبيق أو من لوحة المشرف على المتصفح بنفس الحساب. سياسات التقصير تُعدَّل من الويب.',
                  style: ui(size: 13, color: Brand.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class SupervisorJoins extends StatefulWidget {
  const SupervisorJoins({super.key, required this.api});
  final ApiClient api;

  @override
  State<SupervisorJoins> createState() => _SupervisorJoinsState();
}

class _SupervisorJoinsState extends State<SupervisorJoins> {
  List<dynamic> joins = [];
  List<dynamic> accounts = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final results = await Future.wait([
        widget.api.get('/account-approvals'),
        widget.api.get('/join-requests'),
      ]);
      final a = List<dynamic>.from(results[0] as List<dynamic>);
      final j = List<dynamic>.from(results[1] as List<dynamic>);
      j.sort((x, y) {
        final ap = x['status'] == 'pending' ? 0 : 1;
        final bp = y['status'] == 'pending' ? 0 : 1;
        return ap.compareTo(bp);
      });
      setState(() {
        accounts = a;
        joins = j;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _reviewJoin(String id, bool accept) async {
    try {
      await widget.api.patch('/join-requests/$id', {'accept': accept});
      if (mounted) showToast(context, accept ? 'تم قبول الطلب' : 'تم رفض الطلب');
      await _load();
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _reviewAccount(String id, bool approve) async {
    String? note;
    if (!approve) {
      final ctrl = TextEditingController();
      note = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('سبب الرفض (اختياري)'),
          content: TextField(
            controller: ctrl,
            decoration: const InputDecoration(hintText: 'اكتب ملاحظة للمستخدم'),
            maxLines: 3,
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
              child: const Text('رفض'),
            ),
          ],
        ),
      );
      if (note == null) return;
    }
    try {
      await widget.api.patch('/account-approvals/$id', {
        'approve': approve,
        if (note != null && note.isNotEmpty) 'reviewNote': note,
      });
      if (mounted) {
        showToast(context, approve ? 'تم تفعيل الحساب' : 'تم رفض الحساب');
      }
      await _load();
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  ChipTone _tone(String status) {
    switch (status) {
      case 'pending':
      case 'pending_approval':
        return ChipTone.warn;
      case 'accepted':
      case 'active':
      case 'new':
        return ChipTone.ok;
      case 'rejected':
        return ChipTone.danger;
      default:
        return ChipTone.neutral;
    }
  }

  String _label(String status) {
    switch (status) {
      case 'pending':
        return 'قيد المراجعة';
      case 'pending_approval':
        return 'بانتظار التفعيل';
      case 'accepted':
        return 'مقبول';
      case 'rejected':
        return 'مرفوض';
      default:
        return status;
    }
  }

  String _roleAr(String role) {
    switch (role) {
      case 'teacher':
        return 'معلم';
      case 'student':
        return 'طالب';
      default:
        return role;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    final pendingAccounts =
        accounts.where((a) => a['status'] == 'pending_approval').length;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('تفعيل الحسابات', style: ui(size: 22, weight: FontWeight.w700)),
          Text(
            'موافقة المشرف على تسجيل طالب/معلم قبل الدخول',
            style: ui(size: 13, color: Brand.muted),
          ),
          const SizedBox(height: 12),
          if (accounts.isEmpty)
            const EmptyState(
              icon: Icons.person_off_outlined,
              title: 'لا حسابات بانتظار التفعيل',
              subtitle: 'التسجيلات الجديدة تظهر هنا للمراجعة',
            )
          else
            ...accounts.map((u) {
              final status = '${u['status']}';
              return SoftPanel(
                margin: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${u['firstName'] ?? ''} ${u['lastName'] ?? ''}'.trim(),
                            style: ui(size: 16, weight: FontWeight.w700),
                          ),
                        ),
                        StatusChip(label: _label(status), tone: _tone(status)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_roleAr('${u['role']}')} · ${u['phone'] ?? ''}',
                      style: ui(color: Brand.muted),
                    ),
                    if (u['city'] != null)
                      Text('${u['city']}', style: ui(size: 13, color: Brand.muted)),
                    if (status == 'rejected' && u['accountReviewNote'] != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          'السبب: ${u['accountReviewNote']}',
                          style: ui(size: 13, color: Brand.muted),
                        ),
                      ),
                    if (status == 'pending_approval') ...[
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton(
                              onPressed: () => _reviewAccount('${u['id']}', true),
                              child: const Text('تفعيل'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => _reviewAccount('${u['id']}', false),
                              child: const Text('رفض'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              );
            }),
          const SizedBox(height: 20),
          Text('طلبات الانضمام', style: ui(size: 22, weight: FontWeight.w700)),
          Text(
            'قبول أو رفض طلبات الطلبة للمجموعات (منفصل عن تفعيل الحساب)',
            style: ui(size: 13, color: Brand.muted),
          ),
          if (pendingAccounts > 0) ...[
            const SizedBox(height: 8),
            Text(
              'فعّل الحسابات أولاً إن وجدت أعلاه',
              style: ui(size: 12, color: Brand.muted),
            ),
          ],
          const SizedBox(height: 12),
          if (joins.isEmpty)
            const EmptyState(
              icon: Icons.inbox_outlined,
              title: 'لا توجد طلبات حالياً',
              subtitle: 'عندما يرسل طالب طلباً سيظهر هنا',
            )
          else
            ...joins.map((j) {
              final student = j['student'] as Map<String, dynamic>?;
              final group = j['group'] as Map<String, dynamic>?;
              final status = '${j['status']}';
              return SoftPanel(
                margin: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${student?['firstName'] ?? ''} ${student?['lastName'] ?? ''}'.trim(),
                            style: ui(size: 16, weight: FontWeight.w700),
                          ),
                        ),
                        StatusChip(label: _label(status), tone: _tone(status)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('${group?['name'] ?? 'مجموعة'}', style: ui(color: Brand.muted)),
                    if (student?['phone'] != null)
                      Text('${student!['phone']}', style: ui(size: 13, color: Brand.muted)),
                    if (status == 'pending') ...[
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton(
                              onPressed: () => _reviewJoin('${j['id']}', true),
                              child: const Text('قبول'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => _reviewJoin('${j['id']}', false),
                              child: const Text('رفض'),
                            ),
                          ),
                        ],
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

class SupervisorGroups extends StatefulWidget {
  const SupervisorGroups({super.key, required this.api});
  final ApiClient api;

  @override
  State<SupervisorGroups> createState() => _SupervisorGroupsState();
}

class _SupervisorGroupsState extends State<SupervisorGroups> {
  List<dynamic> groups = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final g = await widget.api.get('/groups') as List<dynamic>;
      setState(() {
        groups = g;
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
          Text('المجموعات', style: ui(size: 22, weight: FontWeight.w700)),
          Text('مواعيد المجالس وروابط واتساب', style: ui(size: 13, color: Brand.muted)),
          const SizedBox(height: 12),
          if (groups.isEmpty)
            const EmptyState(
              icon: Icons.groups_outlined,
              title: 'لا مجموعات بعد',
              subtitle: 'أنشئ مجموعة من لوحة الويب أو عبر الـ API',
            )
          else
            ...groups.map((g) {
              final teacher = g['teacher'] as Map<String, dynamic>?;
              final seats = (g['seatCount'] as num?)?.toInt() ?? 0;
              final current = (g['currentStudentCount'] as num?)?.toInt() ?? 0;
              final status = '${g['status'] ?? ''}';
              final statusLabel = switch (status) {
                'open' => 'مفتوحة',
                'full' => 'مكتملة',
                'closed' => 'مغلقة',
                'paused' => 'متوقفة',
                _ => status,
              };
              return SoftPanel(
                margin: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text('${g['name']}', style: ui(size: 16, weight: FontWeight.w700)),
                        ),
                        StatusChip(
                          label: statusLabel,
                          tone: status == 'open' ? ChipTone.ok : ChipTone.neutral,
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${g['weeklySessionDay']} · ${g['weeklySessionTime']}'
                      '${teacher != null ? ' · المعلم: ${teacher['firstName']}' : ''}',
                      style: ui(size: 13, color: Brand.muted),
                    ),
                    const SizedBox(height: 10),
                    SeatBar(current: current, total: seats),
                    if (g['whatsappUrl'] != null && '${g['whatsappUrl']}'.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      OutlinedButton.icon(
                        onPressed: () async {
                          final uri = Uri.tryParse('${g['whatsappUrl']}');
                          if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
                        },
                        icon: const Icon(Icons.chat_outlined),
                        label: const Text('واتساب المجموعة'),
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

class SupervisorPolicies extends StatefulWidget {
  const SupervisorPolicies({super.key, required this.api});
  final ApiClient api;

  @override
  State<SupervisorPolicies> createState() => _SupervisorPoliciesState();
}

class _SupervisorPoliciesState extends State<SupervisorPolicies> {
  List<dynamic> policies = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final p = await widget.api.get('/infraction-policies') as List<dynamic>;
      setState(() {
        policies = p;
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
          Text('سياسات التقصير', style: ui(size: 22, weight: FontWeight.w700)),
          Text('الإعدادات الحالية — التعديل التفصيلي متاح أيضاً من لوحة الويب', style: ui(size: 13, color: Brand.muted)),
          const SizedBox(height: 12),
          if (policies.isEmpty)
            const EmptyState(
              icon: Icons.rule_folder_outlined,
              title: 'لا سياسات مفعّلة',
              subtitle: 'أضف سياسات من لوحة المشرف على الويب',
            )
          else
            ...policies.map((p) {
              final enabled = p['enabled'] == true;
              return SoftPanel(
                margin: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${p['actionLabel'] ?? p['action'] ?? 'إجراء'}',
                            style: ui(size: 15, weight: FontWeight.w700),
                          ),
                        ),
                        StatusChip(
                          label: enabled ? 'مفعّلة' : 'معطّلة',
                          tone: enabled ? ChipTone.ok : ChipTone.neutral,
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'النوع: ${p['infractionType']} · العتبة: ${p['thresholdCount']}',
                      style: ui(size: 13, color: Brand.muted),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
