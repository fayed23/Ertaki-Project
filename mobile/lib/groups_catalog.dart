import 'package:flutter/material.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/widgets.dart';
import 'package:url_launcher/url_launcher.dart';

IconData genderIcon(String? gender) {
  switch (gender) {
    case 'women':
      return Icons.woman_rounded;
    case 'men':
      return Icons.man_rounded;
    default:
      return Icons.groups_outlined;
  }
}

String genderLabel(String? gender) {
  switch (gender) {
    case 'women':
      return 'نساء';
    case 'men':
      return 'رجال';
    default:
      return gender ?? '—';
  }
}

String sessionRange(Map<String, dynamic> g) {
  final start = g['sessionStartTime'] ?? g['weeklySessionTime'] ?? '—';
  final end = g['sessionEndTime'];
  if (end == null || '$end'.isEmpty) return '$start';
  return '$start → $end';
}

String groupStatusAr(String? status) {
  switch (status) {
    case 'open':
      return 'مفتوحة';
    case 'full':
      return 'ممتلئة';
    case 'pending_approval':
      return 'بانتظار موافقة المشرف';
    case 'closed':
      return 'مغلقة';
    case 'paused':
      return 'موقوفة';
    default:
      return status ?? '—';
  }
}

/// First-run marketplace: gender-matched groups; one pending/active path only.
class GroupsCatalogPage extends StatefulWidget {
  const GroupsCatalogPage({
    super.key,
    required this.api,
    this.onMembershipUnlocked,
    this.locked = true,
  });
  final ApiClient api;
  final VoidCallback? onMembershipUnlocked;
  final bool locked;

  @override
  State<GroupsCatalogPage> createState() => _GroupsCatalogPageState();
}

