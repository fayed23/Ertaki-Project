import 'package:flutter/material.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/groups_catalog.dart';
import 'package:ertaki_mobile/report_detail.dart';
import 'package:ertaki_mobile/supervisor_screens.dart';
import 'package:ertaki_mobile/teacher_screens.dart';
import 'package:ertaki_mobile/widgets.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({
    super.key,
    required this.api,
    this.role = 'teacher',
  });
  final ApiClient api;
  final String role;

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<dynamic> items = [];
  bool loading = true;
  bool clearing = false;

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

  Future<void> _markAllRead() async {
    try {
      await widget.api.post('/notifications/mark-read', {});
      await _load();
      if (mounted) showToast(context, 'تم تعليم الإشعارات كمقروءة');
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _clearAll() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Brand.paper,
        title: Text('مسح كل الإشعارات؟', style: ui(weight: FontWeight.w700)),
        content: Text('لا يمكن التراجع عن هذا الإجراء.', style: ui()),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('مسح')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => clearing = true);
    try {
      final res = await widget.api.post('/notifications/clear', {});
      final n = (res['cleared'] as num?)?.toInt() ?? 0;
      await _load();
      if (mounted) showToast(context, 'تم مسح $n إشعاراً');
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => clearing = false);
    }
  }

  Future<bool> _deleteOne(Map<String, dynamic> item) async {
    final id = item['id']?.toString();
    if (id == null || id.isEmpty) return false;
    try {
      await widget.api.delete('/notifications/$id');
      return true;
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
      return false;
    }
  }

  Future<void> _openNotification(Map<String, dynamic> item) async {
    final id = item['id']?.toString();
    if (id != null && item['readAt'] == null) {
      try {
        await widget.api.post('/notifications/mark-read', {'ids': [id]});
      } catch (_) {}
    }
    final type = '${item['type'] ?? ''}';
    final payload = item['payload'] is Map
        ? Map<String, dynamic>.from(item['payload'] as Map)
        : <String, dynamic>{};
    final reportId = payload['reportId']?.toString();
    final groupId = payload['groupId']?.toString();
    final groupName = payload['groupName']?.toString() ?? 'مجموعة';

    Widget? page;
    if (type == 'daily_report_submitted' &&
        reportId != null &&
        reportId.isNotEmpty &&
        widget.role == 'teacher') {
      await openDailyReportDetail(context, widget.api, reportId: reportId);
      await _load();
      return;
    }
    if (type == 'weekly_report_staff' || type == 'weekly_report') {
      if (widget.role == 'teacher') {
        page = WeeklyReportsPage(api: widget.api);
      }
    } else if (type == 'trimestrial_report_staff') {
      page = TrimestrialReportsPage(api: widget.api);
    } else if (type == 'join_request') {
      page = widget.role == 'teacher'
          ? TeacherJoinsPage(api: widget.api)
          : SupervisorJoins(api: widget.api);
    } else if (type == 'account_pending_approval' || type == 'account_approved' || type == 'account_rejected') {
      if (widget.role == 'supervisor' || widget.role == 'admin') {
        page = SupervisorJoins(api: widget.api);
      }
    } else if (type == 'group_pending_approval' || type == 'group_updated') {
      if (widget.role == 'supervisor' || widget.role == 'admin') {
        page = SupervisorGroups(api: widget.api);
      } else if (groupId != null && groupId.isNotEmpty) {
        page = GroupDetailPage(api: widget.api, groupId: groupId, groupName: groupName);
      }
    } else if (type == 'group_approved' || type == 'group_rejected') {
      if (groupId != null && groupId.isNotEmpty) {
        page = GroupDetailPage(api: widget.api, groupId: groupId, groupName: groupName);
      } else if (widget.role == 'teacher') {
        page = TeacherGroupsPage(api: widget.api);
      }
    } else if (type == 'excuse_submitted' ||
        type == 'attendance_recorded' ||
        type == 'absence_recorded') {
      if (widget.role == 'teacher') {
        page = TeacherAttendance(api: widget.api);
      }
    }

    if (page != null && mounted) {
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => page!));
    }
    await _load();
  }

  String? _hint(String type) {
    switch (type) {
      case 'daily_report_submitted':
        return 'اضغط لفتح التقرير';
      case 'weekly_report_staff':
      case 'weekly_report':
        return 'اضغط لفتح التقارير الأسبوعية';
      case 'trimestrial_report_staff':
        return 'اضغط لفتح التقارير الفصلية';
      case 'join_request':
        return 'اضغط لمراجعة طلب الانضمام';
      case 'account_pending_approval':
        return 'اضغط لمراجعة تفعيل الحساب';
      case 'group_pending_approval':
      case 'group_approved':
      case 'group_rejected':
      case 'group_updated':
        return 'اضغط لفتح المجموعة';
      case 'excuse_submitted':
      case 'attendance_recorded':
      case 'absence_recorded':
        return 'اضغط لفتح الحضور';
      default:
        return null;
    }
  }

  Widget _dismissBg({required Alignment align}) {
    return Container(
      alignment: align,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: Brand.danger.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Icon(Icons.delete_outline_rounded, color: Brand.danger),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    final unread = items.where((n) => (n as Map)['readAt'] == null).length;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: Text('الإشعارات', style: ui(size: 22, weight: FontWeight.w700)),
              ),
              if (items.isNotEmpty) ...[
                TextButton(
                  onPressed: unread == 0 ? null : _markAllRead,
                  child: const Text('قراءة الكل'),
                ),
                TextButton(
                  onPressed: clearing ? null : _clearAll,
                  child: Text(clearing ? '…' : 'مسح الكل', style: ui(color: Brand.danger, weight: FontWeight.w700)),
                ),
              ],
            ],
          ),
          if (unread > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text('$unread غير مقروء', style: ui(size: 13, color: Brand.muted)),
            ),
          const SizedBox(height: 4),
          if (items.isEmpty)
            const EmptyState(
              icon: Icons.notifications_none,
              title: 'لا إشعارات',
              subtitle: 'ستظهر هنا تنبيهات القبول والملاحظات والتقارير',
            )
          else
            ...items.map((n) {
              final item = Map<String, dynamic>.from(n as Map);
              final type = '${item['type'] ?? ''}';
              final hint = _hint(type);
              final isSupervisor = widget.role == 'supervisor' || widget.role == 'admin';
              final reportLockedForSupervisor = isSupervisor &&
                  (type == 'daily_report_submitted' ||
                      type == 'weekly_report_staff' ||
                      type == 'weekly_report');
              final tappable = hint != null && !reportLockedForSupervisor;
              final unreadItem = item['readAt'] == null;
              final id = '${item['id'] ?? ''}';
              return Dismissible(
                key: ValueKey('notif-$id'),
                direction: DismissDirection.horizontal,
                background: _dismissBg(align: Alignment.centerRight),
                secondaryBackground: _dismissBg(align: Alignment.centerLeft),
                confirmDismiss: (_) => _deleteOne(item),
                onDismissed: (_) {
                  setState(() {
                    items = items.where((e) => '${(e as Map)['id']}' != id).toList();
                  });
                },
                child: SoftPanel(
                  margin: const EdgeInsets.only(bottom: 8),
                  onTap: tappable
                      ? () => _openNotification(item)
                      : () async {
                          if (unreadItem && item['id'] != null) {
                            await widget.api.post('/notifications/mark-read', {
                              'ids': [item['id']],
                            });
                            await _load();
                          }
                        },
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (unreadItem)
                            Container(
                              width: 8,
                              height: 8,
                              margin: const EdgeInsets.only(left: 8),
                              decoration: const BoxDecoration(
                                color: Brand.gold,
                                shape: BoxShape.circle,
                              ),
                            ),
                          Expanded(
                            child: Text('${item['title']}', style: ui(weight: FontWeight.w700)),
                          ),
                          if (tappable)
                            Text('فتح', style: ui(size: 12, color: Brand.forestMid, weight: FontWeight.w700)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text('${item['body']}', style: ui(color: Brand.muted)),
                      if (tappable && hint != null) ...[
                        const SizedBox(height: 6),
                        Text(hint, style: ui(size: 12, color: Brand.forestMid)),
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
