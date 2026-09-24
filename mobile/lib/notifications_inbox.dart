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

  Future<void> _openNotification(Map<String, dynamic> item) async {
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
      return;
    }
    if (type == 'weekly_report_staff' || type == 'weekly_report') {
      if (widget.role == 'teacher') {
        page = WeeklyReportsPage(api: widget.api);
      }
    } else if (type == 'join_request') {
      page = widget.role == 'teacher'
          ? TeacherJoinsPage(api: widget.api)
          : SupervisorJoins(api: widget.api);
    } else if (type == 'account_pending_approval' || type == 'account_approved' || type == 'account_rejected') {
      if (widget.role == 'supervisor' || widget.role == 'admin') {
        page = SupervisorJoins(api: widget.api);
      }
    } else if (type == 'group_pending_approval') {
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
  }

  String? _hint(String type) {
    switch (type) {
      case 'daily_report_submitted':
        return 'اضغط لفتح التقرير';
      case 'weekly_report_staff':
      case 'weekly_report':
        return 'اضغط لفتح التقارير الأسبوعية';
      case 'join_request':
        return 'اضغط لمراجعة طلب الانضمام';
      case 'account_pending_approval':
        return 'اضغط لمراجعة تفعيل الحساب';
      case 'group_pending_approval':
      case 'group_approved':
      case 'group_rejected':
        return 'اضغط لفتح المجموعة';
      case 'excuse_submitted':
      case 'attendance_recorded':
      case 'absence_recorded':
        return 'اضغط لفتح الحضور';
      default:
        return null;
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
          Text('الإشعارات', style: ui(size: 22, weight: FontWeight.w700)),
          const SizedBox(height: 12),
          if (items.isEmpty)
            const EmptyState(
              icon: Icons.notifications_none,
              title: 'لا إشعارات جديدة',
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
              return SoftPanel(
                margin: const EdgeInsets.only(bottom: 8),
                onTap: tappable ? () => _openNotification(item) : null,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text('${item['title']}', style: ui(weight: FontWeight.w700)),
                        ),
                        if (tappable)
                          Text('فتح', style: ui(size: 12, color: Brand.forestMid, weight: FontWeight.w700)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('${item['body']}', style: ui(color: Brand.muted)),
                    if (tappable) ...[
                      const SizedBox(height: 6),
                      Text(hint!, style: ui(size: 12, color: Brand.forestMid)),
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
