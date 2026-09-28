import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/widgets.dart';

String requestTypeLabel(String? type) {
  switch (type) {
    case 'daily_report_excuse':
      return 'عذر تقرير يومي';
    case 'weekly_session_absence':
      return 'غياب مجلس تسميع';
    default:
      return type ?? 'طلب';
  }
}

String requestStatusLabel(String? status) {
  switch (status) {
    case 'pending':
      return 'قيد المراجعة';
    case 'approved':
      return 'مقبول';
    case 'rejected':
      return 'مرفوض';
    case 'cancelled':
      return 'ملغى';
    default:
      return status ?? '';
  }
}

ChipTone requestStatusTone(String? status) {
  switch (status) {
    case 'approved':
      return ChipTone.ok;
    case 'rejected':
      return ChipTone.danger;
    case 'pending':
      return ChipTone.warn;
    default:
      return ChipTone.neutral;
  }
}

/// Student: create + history of excuses/requests.
class StudentRequestsPage extends StatefulWidget {
  const StudentRequestsPage({super.key, required this.api, this.groupId});
  final ApiClient api;
  final String? groupId;

  @override
  State<StudentRequestsPage> createState() => _StudentRequestsPageState();
}

class _StudentRequestsPageState extends State<StudentRequestsPage> {
  List<dynamic> rows = [];
  bool loading = true;
  String type = 'daily_report_excuse';
  final reasonCtrl = TextEditingController();
  DateTime date = DateTime.now();
  String? filePath;
  String? fileName;
  bool sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await widget.api.get('/student-requests') as List<dynamic>;
      setState(() {
        rows = list;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _pickFile() async {
    final res = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png'],
      withData: false,
    );
    if (res == null || res.files.isEmpty) return;
    final f = res.files.first;
    if (f.size > 5 * 1024 * 1024) {
      if (mounted) showToast(context, 'الحد الأقصى للملف 5 ميغابايت', error: true);
      return;
    }
    setState(() {
      filePath = f.path;
      fileName = f.name;
    });
  }

  Future<void> _submit() async {
    if (reasonCtrl.text.trim().isEmpty) {
      showToast(context, 'السبب مطلوب', error: true);
      return;
    }
    setState(() => sending = true);
    try {
      final fields = <String, String>{
        'type': type,
        'relevantDate': date.toIso8601String().substring(0, 10),
        'reason': reasonCtrl.text.trim(),
        if (widget.groupId != null) 'groupId': widget.groupId!,
      };
      await widget.api.postMultipart(
        '/student-requests',
        fields,
        filePath: filePath,
      );
      reasonCtrl.clear();
      filePath = null;
      fileName = null;
      if (mounted) showToast(context, 'تم إرسال الطلب');
      await _load();
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> _cancel(String id) async {
    try {
      await widget.api.patch('/student-requests/$id/cancel', {});
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
          Text('طلبات الأعذار والغياب', style: ui(size: 22, weight: FontWeight.w700)),
          const SizedBox(height: 12),
          SoftPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('طلب جديد', style: ui(weight: FontWeight.w700)),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: type,
                  decoration: const InputDecoration(labelText: 'نوع الطلب'),
                  items: const [
                    DropdownMenuItem(
                      value: 'daily_report_excuse',
                      child: Text('عذر تقرير يومي'),
                    ),
                    DropdownMenuItem(
                      value: 'weekly_session_absence',
                      child: Text('غياب مجلس تسميع'),
                    ),
                  ],
                  onChanged: (v) => setState(() => type = v ?? type),
                ),
                const SizedBox(height: 8),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('التاريخ: ${date.toIso8601String().substring(0, 10)}'),
                  trailing: const Icon(Icons.calendar_today),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: date,
                      firstDate: DateTime.now().subtract(const Duration(days: 60)),
                      lastDate: DateTime.now().add(const Duration(days: 60)),
                    );
                    if (picked != null) setState(() => date = picked);
                  },
                ),
                TextField(
                  controller: reasonCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'السبب *',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _pickFile,
                  icon: const Icon(Icons.attach_file),
                  label: Text(fileName == null ? 'مرفق اختياري (PDF/JPG/PNG)' : fileName!),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: sending ? null : _submit,
                  child: Text(sending ? 'جاري الإرسال…' : 'إرسال الطلب'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Text('سجل الطلبات', style: ui(size: 18, weight: FontWeight.w700)),
          const SizedBox(height: 8),
          if (rows.isEmpty)
            const EmptyState(
              icon: Icons.inbox_outlined,
              title: 'لا طلبات بعد',
              subtitle: 'ستظهر هنا طلبات الأعذار والغياب',
            )
          else
            ...rows.map((raw) {
              final r = raw as Map<String, dynamic>;
              final status = '${r['status']}';
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: SoftPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              requestTypeLabel('${r['type']}'),
                              style: ui(weight: FontWeight.w700),
                            ),
                          ),
                          StatusChip(
                            label: requestStatusLabel(status),
                            tone: requestStatusTone(status),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text('التاريخ: ${r['relevantDate']}', style: ui(color: Brand.muted)),
                      Text('${r['reason']}', style: ui()),
                      if (r['hasAttachment'] == true)
                        Text('📎 مرفق', style: ui(color: Brand.muted)),
                      if (r['reviewerNote'] != null)
                        Text('ملاحظة المراجع: ${r['reviewerNote']}', style: ui()),
                      if (r['reviewedAt'] != null)
                        Text(
                          'تاريخ المراجعة: ${'${r['reviewedAt']}'.substring(0, 10)}',
                          style: ui(color: Brand.muted, size: 12),
                        ),
                      if (status == 'pending') ...[
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () => _cancel('${r['id']}'),
                          child: const Text('إلغاء الطلب'),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}

/// Teacher/supervisor review queue.
class StaffRequestsPage extends StatefulWidget {
  const StaffRequestsPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<StaffRequestsPage> createState() => _StaffRequestsPageState();
}

class _StaffRequestsPageState extends State<StaffRequestsPage> {
  List<dynamic> rows = [];
  bool loading = true;
  String filter = 'pending';
  final noteCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final q = filter == 'all' ? '' : '?status=$filter';
      final list = await widget.api.get('/student-requests$q') as List<dynamic>;
      setState(() {
        rows = list;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _review(String id, bool approve) async {
    try {
      await widget.api.patch('/student-requests/$id/review', {
        'approve': approve,
        if (noteCtrl.text.trim().isNotEmpty) 'reviewerNote': noteCtrl.text.trim(),
      });
      noteCtrl.clear();
      if (mounted) {
        showToast(context, approve ? 'تمت الموافقة' : 'تم الرفض');
      }
      await _load();
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    final pendingCount =
        rows.where((r) => (r as Map)['status'] == 'pending').length;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('طلبات الأعذار', style: ui(size: 22, weight: FontWeight.w700)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(
                label: Text('معلّقة ($pendingCount)'),
                selected: filter == 'pending',
                onSelected: (_) {
                  setState(() => filter = 'pending');
                  _load();
                },
              ),
              ChoiceChip(
                label: const Text('الكل'),
                selected: filter == 'all',
                onSelected: (_) {
                  setState(() => filter = 'all');
                  _load();
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: noteCtrl,
            decoration: const InputDecoration(
              labelText: 'ملاحظة المراجعة (اختياري)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          if (rows.isEmpty)
            const EmptyState(
              icon: Icons.mark_email_read_outlined,
              title: 'لا طلبات',
              subtitle: 'ستظهر طلبات الطلبة هنا للمراجعة',
            )
          else
            ...rows.map((raw) {
              final r = raw as Map<String, dynamic>;
              final student = r['student'] as Map<String, dynamic>?;
              final status = '${r['status']}';
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: SoftPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${student?['firstName'] ?? ''} ${student?['lastName'] ?? ''}',
                        style: ui(weight: FontWeight.w700, size: 16),
                      ),
                      Text(requestTypeLabel('${r['type']}'), style: ui()),
                      Text('${r['relevantDate']}', style: ui(color: Brand.muted)),
                      Text('${r['reason']}'),
                      if (r['hasAttachment'] == true)
                        Text('📎 مرفق متاح', style: ui(color: Brand.muted)),
                      StatusChip(
                        label: requestStatusLabel(status),
                        tone: requestStatusTone(status),
                      ),
                      if (status == 'pending') ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: FilledButton(
                                onPressed: () => _review('${r['id']}', true),
                                child: const Text('قبول'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => _review('${r['id']}', false),
                                child: const Text('رفض'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
