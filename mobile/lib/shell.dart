import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/gate.dart';
import 'package:ertaki_mobile/groups_catalog.dart';
import 'package:ertaki_mobile/notify.dart';
import 'package:ertaki_mobile/notifications_inbox.dart';
import 'package:ertaki_mobile/student_screens.dart';
import 'package:ertaki_mobile/supervisor_screens.dart';
import 'package:ertaki_mobile/teacher_screens.dart';
import 'package:ertaki_mobile/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.token});
  final String token;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  late final ApiClient api = ApiClient(widget.token);
  Map<String, dynamic>? me;
  bool? studentHasGroup;
  int tab = 0;
  late final PageController _pageController = PageController();
  final List<GlobalKey<NavigatorState>> _navKeys = List.generate(
    4,
    (_) => GlobalKey<NavigatorState>(),
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pageController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      NotifyHub.instance.pollAndAlert(api);
    }
  }

  Future<void> _load() async {
    try {
      final user = await api.get('/auth/me') as Map<String, dynamic>;
      bool? hasGroup;
      if (user['role'] == 'student') {
        final h = await api.get('/memberships/has-group') as Map<String, dynamic>;
        hasGroup = h['hasGroup'] == true;
      }
      setState(() {
        me = user;
        studentHasGroup = hasGroup;
      });
      await NotifyHub.instance.registerDevice(api);
      await NotifyHub.instance.pollAndAlert(api);
      if (user['role'] == 'student' && hasGroup == true) {
        await _syncStudentReminder();
      }
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    }
  }

  Future<void> _syncStudentReminder() async {
    try {
      final reports = await api.get('/daily-reports') as List<dynamic>;
      final submitted = reports.any((r) => r['reportDate'] == todayIso());
      final cfg = await api.get('/report-deadline-config');
      final list = cfg is List ? cfg : (cfg is Map ? [cfg] : []);
      final row = list.isNotEmpty ? list.first as Map<String, dynamic> : null;
      if (submitted || row == null || row['enabled'] != true) {
        await NotifyHub.instance.cancelDeadlineReminder();
        return;
      }
      final close = '${row['closeTimeLocal'] ?? '23:59'}';
      final parts = close.split(':');
      final closeH = int.tryParse(parts[0]) ?? 23;
      final closeM = int.tryParse(parts.length > 1 ? parts[1] : '59') ?? 59;
      final before = (row['reminderMinutesBefore'] as num?)?.toInt() ?? 60;
      var mins = closeH * 60 + closeM - before;
      if (mins < 0) mins = 0;
      await NotifyHub.instance.scheduleStudentDeadlineReminder(
        hour: mins ~/ 60,
        minute: mins % 60,
      );
    } catch (_) {}
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const GatePage()),
    );
  }

  void _goTab(int i, {bool animate = true}) {
    final safe = i.clamp(0, _navKeys.length - 1);
    setState(() => tab = safe);
    if (!_pageController.hasClients) return;
    if (animate) {
      _pageController.animateToPage(
        safe,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOutCubic,
      );
    } else {
      _pageController.jumpToPage(safe);
    }
  }

  Future<void> _onSystemBack() async {
    final safeTab = tab.clamp(0, _navKeys.length - 1);
    final nav = _navKeys[safeTab].currentState;
    if (nav != null && nav.canPop()) {
      nav.pop();
      return;
    }
    if (safeTab != 0) {
      _goTab(0);
      return;
    }
    final shouldExit = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Brand.paper,
        title: Text('خروج من التطبيق؟', style: ui(weight: FontWeight.w700)),
        content: Text('اضغط خروج لإغلاق ارتق.', style: ui()),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('خروج'),
          ),
        ],
      ),
    );
    if (shouldExit == true) {
      SystemNavigator.pop();
    }
  }

  Widget _tabNavigator(int index, Widget root) {
    return ColoredBox(
      color: Brand.mist,
      child: Navigator(
        key: _navKeys[index],
        onGenerateRoute: (settings) {
          return MaterialPageRoute(
            settings: settings,
            builder: (_) => ColoredBox(
              color: Brand.mist,
              child: root,
            ),
          );
        },
      ),
    );
  }

  Widget _pushNotifications(String role) {
    return Scaffold(
      backgroundColor: Brand.mist,
      appBar: AppBar(
        title: Text('الإشعارات', style: ui(size: 18, weight: FontWeight.w700)),
      ),
      body: Atmosphere(child: NotificationsPage(api: api, role: role)),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (me == null || (me!['role'] == 'student' && studentHasGroup == null)) {
      return const Scaffold(
        backgroundColor: Brand.mist,
        body: Atmosphere(child: Center(child: CircularProgressIndicator())),
      );
    }
    final role = me!['role'] as String;
    final isSupervisor = role == 'supervisor' || role == 'admin';
    final isTeacher = role == 'teacher';
    final needsGroup = role == 'student' && studentHasGroup != true;

    if (needsGroup) {
      return PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) async {
          if (didPop) return;
          final shouldExit = await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              backgroundColor: Brand.paper,
              title: Text('خروج من التطبيق؟', style: ui(weight: FontWeight.w700)),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(false),
                  child: const Text('إلغاء'),
                ),
                FilledButton(
                  onPressed: () => Navigator.of(ctx).pop(true),
                  child: const Text('خروج'),
                ),
              ],
            ),
          );
          if (shouldExit == true) SystemNavigator.pop();
        },
        child: Scaffold(
          backgroundColor: Brand.mist,
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
          body: Atmosphere(
            child: GroupsCatalogPage(
              api: api,
              locked: true,
              onMembershipUnlocked: () {
                setState(() => studentHasGroup = true);
                _syncStudentReminder();
              },
            ),
          ),
        ),
      );
    }

    late final List<Widget> pages;
    late final List<NavigationDestination> destinations;

    if (isSupervisor) {
      pages = [
        SupervisorHome(
          api: api,
          me: me!,
          onGoJoins: () {
            _navKeys[0].currentState?.push(
              MaterialPageRoute(
                builder: (_) => Scaffold(
                  backgroundColor: Brand.mist,
                  appBar: AppBar(
                    title: Text('طلبات الانضمام', style: ui(size: 18, weight: FontWeight.w700)),
                  ),
                  body: Atmosphere(child: SupervisorJoins(api: api)),
                ),
              ),
            );
          },
          onOpenNotifications: () {
            _navKeys[0].currentState?.push(
              MaterialPageRoute(builder: (_) => _pushNotifications('supervisor')),
            );
          },
        ),
        SupervisorJoins(api: api),
        SupervisorGroups(api: api),
        NotificationsPage(api: api, role: 'supervisor'),
      ];
      destinations = const [
        NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'الرئيسية'),
        NavigationDestination(icon: Icon(Icons.how_to_reg_outlined), selectedIcon: Icon(Icons.how_to_reg), label: 'طلبات'),
        NavigationDestination(icon: Icon(Icons.groups_outlined), selectedIcon: Icon(Icons.groups), label: 'مجموعات'),
        NavigationDestination(icon: Icon(Icons.notifications_outlined), selectedIcon: Icon(Icons.notifications), label: 'إشعارات'),
      ];
    } else if (isTeacher) {
      pages = [
        TeacherHome(
          api: api,
          me: me!,
          onOpenNotifications: () {
            _navKeys[0].currentState?.push(
              MaterialPageRoute(builder: (_) => _pushNotifications('teacher')),
            );
          },
        ),
        TeacherStudents(api: api),
        TeacherAttendance(api: api),
        NotificationsPage(api: api, role: 'teacher'),
      ];
      destinations = const [
        NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'الرئيسية'),
        NavigationDestination(icon: Icon(Icons.groups_outlined), selectedIcon: Icon(Icons.groups), label: 'طلبة'),
        NavigationDestination(icon: Icon(Icons.event_available_outlined), selectedIcon: Icon(Icons.event_available), label: 'حضور'),
        NavigationDestination(icon: Icon(Icons.notifications_outlined), selectedIcon: Icon(Icons.notifications), label: 'إشعارات'),
      ];
    } else {
      pages = [
        StudentHome(api: api, me: me!, onGoReport: () => _goTab(2)),
        StudentGroup(api: api),
        StudentDailyReport(api: api, onSubmitted: _syncStudentReminder),
        StudentProgress(api: api, me: me!),
      ];
      destinations = const [
        NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'الرئيسية'),
        NavigationDestination(icon: Icon(Icons.groups_outlined), selectedIcon: Icon(Icons.groups), label: 'مجموعتي'),
        NavigationDestination(icon: Icon(Icons.edit_note_outlined), selectedIcon: Icon(Icons.edit_note), label: 'تقرير'),
        NavigationDestination(icon: Icon(Icons.insights_outlined), selectedIcon: Icon(Icons.insights), label: 'تقدّمي'),
      ];
    }

    final safeTab = tab.clamp(0, pages.length - 1);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        await _onSystemBack();
      },
      child: Scaffold(
        backgroundColor: Brand.mist,
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
        body: Atmosphere(
          child: PageView(
            controller: _pageController,
            onPageChanged: (i) => setState(() => tab = i),
            children: [
              for (var i = 0; i < pages.length; i++) _tabNavigator(i, pages[i]),
            ],
          ),
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: safeTab,
          onDestinationSelected: (i) {
            if (i == safeTab) {
              _navKeys[i].currentState?.popUntil((r) => r.isFirst);
            } else {
              _goTab(i);
            }
          },
          destinations: destinations,
        ),
      ),
    );
  }
}
