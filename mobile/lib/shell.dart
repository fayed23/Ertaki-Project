import 'package:flutter/material.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/gate.dart';
import 'package:ertaki_mobile/student_screens.dart';
import 'package:ertaki_mobile/teacher_screens.dart';
import 'package:ertaki_mobile/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.token});
  final String token;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  late final ApiClient api = ApiClient(widget.token);
  Map<String, dynamic>? me;
  int tab = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final user = await api.get('/auth/me') as Map<String, dynamic>;
      setState(() => me = user);
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const GatePage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (me == null) {
      return const Scaffold(
        body: Atmosphere(child: Center(child: CircularProgressIndicator())),
      );
    }
    final role = me!['role'] as String;
    final isTeacher = role == 'teacher' || role == 'supervisor' || role == 'admin';

    final pages = isTeacher
        ? [
            TeacherHome(api: api, me: me!),
            TeacherStudents(api: api),
            TeacherAttendance(api: api),
            NotificationsPage(api: api),
          ]
        : [
            StudentHome(api: api, me: me!, onGoReport: () => setState(() => tab = 2)),
            StudentGroup(api: api),
            StudentDailyReport(api: api),
            StudentProgress(api: api, me: me!),
          ];

    final destinations = isTeacher
        ? const [
            NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'الرئيسية'),
            NavigationDestination(icon: Icon(Icons.groups_outlined), selectedIcon: Icon(Icons.groups), label: 'طلبة'),
            NavigationDestination(icon: Icon(Icons.event_available_outlined), selectedIcon: Icon(Icons.event_available), label: 'حضور'),
            NavigationDestination(icon: Icon(Icons.notifications_outlined), selectedIcon: Icon(Icons.notifications), label: 'إشعارات'),
          ]
        : const [
            NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'الرئيسية'),
            NavigationDestination(icon: Icon(Icons.groups_outlined), selectedIcon: Icon(Icons.groups), label: 'مجموعتي'),
            NavigationDestination(icon: Icon(Icons.edit_note_outlined), selectedIcon: Icon(Icons.edit_note), label: 'تقرير'),
            NavigationDestination(icon: Icon(Icons.insights_outlined), selectedIcon: Icon(Icons.insights), label: 'تقدّمي'),
          ];

    return Scaffold(
      appBar: AppBar(
        title: Text('ارتق', style: brandStyle(size: 26)),
        actions: [
          IconButton(
            tooltip: 'خروج',
            onPressed: logout,
            icon: const Icon(Icons.logout_rounded),
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          ),
        ],
      ),
      body: Atmosphere(child: pages[tab]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (i) => setState(() => tab = i),
        destinations: destinations,
      ),
    );
  }
}