class _GroupsCatalogPageState extends State<GroupsCatalogPage> {
  List<dynamic> groups = [];
  Map<String, String> pendingByGroup = {}; // groupId -> joinRequestId
  final Set<String> requesting = {};
  bool loading = true;
  bool hasMembership = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final g = await widget.api.get('/groups') as List<dynamic>;
      final joins = await widget.api.get('/join-requests') as List<dynamic>;
      final pending = <String, String>{};
      for (final j in joins) {
        if (j is Map && j['status'] == 'pending') {
          final gid = '${j['groupId'] ?? (j['group'] as Map?)?['id']}';
          final jid = '${j['id']}';
          if (gid.isNotEmpty && gid != 'null') pending[gid] = jid;
        }
      }
      final has = await widget.api.get('/memberships/has-group') as Map<String, dynamic>;
      final member = has['hasGroup'] == true;
      if (member) widget.onMembershipUnlocked?.call();
      setState(() {
        groups = g;
        pendingByGroup = pending;
        hasMembership = member;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _request(String groupId) async {
    if (hasMembership || pendingByGroup.isNotEmpty) {
      showToast(context, 'يمكنك طلب مجموعة واحدة فقط — ألغِ الطلب الحالي أولاً', error: true);
      return;
    }
    setState(() => requesting.add(groupId));
    try {
      final res = await widget.api.post('/join-requests', {'groupId': groupId});
      setState(() => pendingByGroup[groupId] = '${res['id']}');
      if (mounted) showToast(context, 'تم إرسال طلب الانضمام');
      final has = await widget.api.get('/memberships/has-group') as Map<String, dynamic>;
      if (has['hasGroup'] == true) widget.onMembershipUnlocked?.call();
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => requesting.remove(groupId));
    }
  }

  Future<void> _cancel(String groupId) async {
    final jid = pendingByGroup[groupId];
    if (jid == null) return;
    setState(() => requesting.add(groupId));
    try {
      await widget.api.patch('/join-requests/$jid/cancel', {});
      setState(() => pendingByGroup.remove(groupId));
      if (mounted) showToast(context, 'تم إلغاء الطلب');
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => requesting.remove(groupId));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Text('اختر مجموعتك', style: ui(size: 22, weight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(
            widget.locked
                ? 'أرسِل طلب انضمام لمجموعة واحدة أكثر — الميزات تُفتح بعد قبول أحد الطلبات'
                : 'المجموعات المتاحة في ارتق',
            style: ui(size: 13, color: Brand.muted),
          ),
          const SizedBox(height: 14),
          if (groups.isEmpty)
            const EmptyState(
              icon: Icons.groups_outlined,
              title: 'لا مجموعات مفتوحة حالياً',
              subtitle: 'عد لاحقاً أو تواصل مع المشرف',
            )
          else
            ...groups.map((raw) {
              final g = Map<String, dynamic>.from(raw as Map);
              final id = '${g['id']}';
              final isPending = pendingByGroup.containsKey(id);
              final isBusy = requesting.contains(id);
              return SoftPanel(
                margin: const EdgeInsets.only(bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(genderIcon(g['gender'] as String?), color: Brand.forestMid, size: 28),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text('${g['name']}', style: ui(size: 16, weight: FontWeight.w700)),
                        ),
                        StatusChip(
                          label: genderLabel(g['gender'] as String?),
                          tone: ChipTone.neutral,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'المعلم: ${g['teacherName'] ?? '—'}',
                      style: ui(size: 13, color: Brand.muted),
                    ),
                    Text(
                      'الوقت: ${sessionRange(g)} · ${g['weeklySessionDay'] ?? ''}',
                      style: ui(size: 13, color: Brand.muted),
                    ),
                    if (g['description'] != null && '${g['description']}'.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text('${g['description']}', style: ui(size: 12, color: Brand.muted)),
                    ],
                    const SizedBox(height: 8),
                    SeatBar(
                      current: (g['currentStudentCount'] as num?)?.toInt() ?? 0,
                      total: (g['seatCount'] as num?)?.toInt() ?? 0,
                    ),
                    const SizedBox(height: 12),
                    if (isPending)
                      OutlinedButton.icon(
                        onPressed: isBusy ? null : () => _cancel(id),
                        icon: const Icon(Icons.close_rounded),
                        label: Text(isBusy ? 'جاري الإلغاء…' : 'إلغاء الطلب'),
                      )
                    else
                      FilledButton.icon(
                        onPressed: (isBusy || hasMembership || pendingByGroup.isNotEmpty)
                            ? null
                            : () => _request(id),
                        icon: const Icon(Icons.login_rounded),
                        label: Text(
                          hasMembership
                              ? 'أنت منضم لمجموعة'
                              : (pendingByGroup.isNotEmpty
                                  ? 'لديك طلب آخر معلّق'
                                  : (isBusy ? 'جاري الإرسال…' : 'طلب الانضمام')),
                        ),
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

/// Teacher/supervisor group brief vs detailed view.
class GroupDetailPage extends StatefulWidget {
  const GroupDetailPage({
    super.key,
    required this.api,
    required this.groupId,
    required this.groupName,
  });
  final ApiClient api;
  final String groupId;
  final String groupName;

  @override
  State<GroupDetailPage> createState() => _GroupDetailPageState();
}

class _GroupDetailPageState extends State<GroupDetailPage> {
  bool detailed = false;
  Map<String, dynamic>? data;
  Map<String, dynamic>? me;
  bool loading = true;
  String titleName = '';

  @override
  void initState() {
    super.initState();
    titleName = widget.groupName;
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final path = detailed
          ? '/groups/${widget.groupId}/detailed'
          : '/groups/${widget.groupId}/brief';
      final d = await widget.api.get(path) as Map<String, dynamic>;
      final user = await widget.api.get('/auth/me') as Map<String, dynamic>;
      final g = d['group'] is Map ? Map<String, dynamic>.from(d['group'] as Map) : d;
      setState(() {
        data = d;
        me = user;
        titleName = '${g['name'] ?? widget.groupName}';
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  bool get _canEdit {
    final role = '${me?['role'] ?? ''}';
    if (role == 'supervisor' || role == 'admin') return true;
    if (role != 'teacher') return false;
    final g = data?['group'] is Map
        ? Map<String, dynamic>.from(data!['group'] as Map)
        : data;
    return g != null && '${g['teacherId']}' == '${me?['id']}';
  }

  Future<void> _edit() async {
    final ok = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => EditGroupPage(api: widget.api, groupId: widget.groupId),
      ),
    );
    if (ok == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(titleName.isEmpty ? widget.groupName : titleName, style: ui(size: 18, weight: FontWeight.w700)),
        actions: [
          if (_canEdit)
            IconButton(
              tooltip: 'تعديل المجموعة',
              onPressed: loading ? null : _edit,
              icon: const Icon(Icons.edit_outlined),
            ),
          TextButton(
            onPressed: () {
              setState(() => detailed = !detailed);
              _load();
            },
            child: Text(detailed ? 'موجز' : 'تفصيلي'),
          ),
        ],
      ),
      body: Atmosphere(
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    SoftPanel(
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              detailed ? 'عرض تفصيلي' : 'عرض موجز — نظرة المجموعة',
                              style: ui(size: 15, weight: FontWeight.w700),
                            ),
                          ),
                          StatusChip(
                            label: detailed ? 'تفصيلي' : 'موجز',
                            tone: ChipTone.neutral,
                          ),
                        ],
                      ),
                    ),
                    if ((data?['whatsappUrl'] ?? (data?['group'] as Map?)?['whatsappUrl']) != null &&
                        '${data?['whatsappUrl'] ?? (data?['group'] as Map?)?['whatsappUrl']}'.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      SoftPanel(
                        onTap: () async {
                          final raw = '${data?['whatsappUrl'] ?? (data?['group'] as Map?)?['whatsappUrl']}';
                          final uri = Uri.tryParse(raw);
                          if (uri != null) {
                            await launchUrl(uri, mode: LaunchMode.externalApplication);
                          }
                        },
                        child: Row(
                          children: [
                            const Icon(Icons.chat_outlined, color: Brand.forestMid),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'واتساب المجموعة',
                                style: ui(weight: FontWeight.w700),
                              ),
                            ),
                            const Icon(Icons.open_in_new, size: 18, color: Brand.muted),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    ...(((data?['students'] as List<dynamic>?) ?? []).map((raw) {
                      final s = Map<String, dynamic>.from(raw as Map);
                      final today = s['dailyReportToday'] as Map<String, dynamic>?;
                      final submitted = today?['submitted'] == true;
                      return SoftPanel(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text('${s['name']}', style: ui(weight: FontWeight.w700)),
                                ),
                                StatusChip(
                                  label: submitted ? 'أرسل اليوم' : 'بلا تقرير',
                                  tone: submitted ? ChipTone.ok : ChipTone.warn,
                                ),
                              ],
                            ),
                            Text('${s['phone'] ?? ''}', style: ui(size: 12, color: Brand.muted)),
                            if (detailed) ...[
                              const SizedBox(height: 8),
                              Text(
                                'تقارير: ${((s['reports'] as List?)?.length) ?? 0} · '
                                'حضور: ${((s['attendance'] as List?)?.length) ?? 0} · '
                                'تقصير: ${((s['infractions'] as List?)?.length) ?? 0} · '
                                'أسبوعي: ${((s['weeklyReports'] as List?)?.length) ?? 0}',
                                style: ui(size: 12, color: Brand.muted),
                              ),
                              if (s['quota'] != null)
                                Text(
                                  'القسط: ${(s['quota'] as Map)['dailyQuotaDescription']}',
                                  style: ui(size: 12, color: Brand.muted),
                                ),
                            ],
                          ],
                        ),
                      );
                    })),
                    if (((data?['students'] as List?) ?? []).isEmpty)
                      const EmptyState(
                        icon: Icons.school_outlined,
                        title: 'لا طلبة في هذه المجموعة',
                      ),
                  ],
                ),
              ),
      ),
    );
  }
}


