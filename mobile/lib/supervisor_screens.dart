import 'package:flutter/material.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/groups_catalog.dart';
import 'package:ertaki_mobile/hub_menu.dart';
import 'package:ertaki_mobile/widgets.dart';
import 'package:url_launcher/url_launcher.dart';

class SupervisorHome extends StatefulWidget {
  const SupervisorHome({
    super.key,
    required this.api,
    required this.me,
    this.onSelectTab,
    this.refreshTick,
  });
  final ApiClient api;
  final Map<String, dynamic> me;
  /// Switch shell bottom-nav: joins=1, groups=2, notifications=3.
  final ValueChanged<int>? onSelectTab;
  /// Shell bumps this when the home tab is shown / app resumes / home re-tapped.
  final ValueNotifier<int>? refreshTick;

  @override
  State<SupervisorHome> createState() => _SupervisorHomeState();
}

class _SupervisorHomeState extends State<SupervisorHome> with RouteAware {
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
  void didUpdateWidget(covariant SupervisorHome oldWidget) {
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
    if (!quiet) {
      setState(() => loading = true);
    }
    try {
      final d = await widget.api.get('/dashboards/supervisor') as Map<String, dynamic>;
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
    final pendingJoins = (data?['pendingJoins'] as num?)?.toInt() ?? 0;
    final pendingAccounts = (data?['pendingAccounts'] as num?)?.toInt() ?? 0;
    final badges = (data?['badges'] as Map?) ?? {};
    final pendingGroupApprovals =
        (badges['pendingGroupApprovals'] as num?)?.toInt() ??
            (data?['pendingGroupApprovals'] as num?)?.toInt() ??
            0;
    final unreadNotifs = (badges['unreadNotifications'] as num?)?.toInt() ?? 0;

    return RefreshIndicator(
      onRefresh: _load,
      child: RoleHubHome(
        title: 'مرحباً ${widget.me['firstName']}',
        subtitle: 'لوحة المشرف · ${data?['today'] ?? ''}',
        header: SoftPanel(
          child: Text(
            pendingAccounts > 0
                ? '$pendingAccounts معلم بانتظار التفعيل'
                : (pendingJoins > 0
                    ? '$pendingJoins طلب انضمام معلّق'
                    : 'لا مهام عاجلة حالياً'),
            style: ui(weight: FontWeight.w700),
          ),
        ),
        categories: [
          HubCategory(
            icon: Icons.verified_user_outlined,
            label: 'تفعيل المعلمين',
            subtitle: 'موافقة التسجيل',
            badgeCount: pendingAccounts,
            onTap: () => widget.onSelectTab?.call(1),
          ),
          HubCategory(
            icon: Icons.how_to_reg_outlined,
            label: 'طلبات الانضمام',
            subtitle: 'قبول أو رفض',
            badgeCount: pendingJoins,
            onTap: () => widget.onSelectTab?.call(1),
          ),
          HubCategory(
            icon: Icons.groups_outlined,
            label: 'المجموعات',
            subtitle: 'موافقة الإنشاء · موجز/تفصيلي',
            badgeCount: pendingGroupApprovals,
            onTap: () => widget.onSelectTab?.call(2),
          ),
          HubCategory(
            icon: Icons.menu_book_outlined,
            label: 'الدليل',
            subtitle: 'طلبة · معلمون · مجموعات',
            onTap: () => _open(SupervisorDirectoryPage(api: widget.api)),
          ),
          HubCategory(
            icon: Icons.calendar_view_month_outlined,
            label: 'التقارير الفصلية',
            subtitle: 'كل 3 أشهر · حسب المجموعة',
            onTap: () => _open(TrimestrialReportsPage(api: widget.api)),
          ),
          HubCategory(
            icon: Icons.notifications_outlined,
            label: 'الإشعارات',
            badgeCount: unreadNotifs,
            onTap: () => widget.onSelectTab?.call(3),
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
            'قبول أو رفض طلبات الطلبة للمجموعات (المعلم أو المشرف — قبول واحد يكفي)',
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

  Future<void> _reviewGroup(String id, bool approve) async {
    try {
      await widget.api.patch('/groups/$id/approval', {'approve': approve});
      if (mounted) {
        showToast(context, approve ? 'تمت الموافقة على المجموعة' : 'رُفض إنشاء المجموعة');
      }
      await _load();
    } catch (e) {
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
          Text('مواعيد المجالس · موافقة إنشاء المعلم · عرض موجز/تفصيلي', style: ui(size: 13, color: Brand.muted)),
          const SizedBox(height: 12),
          if (groups.isEmpty)
            const EmptyState(
              icon: Icons.groups_outlined,
              title: 'لا مجموعات بعد',
              subtitle: 'المعلمون يرسلون طلبات إنشاء للمجموعات',
            )
          else
            ...groups.map((g) {
              final teacher = g['teacher'] as Map<String, dynamic>?;
              final seats = (g['seatCount'] as num?)?.toInt() ?? 0;
              final current = (g['currentStudentCount'] as num?)?.toInt() ?? 0;
              final status = '${g['status'] ?? ''}';
              final statusLabel = groupStatusAr(status);
              final start = g['sessionStartTime'] ?? g['weeklySessionTime'];
              final end = g['sessionEndTime'];
              final timeLabel = end != null ? '$start → $end' : '$start';
              return SoftPanel(
                margin: const EdgeInsets.only(bottom: 8),
                onTap: status == 'pending_approval'
                    ? null
                    : () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => GroupDetailPage(
                              api: widget.api,
                              groupId: '${g['id']}',
                              groupName: '${g['name']}',
                            ),
                          ),
                        );
                      },
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(genderIcon(g['gender'] as String?), color: Brand.forestMid),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text('${g['name']}', style: ui(size: 16, weight: FontWeight.w700)),
                        ),
                        StatusChip(
                          label: statusLabel,
                          tone: status == 'open'
                              ? ChipTone.ok
                              : (status == 'pending_approval' ? ChipTone.warn : ChipTone.neutral),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${g['weeklySessionDay']} · $timeLabel'
                      '${teacher != null ? ' · المعلم: ${teacher['firstName'] ?? g['teacherName']}' : (g['teacherName'] != null ? ' · ${g['teacherName']}' : '')}',
                      style: ui(size: 13, color: Brand.muted),
                    ),
                    const SizedBox(height: 10),
                    SeatBar(current: current, total: seats),
                    if (status == 'pending_approval') ...[
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton(
                              onPressed: () => _reviewGroup('${g['id']}', true),
                              child: const Text('موافقة'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => _reviewGroup('${g['id']}', false),
                              child: const Text('رفض'),
                            ),
                          ),
                        ],
                      ),
                    ] else if (g['whatsappUrl'] != null && '${g['whatsappUrl']}'.isNotEmpty) ...[
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
