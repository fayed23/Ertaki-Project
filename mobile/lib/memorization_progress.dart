import 'package:flutter/material.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/quran_qalun.dart';
import 'package:ertaki_mobile/widgets.dart';

class MemorizationProgressSection extends StatefulWidget {
  const MemorizationProgressSection({
    super.key,
    required this.api,
    this.studentId,
    this.studentName,
    this.compact = false,
  });

  final ApiClient api;
  final String? studentId;
  final String? studentName;
  final bool compact;

  @override
  State<MemorizationProgressSection> createState() =>
      _MemorizationProgressSectionState();
}

class _MemorizationProgressSectionState
    extends State<MemorizationProgressSection> {
  Map<String, dynamic>? snap;
  QalunCatalog? catalog;
  bool loading = true;
  String? error;

  String get _qs =>
      widget.studentId == null ? '' : '?studentId=${widget.studentId}';

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    catalog = await QalunCatalog.load();
    await _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final res = await widget.api.get('/memorization$_qs');
      setState(() {
        snap = res is Map<String, dynamic> ? res : null;
        loading = false;
      });
    } catch (e) {
      setState(() {
        loading = false;
        error = e.toString();
      });
    }
  }

  Map<String, dynamic>? get perms =>
      snap?['permissions'] as Map<String, dynamic>?;

  Future<void> _openSetup() async {
    if (catalog == null) return;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Brand.paper,
      builder: (ctx) => _SetupSheet(
        catalog: catalog!,
        onSubmit: (surah, ayah, pace) async {
          await widget.api.post('/memorization/setup', {
            if (widget.studentId != null) 'studentId': widget.studentId,
            'startSurahNumber': surah.number,
            'startAyah': ayah,
            'pace': pace,
            'confirmNew': true,
            'confirmSequential': true,
            'reason': 'إعداد أولي',
          });
        },
      ),
    );
    if (ok == true) await _load();
  }

  Future<void> _editPace() async {
    final plan = snap?['plan'] as Map<String, dynamic>?;
    if (plan == null) return;
    final current = '${plan['pace'] ?? 'half_page'}';
    final reasonCtrl = TextEditingController();
    String pace = current;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          backgroundColor: Brand.paper,
          title: Text('تعديل الوتيرة', style: ui(weight: FontWeight.w700)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              RadioListTile<String>(
                title: Text('نصف صفحة يومياً', style: ui()),
                value: 'half_page',
                groupValue: pace,
                onChanged: (v) => setLocal(() => pace = v!),
              ),
              RadioListTile<String>(
                title: Text('صفحة يومياً', style: ui()),
                value: 'one_page',
                groupValue: pace,
                onChanged: (v) => setLocal(() => pace = v!),
              ),
              TextField(
                controller: reasonCtrl,
                decoration: const InputDecoration(labelText: 'سبب التعديل'),
              ),
              const SizedBox(height: 8),
              Text(
                'تغيير الوتيرة لا يمسح الإنجازات ولا إتمام الأحزاب.',
                style: ui(size: 12, color: Brand.muted),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('حفظ'),
            ),
          ],
        ),
      ),
    );
    if (ok != true) return;
    try {
      await widget.api.patch('/memorization/plan', {
        if (widget.studentId != null) 'studentId': widget.studentId,
        'pace': pace,
        'reason': reasonCtrl.text.trim().isEmpty ? 'تعديل الوتيرة' : reasonCtrl.text.trim(),
      });
      if (mounted) showToast(context, 'تم تحديث الوتيرة');
      await _load();
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _editStart() async {
    if (catalog == null) return;
    final plan = snap?['plan'] as Map<String, dynamic>?;
    if (plan == null) return;
    final reasonCtrl = TextEditingController();
    QalunSurah? surah = catalog!.byNumber((plan['startSurahNumber'] as num).toInt());
    int ayah = (plan['startAyah'] as num).toInt();
    String? confirmMode;

    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Brand.paper,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
        ),
        child: StatefulBuilder(
          builder: (ctx, setLocal) {
            final maxAyah = surah?.ayahCount ?? 1;
            return SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('تعديل نقطة البداية', style: ui(size: 18, weight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Text(
                    'بعد وجود تقدّم: اختر تعديل الخطة فقط أو تعديل + إعادة ضبط (للمشرف).',
                    style: ui(size: 12, color: Brand.muted),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int>(
                    value: surah?.number,
                    decoration: const InputDecoration(labelText: 'السورة'),
                    items: catalog!.surahs
                        .map((s) => DropdownMenuItem(value: s.number, child: Text(s.label)))
                        .toList(),
                    onChanged: (n) {
                      if (n == null) return;
                      setLocal(() {
                        surah = catalog!.byNumber(n);
                        ayah = 1;
                      });
                    },
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<int>(
                    value: ayah.clamp(1, maxAyah),
                    decoration: const InputDecoration(labelText: 'الآية'),
                    items: [
                      for (var i = 1; i <= maxAyah; i++)
                        DropdownMenuItem(value: i, child: Text('$i')),
                    ],
                    onChanged: (v) => setLocal(() => ayah = v ?? 1),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: reasonCtrl,
                    decoration: const InputDecoration(labelText: 'السبب'),
                  ),
                  const SizedBox(height: 8),
                  RadioListTile<String>(
                    title: Text('تعديل الخطة فقط (أ)', style: ui(size: 13)),
                    value: 'plan_only',
                    groupValue: confirmMode,
                    onChanged: (v) => setLocal(() => confirmMode = v),
                  ),
                  RadioListTile<String>(
                    title: Text('تعديل + إعادة ضبط التقدّم (ب)', style: ui(size: 13)),
                    value: 'plan_and_reset',
                    groupValue: confirmMode,
                    onChanged: (v) => setLocal(() => confirmMode = v),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('حفظ'),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
    if (ok != true || surah == null) return;
    try {
      await widget.api.patch('/memorization/plan', {
        if (widget.studentId != null) 'studentId': widget.studentId,
        'startSurahNumber': surah!.number,
        'startAyah': ayah,
        'reason': reasonCtrl.text.trim().isEmpty ? 'تعديل نقطة البداية' : reasonCtrl.text.trim(),
        if (confirmMode != null) 'confirmMode': confirmMode,
      });
      if (mounted) showToast(context, 'تم تحديث نقطة البداية');
      await _load();
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _reset() async {
    if (widget.studentId == null) return;
    final reasonCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Brand.paper,
        title: Text('إعادة ضبط التقدّم؟', style: ui(weight: FontWeight.w700)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'إجراء هدّام: يُأرشف التقدّم النشط ويُعاد من نقطة البداية. الأوسمة وإتمام الأحزاب التاريخية تبقى.',
              style: ui(size: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonCtrl,
              decoration: const InputDecoration(labelText: 'سبب إعادة الضبط'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Brand.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('تأكيد إعادة الضبط'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await widget.api.post('/memorization/reset', {
        'studentId': widget.studentId,
        'reason': reasonCtrl.text.trim().isEmpty ? 'إعادة ضبط إدارية' : reasonCtrl.text.trim(),
        'confirm': true,
      });
      if (mounted) showToast(context, 'تمت إعادة الضبط');
      await _load();
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _completeHizb() async {
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Brand.paper,
        title: Text('تسجيل إتمام حزب', style: ui(weight: FontWeight.w700)),
        content: TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'رقم الحزب (1–60)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('تسجيل')),
        ],
      ),
    );
    if (ok != true) return;
    final n = int.tryParse(ctrl.text.trim());
    if (n == null) {
      showToast(context, 'رقم حزب غير صالح', error: true);
      return;
    }
    try {
      await widget.api.post('/memorization/hizb-completions', {
        if (widget.studentId != null) 'studentId': widget.studentId,
        'hizbNumber': n,
      });
      if (mounted) showToast(context, 'تم تسجيل الحزب $n');
      await _load();
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _passAssessment(Map<String, dynamic> a) async {
    try {
      await widget.api.post('/memorization/assessments', {
        'studentId': widget.studentId ?? '',
        'assessmentId': a['id'],
        'status': 'passed',
        'notes': 'ناجح',
      });
      if (mounted) showToast(context, 'تم اعتماد التقييم وإصدار الشهادة');
      await _load();
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (error != null) {
      return SoftPanel(
        child: Column(
          children: [
            Text(error!, style: ui(color: Brand.danger)),
            TextButton(onPressed: _load, child: const Text('إعادة المحاولة')),
          ],
        ),
      );
    }

    final needsSetup = snap?['needsSetup'] == true;
    final plan = snap?['plan'] as Map<String, dynamic>?;
    final progress = snap?['progress'] as Map<String, dynamic>?;
    final cycle = snap?['cycle'] as Map<String, dynamic>? ?? {};
    final achievements = (snap?['achievements'] as List?) ?? [];
    final assessments = (snap?['assessments'] as List?) ?? [];
    final certificates = (snap?['certificates'] as List?) ?? [];
    final canEdit = perms?['canEditPlan'] == true;
    final canReset = perms?['canReset'] == true;
    final canHizb = perms?['canRecordHizb'] == true;
    final canAssess = perms?['canManageAssessments'] == true;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionTitle(
          widget.studentName == null
              ? 'تقدّم الحفظ'
              : 'تقدّم الحفظ · ${widget.studentName}',
        ),
        if (needsSetup)
          SoftPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('لم تُعدّ خطة الحفظ بعد', style: ui(weight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(
                  'حدّد سورة وآية البداية والوتيرة اليومية (نصف صفحة / صفحة).',
                  style: ui(size: 13, color: Brand.muted),
                ),
                const SizedBox(height: 12),
                if (canEdit)
                  FilledButton.icon(
                    onPressed: _openSetup,
                    icon: const Icon(Icons.flag_outlined),
                    label: const Text('إعداد خطة الحفظ'),
                  ),
              ],
            ),
          )
        else ...[
          SoftPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('الخطة', style: ui(weight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(
                  'البداية: ${plan?['startSurahNumber']}. ${plan?['startSurahName']} آية ${plan?['startAyah']}',
                  style: ui(size: 13),
                ),
                Text(
                  'الوتيرة: ${plan?['paceLabel'] ?? plan?['pace']}',
                  style: ui(size: 13, color: Brand.muted),
                ),
                if (progress != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    'الموضع الحالي: ${progress['currentSurahNumber']}. ${progress['currentSurahName']} آية ${progress['currentAyah']}',
                    style: ui(size: 13),
                  ),
                ],
                if (canEdit) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      OutlinedButton(onPressed: _editPace, child: const Text('تعديل الوتيرة')),
                      OutlinedButton(onPressed: _editStart, child: const Text('تعديل البداية')),
                      if (canReset && widget.studentId != null)
                        OutlinedButton(
                          onPressed: _reset,
                          style: OutlinedButton.styleFrom(foregroundColor: Brand.danger),
                          child: const Text('إعادة ضبط'),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 10),
          SoftPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'دورة ${cycle['number'] ?? 1} · ${(cycle['completedHizbs'] ?? 0)}/${cycle['targetHizbs'] ?? 10} أحزاب',
                        style: ui(weight: FontWeight.w700),
                      ),
                    ),
                    Text('${cycle['percent'] ?? 0}%', style: ui(weight: FontWeight.w800, color: Brand.forest)),
                  ],
                ),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: ((cycle['percent'] as num?)?.toDouble() ?? 0) / 100,
                    minHeight: 10,
                    backgroundColor: Brand.mist,
                    color: Brand.forestMid,
                  ),
                ),
                if (cycle['readyForAssessment'] == true) ...[
                  const SizedBox(height: 8),
                  StatusChip(label: 'جاهز للتقييم', tone: ChipTone.ok),
                ],
                if (canHizb) ...[
                  const SizedBox(height: 10),
                  FilledButton.tonal(
                    onPressed: _completeHizb,
                    child: const Text('تسجيل إتمام حزب'),
                  ),
                ],
              ],
            ),
          ),
          if (!widget.compact) ...[
            const SizedBox(height: 12),
            const SectionTitle('الأوسمة والإنجازات'),
            if (achievements.isEmpty)
              SoftPanel(
                child: Text('لا أوسمة بعد — تُحفظ عند إتمام الأحزاب ولا تُحذف عند إعادة الضبط', style: ui(size: 13, color: Brand.muted)),
              )
            else
              ...achievements.take(8).map((raw) {
                final a = Map<String, dynamic>.from(raw as Map);
                return SoftPanel(
                  margin: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      const Icon(Icons.military_tech_outlined, color: Brand.gold),
                      const SizedBox(width: 8),
                      Expanded(child: Text('${a['title']}', style: ui(size: 13, weight: FontWeight.w600))),
                    ],
                  ),
                );
              }),
            const SizedBox(height: 8),
            const SectionTitle('التقييمات والشهادات'),
            if (assessments.isEmpty && certificates.isEmpty)
              SoftPanel(
                child: Text('تظهر التقييمات بعد إتمام 10 أحزاب في الدورة', style: ui(size: 13, color: Brand.muted)),
              ),
            ...assessments.take(5).map((raw) {
              final a = Map<String, dynamic>.from(raw as Map);
              return SoftPanel(
                margin: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'دورة ${a['cycleNumber']} · ${a['status']}',
                        style: ui(size: 13),
                      ),
                    ),
                    if (canAssess && a['status'] == 'pending')
                      TextButton(
                        onPressed: () => _passAssessment(a),
                        child: const Text('ناجح'),
                      ),
                  ],
                ),
              );
            }),
            ...certificates.take(5).map((raw) {
              final c = Map<String, dynamic>.from(raw as Map);
              return SoftPanel(
                margin: const EdgeInsets.only(bottom: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${c['title']}', style: ui(weight: FontWeight.w700, size: 13)),
                    Text('${c['serialCode']}', style: ui(size: 11, color: Brand.muted)),
                  ],
                ),
              );
            }),
          ],
        ],
      ],
    );
  }
}