class EditGroupPage extends StatefulWidget {
  const EditGroupPage({super.key, required this.api, required this.groupId});
  final ApiClient api;
  final String groupId;

  @override
  State<EditGroupPage> createState() => _EditGroupPageState();
}

class _EditGroupPageState extends State<EditGroupPage> {
  final nameCtrl = TextEditingController();
  final descCtrl = TextEditingController();
  final waCtrl = TextEditingController();
  final seatsCtrl = TextEditingController();
  String gender = 'men';
  String day = 'السبت';
  TimeOfDay start = const TimeOfDay(hour: 20, minute: 0);
  TimeOfDay end = const TimeOfDay(hour: 21, minute: 0);
  bool loading = true;
  bool saving = false;
  int currentStudents = 0;

  String _fmt(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  TimeOfDay _parse(String? raw, TimeOfDay fallback) {
    if (raw == null || !raw.contains(':')) return fallback;
    final p = raw.split(':');
    return TimeOfDay(hour: int.tryParse(p[0]) ?? fallback.hour, minute: int.tryParse(p[1]) ?? fallback.minute);
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await widget.api.get('/groups/${widget.groupId}/brief') as Map<String, dynamic>;
      final g = d['group'] is Map ? Map<String, dynamic>.from(d['group'] as Map) : d;
      nameCtrl.text = '${g['name'] ?? ''}';
      descCtrl.text = '${g['description'] ?? ''}';
      waCtrl.text = '${g['whatsappUrl'] ?? ''}';
      seatsCtrl.text = '${g['seatCount'] ?? 20}';
      gender = '${g['gender'] ?? 'men'}';
      day = '${g['weeklySessionDay'] ?? 'السبت'}';
      start = _parse('${g['sessionStartTime'] ?? g['weeklySessionTime']}', start);
      end = _parse('${g['sessionEndTime']}', end);
      currentStudents = (g['currentStudentCount'] as num?)?.toInt() ?? 0;
      setState(() => loading = false);
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _pick(bool isStart) async {
    final v = await showTimePicker(context: context, initialTime: isStart ? start : end);
    if (v == null) return;
    setState(() {
      if (isStart) {
        start = v;
      } else {
        end = v;
      }
    });
  }

  Future<void> _save() async {
    if (nameCtrl.text.trim().isEmpty) {
      showToast(context, 'اسم المجموعة مطلوب', error: true);
      return;
    }
    final seats = int.tryParse(seatsCtrl.text.trim()) ?? 0;
    if (seats < 1) {
      showToast(context, 'عدد المقاعد غير صالح', error: true);
      return;
    }
    setState(() => saving = true);
    try {
      await widget.api.patch('/groups/${widget.groupId}', {
        'name': nameCtrl.text.trim(),
        'gender': gender,
        'seatCount': seats,
        'weeklySessionDay': day,
        'sessionStartTime': _fmt(start),
        'sessionEndTime': _fmt(end),
        'weeklySessionTime': _fmt(start),
        'description': descCtrl.text.trim(),
        'whatsappUrl': waCtrl.text.trim(),
      });
      if (!mounted) return;
      showToast(context, 'تم حفظ تعديلات المجموعة');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  void dispose() {
    nameCtrl.dispose();
    descCtrl.dispose();
    waCtrl.dispose();
    seatsCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('تعديل المجموعة', style: ui(size: 18, weight: FontWeight.w700))),
      body: Atmosphere(
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  SoftPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'عدّل بيانات المجموعة · الطلبة الحاليون: $currentStudents',
                          style: ui(size: 13, color: Brand.muted),
                        ),
                        const SizedBox(height: 14),
                        TextField(
                          controller: nameCtrl,
                          decoration: const InputDecoration(labelText: 'اسم المجموعة'),
                        ),
                        const SizedBox(height: 12),
                        Text('جنس الطلبة', style: ui(size: 13, color: Brand.muted)),
                        const SizedBox(height: 6),
                        SegmentedButton<String>(
                          segments: const [
                            ButtonSegment(value: 'men', label: Text('رجال'), icon: Icon(Icons.man_rounded)),
                            ButtonSegment(value: 'women', label: Text('نساء'), icon: Icon(Icons.woman_rounded)),
                          ],
                          selected: {gender},
                          onSelectionChanged: currentStudents > 0
                              ? null
                              : (s) => setState(() => gender = s.first),
                        ),
                        if (currentStudents > 0)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              'لا يمكن تغيير الجنس وفي المجموعة طلبة',
                              style: ui(size: 12, color: Brand.muted),
                            ),
                          ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: seatsCtrl,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'أقصى عدد طلبة (المقاعد)',
                            helperText: 'لا يقل عن $currentStudents',
                          ),
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          value: day,
                          decoration: const InputDecoration(labelText: 'يوم المجلس'),
                          items: const [
                            'السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة',
                          ].map((d) => DropdownMenuItem(value: d, child: Text(d))).toList(),
                          onChanged: (v) => setState(() => day = v ?? day),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => _pick(true),
                                child: Text('بداية ${_fmt(start)}'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => _pick(false),
                                child: Text('نهاية ${_fmt(end)}'),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: waCtrl,
                          textDirection: TextDirection.ltr,
                          keyboardType: TextInputType.url,
                          decoration: const InputDecoration(
                            labelText: 'رابط واتساب المجموعة',
                            hintText: 'https://chat.whatsapp.com/...',
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: descCtrl,
                          maxLines: 3,
                          decoration: const InputDecoration(labelText: 'وصف موجز'),
                        ),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: saving ? null : _save,
                          child: Text(saving ? 'جاري الحفظ…' : 'حفظ التعديلات'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class CreateGroupPage extends StatefulWidget {
  const CreateGroupPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<CreateGroupPage> createState() => _CreateGroupPageState();
}

class _CreateGroupPageState extends State<CreateGroupPage> {
  final nameCtrl = TextEditingController();
  final descCtrl = TextEditingController();
  final waCtrl = TextEditingController();
  final seatsCtrl = TextEditingController(text: '20');
  String gender = 'men';
  String day = 'السبت';
  TimeOfDay start = const TimeOfDay(hour: 20, minute: 0);
  TimeOfDay end = const TimeOfDay(hour: 21, minute: 0);
  bool saving = false;

  String _fmt(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  Future<void> _pick(bool isStart) async {
    final v = await showTimePicker(
      context: context,
      initialTime: isStart ? start : end,
    );
    if (v == null) return;
    setState(() {
      if (isStart) {
        start = v;
      } else {
        end = v;
      }
    });
  }

  Future<void> _submit() async {
    if (nameCtrl.text.trim().isEmpty) {
      showToast(context, 'اسم المجموعة مطلوب', error: true);
      return;
    }
    setState(() => saving = true);
    try {
      final seats = int.tryParse(seatsCtrl.text.trim()) ?? 20;
      await widget.api.post('/groups', {
        'name': nameCtrl.text.trim(),
        'gender': gender,
        'seatCount': seats < 1 ? 20 : seats,
        'weeklySessionDay': day,
        'sessionStartTime': _fmt(start),
        'sessionEndTime': _fmt(end),
        'weeklySessionTime': _fmt(start),
        if (descCtrl.text.trim().isNotEmpty) 'description': descCtrl.text.trim(),
        if (waCtrl.text.trim().isNotEmpty) 'whatsappUrl': waCtrl.text.trim(),
      });
      if (!mounted) return;
      showToast(context, 'أُرسل طلب إنشاء المجموعة للمشرف');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  void dispose() {
    nameCtrl.dispose();
    descCtrl.dispose();
    waCtrl.dispose();
    seatsCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('إنشاء مجموعة', style: ui(size: 18, weight: FontWeight.w700))),
      body: Atmosphere(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            SoftPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'طلب إنشاء مجموعة — يحتاج موافقة المشرف قبل أن تُفتح للانضمام',
                    style: ui(size: 13, color: Brand.muted),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: nameCtrl,
                    decoration: const InputDecoration(labelText: 'اسم المجموعة'),
                  ),
                  const SizedBox(height: 12),
                  Text('جنس الطلبة', style: ui(size: 13, color: Brand.muted)),
                  const SizedBox(height: 6),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'men', label: Text('رجال'), icon: Icon(Icons.man_rounded)),
                      ButtonSegment(value: 'women', label: Text('نساء'), icon: Icon(Icons.woman_rounded)),
                    ],
                    selected: {gender},
                    onSelectionChanged: (s) => setState(() => gender = s.first),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: seatsCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'أقصى عدد طلبة (المقاعد)'),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: day,
                    decoration: const InputDecoration(labelText: 'يوم المجلس'),
                    items: const [
                      'السبت',
                      'الأحد',
                      'الاثنين',
                      'الثلاثاء',
                      'الأربعاء',
                      'الخميس',
                      'الجمعة',
                    ].map((d) => DropdownMenuItem(value: d, child: Text(d))).toList(),
                    onChanged: (v) => setState(() => day = v ?? day),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => _pick(true),
                          child: Text('بداية ${_fmt(start)}'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => _pick(false),
                          child: Text('نهاية ${_fmt(end)}'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: waCtrl,
                    textDirection: TextDirection.ltr,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: 'رابط واتساب المجموعة',
                      hintText: 'https://chat.whatsapp.com/...',
                      helperText: 'يظهر في النظرة الموجزة بعد موافقة المشرف',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: descCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(labelText: 'وصف موجز'),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: saving ? null : _submit,
                    child: Text(saving ? 'جاري الإرسال…' : 'إرسال للموافقة'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class WeeklyReportsPage extends StatefulWidget {
  const WeeklyReportsPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<WeeklyReportsPage> createState() => _WeeklyReportsPageState();
}

class _WeeklyReportsPageState extends State<WeeklyReportsPage> {
  List<MapEntry<String, List<Map<String, dynamic>>>> groups = [];
  bool detailed = false;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final mode = detailed ? 'detailed' : 'brief';
      final list = await widget.api.get('/weekly-reports?mode=$mode') as List<dynamic>;
      final map = <String, List<Map<String, dynamic>>>{};
      for (final raw in list) {
        final w = Map<String, dynamic>.from(raw as Map);
        final key = '${w['groupName'] ?? 'بدون مجموعة'}';
        map.putIfAbsent(key, () => []).add(w);
      }
      final sorted = map.entries.toList()
        ..sort((a, b) => a.key.compareTo(b.key));
      setState(() {
        groups = sorted;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Widget _reportCard(Map<String, dynamic> w) {
    final attended = w['attendedMajlisLabel'] ??
        ((w['attendedMajlis'] == true || (w['presentSessions'] as num?)?.toInt() == 1)
            ? 'نعم'
            : 'لا');
    return SoftPanel(
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'اسم الطالب: ${w['studentName'] ?? '—'}',
            style: ui(weight: FontWeight.w700),
          ),
          Text(
            '${w['weekStartDate']} → ${w['weekEndDate']}',
            style: ui(size: 12, color: Brand.muted),
          ),
          const SizedBox(height: 8),
          Text(
            'حضرت مجلس التسميع: $attended',
            style: ui(size: 14, weight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text('عدد المرات التي فيها لم:', style: ui(size: 13, weight: FontWeight.w700, color: Brand.muted)),
          const SizedBox(height: 4),
          Text('أرسل التقرير: ${w['missedDailyReports'] ?? '—'}', style: ui(size: 13)),
          Text('أحفظ القسط اليومي: ${w['missedQuota'] ?? '—'}', style: ui(size: 13)),
          Text('أكرر 50 مرة: ${w['missedFiftyReps'] ?? '—'}', style: ui(size: 13)),
          Text('أكرر في مجلس واحد: ${w['missedSingleSitting'] ?? '—'}', style: ui(size: 13)),
          Text('آتِ بورد المراجعة: ${w['missedReview'] ?? '—'}', style: ui(size: 13)),
          if (detailed) ...[
            const SizedBox(height: 8),
            Text(
              'أيام الإرسال: ${w['dailyReportsSubmitted']} · القسط: ${w['quotaDaysMet']} · 50: ${w['fiftyRepsDaysMet']}',
              style: ui(size: 12, color: Brand.muted),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('التقارير الأسبوعية', style: ui(size: 18, weight: FontWeight.w700)),
        actions: [
          TextButton(
            onPressed: () {
              setState(() => detailed = !detailed);
              _load();
            },
            child: Text(detailed ? 'موجز' : 'تفصيلي'),
          ),
        ],
      ),
      body: Atmosphere(
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    SoftPanel(
                      child: Text(
                        'مجمّعة حسب المجموعة · بعد حفظ الحضور تُحذف التقارير اليومية لذلك الأسبوع',
                        style: ui(size: 13, color: Brand.muted),
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (groups.isEmpty)
                      const EmptyState(
                        icon: Icons.insights_outlined,
                        title: 'لا تقارير أسبوعية بعد',
                        subtitle: 'تُولَّد بعد أن يحفظ المعلم حضور المجلس الأسبوعي',
                      )
                    else
                      ...groups.expand((entry) {
                        return [
                          SectionTitle(entry.key),
                          ...entry.value.map(_reportCard),
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

class TrimestrialReportsPage extends StatefulWidget {
  const TrimestrialReportsPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<TrimestrialReportsPage> createState() => _TrimestrialReportsPageState();
}

class _TrimestrialReportsPageState extends State<TrimestrialReportsPage> {
  List<Map<String, dynamic>> groups = [];
  bool loading = true;
  bool generating = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final res = await widget.api.get('/trimestrial-reports') as Map<String, dynamic>;
      final list = (res['groups'] as List<dynamic>? ?? [])
          .map((g) => Map<String, dynamic>.from(g as Map))
          .toList();
      setState(() {
        groups = list;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _generate() async {
    setState(() => generating = true);
    try {
      final res = await widget.api.post('/trimestrial-reports/auto-generate', {})
          as Map<String, dynamic>;
      final n = (res['generated'] as num?)?.toInt() ?? 0;
      final deleted = (res['deletedWeeklies'] as num?)?.toInt() ?? 0;
      if (mounted) {
        showToast(
          context,
          'فصلي: $n تقريراً · حُذف $deleted أسبوعياً · ${res['periodStart']} — ${res['periodEnd']}',
        );
      }
      await _load();
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => generating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('التقارير الفصلية', style: ui(size: 18, weight: FontWeight.w700)),
        actions: [
          TextButton(
            onPressed: generating ? null : _generate,
            child: Text(generating ? '…' : 'توليد'),
          ),
        ],
      ),
      body: Atmosphere(
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    SoftPanel(
                      child: Text(
                        'كل 3 أشهر: تُحذف التقارير الأسبوعية للفترة ويُولَّد تقرير فصلي لكل طالب داخل مجموعته',
                        style: ui(size: 13, color: Brand.muted),
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (groups.isEmpty)
                      const EmptyState(
                        icon: Icons.calendar_view_month_outlined,
                        title: 'لا تقارير فصلية بعد',
                        subtitle: 'تُولَّد تلقائياً في بداية كل فصل تقويمي أو من زر توليد',
                      )
                    else
                      ...groups.expand((g) {
                        final name = '${g['groupName'] ?? 'بدون مجموعة'}';
                        final reports = (g['reports'] as List<dynamic>? ?? [])
                            .map((r) => Map<String, dynamic>.from(r as Map))
                            .toList();
                        return [
                          SectionTitle(name),
                          ...reports.map((t) {
                            return SoftPanel(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${t['studentName'] ?? 'طالب'}',
                                    style: ui(weight: FontWeight.w700),
                                  ),
                                  Text(
                                    '${t['periodStartDate']} → ${t['periodEndDate']} · ${t['weeksCount']} أسابيع',
                                    style: ui(size: 12, color: Brand.muted),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'حضور المجلس: ${t['weeksAttendedMajlis']}/${t['weeksCount']}',
                                    style: ui(size: 13, weight: FontWeight.w700),
                                  ),
                                  Text('لم أرسل التقرير: ${t['missedDailyReports']}', style: ui(size: 13)),
                                  Text('لم أحفظ القسط: ${t['missedQuota']}', style: ui(size: 13)),
                                  Text('لم أكرر 50: ${t['missedFiftyReps']}', style: ui(size: 13)),
                                  Text('لم أكرر في مجلس واحد: ${t['missedSingleSitting']}', style: ui(size: 13)),
                                  Text('لم آتِ بورد المراجعة: ${t['missedReview']}', style: ui(size: 13)),
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

class TeacherJoinsPage extends StatefulWidget {
  const TeacherJoinsPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<TeacherJoinsPage> createState() => _TeacherJoinsPageState();
}

class _TeacherJoinsPageState extends State<TeacherJoinsPage> {
  List<dynamic> joins = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final j = await widget.api.get('/join-requests') as List<dynamic>;
      setState(() {
        joins = j;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _review(String id, bool accept) async {
    try {
      await widget.api.patch('/join-requests/$id', {'accept': accept});
      if (mounted) showToast(context, accept ? 'تم القبول' : 'تم الرفض');
      await _load();
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('طلبات الانضمام', style: ui(size: 18, weight: FontWeight.w700))),
      body: Atmosphere(
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(
                      'قبولك أو رفضك يُنهي الطلب فوراً (حتى لو كان المشرف يرى نفس الطلب)',
                      style: ui(size: 13, color: Brand.muted),
                    ),
                    const SizedBox(height: 12),
                    if (joins.isEmpty)
                      const EmptyState(
                        icon: Icons.inbox_outlined,
                        title: 'لا طلبات حالياً',
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
                              Text(
                                '${student?['firstName'] ?? ''} ${student?['lastName'] ?? ''}'.trim(),
                                style: ui(weight: FontWeight.w700),
                              ),
                              Text(
                                '${group?['name'] ?? ''} · $status',
                                style: ui(size: 12, color: Brand.muted),
                              ),
                              if (status == 'pending') ...[
                                const SizedBox(height: 10),
                                Row(
                                  children: [
                                    Expanded(
                                      child: FilledButton(
                                        onPressed: () => _review('${j['id']}', true),
                                        child: const Text('قبول'),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: OutlinedButton(
                                        onPressed: () => _review('${j['id']}', false),
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
              ),
      ),
    );
  }
}

class SupervisorDirectoryPage extends StatefulWidget {
  const SupervisorDirectoryPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<SupervisorDirectoryPage> createState() => _SupervisorDirectoryPageState();
}

class _SupervisorDirectoryPageState extends State<SupervisorDirectoryPage> {
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
      final d = await widget.api.get('/directory') as Map<String, dynamic>;
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
    return Scaffold(
      appBar: AppBar(title: Text('الدليل الشامل', style: ui(size: 18, weight: FontWeight.w700))),
      body: Atmosphere(
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _section('المعلمون', data?['teachers'] as List<dynamic>? ?? [], (u) {
                      return '${u['firstName']} ${u['lastName']} · ${u['phone']} · ${u['status']}';
                    }),
                    const SizedBox(height: 16),
                    _section('الطلبة', data?['students'] as List<dynamic>? ?? [], (u) {
                      return '${u['firstName']} ${u['lastName']} · ${u['phone']} · ${u['status']}';
                    }),
                    const SizedBox(height: 16),
                    _section('المجموعات', data?['groups'] as List<dynamic>? ?? [], (g) {
                      return '${g['name']} · ${g['teacherName'] ?? ''} · ${groupStatusAr(g['status'] as String?)} · ${sessionRange(Map<String, dynamic>.from(g))}';
                    }),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _section(String title, List<dynamic> rows, String Function(Map<String, dynamic>) line) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: ui(size: 18, weight: FontWeight.w700)),
        const SizedBox(height: 8),
        if (rows.isEmpty)
          Text('لا عناصر', style: ui(color: Brand.muted))
        else
          ...rows.map((raw) {
            final m = Map<String, dynamic>.from(raw as Map);
            return SoftPanel(
              margin: const EdgeInsets.only(bottom: 6),
              child: Text(line(m), style: ui(size: 13)),
            );
          }),
      ],
    );
  }
}