class _SetupSheet extends StatefulWidget {
  const _SetupSheet({required this.catalog, required this.onSubmit});
  final QalunCatalog catalog;
  final Future<void> Function(QalunSurah surah, int ayah, String pace) onSubmit;

  @override
  State<_SetupSheet> createState() => _SetupSheetState();
}

class _SetupSheetState extends State<_SetupSheet> {
  QalunSurah? surah;
  int ayah = 1;
  String pace = 'half_page';
  bool confirmNew = false;
  bool confirmSequential = false;
  bool saving = false;

  @override
  Widget build(BuildContext context) {
    final maxAyah = surah?.ayahCount ?? 1;
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('إعداد خطة الحفظ', style: ui(size: 18, weight: FontWeight.w700)),
            Text('قالون عن نافع · ${widget.catalog.totalAyahs} آية', style: ui(size: 12, color: Brand.muted)),
            const SizedBox(height: 12),
            DropdownButtonFormField<int>(
              value: surah?.number,
              decoration: const InputDecoration(labelText: 'سورة البداية'),
              items: widget.catalog.surahs
                  .map((s) => DropdownMenuItem(value: s.number, child: Text('${s.number}. ${s.nameAr}')))
                  .toList(),
              onChanged: (n) {
                if (n == null) return;
                setState(() {
                  surah = widget.catalog.byNumber(n);
                  ayah = 1;
                });
              },
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<int>(
              value: surah == null ? null : ayah.clamp(1, maxAyah),
              decoration: const InputDecoration(labelText: 'آية البداية'),
              items: [
                for (var i = 1; i <= maxAyah; i++)
                  DropdownMenuItem(value: i, child: Text('$i')),
              ],
              onChanged: surah == null ? null : (v) => setState(() => ayah = v ?? 1),
            ),
            const SizedBox(height: 8),
            Text('الوتيرة اليومية', style: ui(weight: FontWeight.w600)),
            RadioListTile<String>(
              title: Text('نصف صفحة', style: ui()),
              value: 'half_page',
              groupValue: pace,
              onChanged: (v) => setState(() => pace = v!),
            ),
            RadioListTile<String>(
              title: Text('صفحة كاملة', style: ui()),
              value: 'one_page',
              groupValue: pace,
              onChanged: (v) => setState(() => pace = v!),
            ),
            CheckboxListTile(
              value: confirmNew,
              onChanged: (v) => setState(() => confirmNew = v ?? false),
              title: Text('أؤكد أن هذه بداية جديدة', style: ui(size: 13)),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
            ),
            CheckboxListTile(
              value: confirmSequential,
              onChanged: (v) => setState(() => confirmSequential = v ?? false),
              title: Text('أؤكد أن الحفظ سيكون متسلسلاً', style: ui(size: 13)),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: saving || surah == null || !confirmNew || !confirmSequential
                  ? null
                  : () async {
                      setState(() => saving = true);
                      try {
                        await widget.onSubmit(surah!, ayah, pace);
                        if (context.mounted) Navigator.pop(context, true);
                      } catch (e) {
                        if (context.mounted) {
                          showToast(context, e.toString(), error: true);
                          setState(() => saving = false);
                        }
                      }
                    },
              child: Text(saving ? 'جاري الحفظ…' : 'تأكيد الإعداد'),
            ),
          ],
        ),
      ),
    );
  }
}
