import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

const apiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'http://127.0.0.1:43124/api',
);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ErtakiApp());
}

class ErtakiApp extends StatelessWidget {
  const ErtakiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ارتق',
      debugShowCheckedModeBanner: false,
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1F6B4A),
          brightness: Brightness.light,
        ),
        fontFamily: 'Roboto',
      ),
      home: const Directionality(
        textDirection: TextDirection.rtl,
        child: GatePage(),
      ),
    );
  }
}

class ApiClient {
  ApiClient(this.token);
  String? token;

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$apiBase$path'),
      headers: _headers(),
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  Future<dynamic> get(String path) async {
    final res = await http.get(Uri.parse('$apiBase$path'), headers: _headers());
    return _decode(res);
  }

  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) async {
    final res = await http.patch(
      Uri.parse('$apiBase$path'),
      headers: _headers(),
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  Map<String, String> _headers() => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  dynamic _decode(http.Response res) {
    final body = res.body.isEmpty ? {} : jsonDecode(res.body);
    if (res.statusCode >= 400) {
      throw Exception(body is Map && body['message'] != null
          ? body['message'].toString()
          : 'خطأ ${res.statusCode}');
    }
    return body;
  }
}

class GatePage extends StatefulWidget {
  const GatePage({super.key});

  @override
  State<GatePage> createState() => _GatePageState();
}

class _GatePageState extends State<GatePage> {
  final phoneCtrl = TextEditingController(text: '0500000003');
  final passCtrl = TextEditingController(text: 'password123');
  String? error;
  bool loading = false;

  Future<void> login() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final api = ApiClient(null);
      final res = await api.post('/auth/login', {
        'phone': phoneCtrl.text.trim(),
        'password': passCtrl.text,
      });
      final token = res['accessToken'] as String;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', token);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => HomeShell(token: token)),
      );
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [Color(0xFFF3EFE6), Color(0xFFD7EBE0)],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'ارتق',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.displaySmall?.copyWith(
                            color: const Color(0xFF1F6B4A),
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'متابعة حفظ القرآن الكريم',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 32),
                    TextField(
                      controller: phoneCtrl,
                      decoration: const InputDecoration(
                        labelText: 'رقم الهاتف',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.phone,
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: passCtrl,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'كلمة المرور',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    if (error != null) ...[
                      const SizedBox(height: 12),
                      Text(error!, style: const TextStyle(color: Colors.red)),
                    ],
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: loading ? null : login,
                      child: Text(loading ? 'جاري الدخول…' : 'دخول'),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'تجريبي طالب 0500000003 / معلم 0500000002 — $apiBase',
                      style: Theme.of(context).textTheme.bodySmall,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.token});
  final String token;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  late final ApiClient api = ApiClient(widget.token);
  Map<String, dynamic>? me;
  String? error;
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
      setState(() => error = e.toString());
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
      return Scaffold(
        body: Center(child: error == null ? const CircularProgressIndicator() : Text(error!)),
      );
    }
    final role = me!['role'] as String;
    final isTeacher = role == 'teacher' || role == 'supervisor' || role == 'admin';
    final pages = isTeacher
        ? [
            TeacherDashboard(api: api),
            GroupsPage(api: api),
            NotificationsPage(api: api),
          ]
        : [
            StudentHome(api: api, me: me!),
            DailyReportPage(api: api),
            NotificationsPage(api: api),
          ];
    final destinations = isTeacher
        ? const [
            NavigationDestination(icon: Icon(Icons.dashboard), label: 'لوحتي'),
            NavigationDestination(icon: Icon(Icons.groups), label: 'المجموعات'),
            NavigationDestination(icon: Icon(Icons.notifications), label: 'إشعارات'),
          ]
        : const [
            NavigationDestination(icon: Icon(Icons.home), label: 'مجموعتي'),
            NavigationDestination(icon: Icon(Icons.edit_note), label: 'تقرير يومي'),
            NavigationDestination(icon: Icon(Icons.notifications), label: 'إشعارات'),
          ];

    return Scaffold(
      appBar: AppBar(
        title: Text('ارتق · ${me!['firstName']}'),
        actions: [
          IconButton(onPressed: logout, icon: const Icon(Icons.logout)),
        ],
      ),
      body: pages[tab],
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (i) => setState(() => tab = i),
        destinations: destinations,
      ),
    );
  }
}

class StudentHome extends StatefulWidget {
  const StudentHome({super.key, required this.api, required this.me});
  final ApiClient api;
  final Map<String, dynamic> me;

  @override
  State<StudentHome> createState() => _StudentHomeState();
}

class _StudentHomeState extends State<StudentHome> {
  Map<String, dynamic>? membership;
  List<dynamic> myReports = [];
  List<dynamic> notes = [];
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final m = await widget.api.get('/memberships/me');
      final reports = await widget.api.get('/daily-reports') as List<dynamic>;
      final n = await widget.api.get('/notes') as List<dynamic>;
      setState(() {
        membership = m is Map<String, dynamic> ? m : null;
        myReports = reports;
        notes = n;
      });
    } catch (e) {
      setState(() => error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null) return Center(child: Text(error!));
    final group = membership?['group'] as Map<String, dynamic>?;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('مرحبًا ${widget.me['firstName']}',
            style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        if (group == null)
          const Text('لست منضمًا لمجموعة بعد. يمكنك طلب الانضمام من قائمة المجموعات لاحقًا.')
        else ...[
          Card(
            child: ListTile(
              title: Text(group['name']?.toString() ?? 'مجموعتي'),
              subtitle: Text(
                '${group['weeklySessionDay']} ${group['weeklySessionTime']}\n'
                'المعلم: ${(group['teacher'] as Map?)?['firstName'] ?? ''}',
              ),
              isThreeLine: true,
              trailing: group['whatsappUrl'] != null
                  ? IconButton(
                      icon: const Icon(Icons.chat),
                      onPressed: () async {
                        final uri = Uri.parse(group['whatsappUrl']);
                        await launchUrl(uri, mode: LaunchMode.externalApplication);
                      },
                    )
                  : null,
            ),
          ),
          const SizedBox(height: 8),
          Text('تقاريري (${myReports.length}) — الزملاء لا يرون تقاريرك',
              style: Theme.of(context).textTheme.titleMedium),
          ...myReports.take(5).map((r) => ListTile(
                title: Text('${r['reportDate']}'),
                subtitle: Text(
                  'القسط: ${r['memorizedQuota'] == true ? 'نعم' : 'لا'} · '
                  '50 تكرار: ${r['completedFiftyRepetitions'] == true ? 'نعم' : 'لا'}',
                ),
              )),
          const SizedBox(height: 8),
          Text('ملاحظات ظاهرة', style: Theme.of(context).textTheme.titleMedium),
          if (notes.isEmpty) const Text('لا ملاحظات بعد'),
          ...notes.map((n) => ListTile(
                title: Text(n['body']?.toString() ?? ''),
                subtitle: Text(n['noteDate']?.toString() ?? ''),
              )),
        ],
      ],
    );
  }
}

class DailyReportPage extends StatefulWidget {
  const DailyReportPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<DailyReportPage> createState() => _DailyReportPageState();
}

class _DailyReportPageState extends State<DailyReportPage> {
  bool memorizedQuota = true;
  bool fifty = true;
  bool oneSitting = true;
  bool tafsir = false;
  final reviewCtrl = TextEditingController(text: 'الحزب 1');
  String? message;
  bool loading = false;

  Future<void> submit() async {
    setState(() {
      loading = true;
      message = null;
    });
    try {
      final today = DateTime.now().toIso8601String().substring(0, 10);
      await widget.api.post('/daily-reports', {
        'reportDate': today,
        'memorizedQuota': memorizedQuota,
        'reviewPortion': reviewCtrl.text.trim(),
        'completedFiftyRepetitions': fifty,
        'repeatedInOneSitting': oneSitting,
        'readTafsir': tafsir,
      });
      setState(() => message = 'تم إرسال التقرير. لا يمكن تعديله بعد الإرسال.');
    } catch (e) {
      setState(() => message = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('التقرير اليومي', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        const Text('حقول منظمة — لا تعديل بعد الإرسال. لا موعد إغلاق حالياً.'),
        SwitchListTile(
          title: const Text('حفظت القسط اليومي'),
          value: memorizedQuota,
          onChanged: (v) => setState(() => memorizedQuota = v),
        ),
        TextField(
          controller: reviewCtrl,
          decoration: const InputDecoration(
            labelText: 'ورد المراجعة',
            border: OutlineInputBorder(),
          ),
        ),
        SwitchListTile(
          title: const Text('أكملت 50 تكراراً'),
          value: fifty,
          onChanged: (v) => setState(() => fifty = v),
        ),
        SwitchListTile(
          title: const Text('التكرار في مجلس واحد'),
          value: oneSitting,
          onChanged: (v) => setState(() => oneSitting = v),
        ),
        SwitchListTile(
          title: const Text('قرأت ورد التفسير'),
          value: tafsir,
          onChanged: (v) => setState(() => tafsir = v),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: loading ? null : submit,
          child: Text(loading ? 'جاري الإرسال…' : 'إرسال التقرير'),
        ),
        if (message != null) ...[
          const SizedBox(height: 12),
          Text(message!),
        ],
      ],
    );
  }
}

class TeacherDashboard extends StatefulWidget {
  const TeacherDashboard({super.key, required this.api});
  final ApiClient api;

  @override
  State<TeacherDashboard> createState() => _TeacherDashboardState();
}

class _TeacherDashboardState extends State<TeacherDashboard> {
  Map<String, dynamic>? data;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await widget.api.get('/dashboards/teacher') as Map<String, dynamic>;
      setState(() => data = d);
    } catch (e) {
      setState(() => error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null) return Center(child: Text(error!));
    if (data == null) return const Center(child: CircularProgressIndicator());
    final groups = (data!['groups'] as List<dynamic>?) ?? [];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('لوحة المعلم — ${data!['today']}',
            style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        const Text('تقارير الطلبة مرئية للمعلم/المشرف فقط.'),
        ...groups.map((g) {
          final group = g['group'] as Map<String, dynamic>;
          return Card(
            child: ListTile(
              title: Text(group['name']?.toString() ?? ''),
              subtitle: Text(
                'طلبة: ${g['studentCount']} · أرسلوا اليوم: ${g['submittedToday']} · '
                'بدون تقرير: ${g['missingToday']} · تقصير مفتوح: ${g['openInfractions']}',
              ),
            ),
          );
        }),
      ],
    );
  }
}

class GroupsPage extends StatefulWidget {
  const GroupsPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<GroupsPage> createState() => _GroupsPageState();
}

class _GroupsPageState extends State<GroupsPage> {
  List<dynamic> groups = [];
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final g = await widget.api.get('/groups') as List<dynamic>;
      setState(() => groups = g);
    } catch (e) {
      setState(() => error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null) return Center(child: Text(error!));
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: groups.length,
      itemBuilder: (_, i) {
        final g = groups[i] as Map<String, dynamic>;
        return Card(
          child: ListTile(
            title: Text(g['name']?.toString() ?? ''),
            subtitle: Text('${g['status']} · ${g['currentStudentCount']}/${g['seatCount']}'),
            trailing: g['whatsappUrl'] != null
                ? IconButton(
                    icon: const Icon(Icons.chat),
                    onPressed: () async {
                      await launchUrl(Uri.parse(g['whatsappUrl']),
                          mode: LaunchMode.externalApplication);
                    },
                  )
                : null,
          ),
        );
      },
    );
  }
}

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<dynamic> items = [];
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final n = await widget.api.get('/notifications') as List<dynamic>;
      setState(() => items = n);
    } catch (e) {
      setState(() => error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null) return Center(child: Text(error!));
    if (items.isEmpty) {
      return const Center(child: Text('لا إشعارات (الطبقة stub تسجّل الأحداث فقط)'));
    }
    return ListView.builder(
      itemCount: items.length,
      itemBuilder: (_, i) {
        final n = items[i] as Map<String, dynamic>;
        return ListTile(
          title: Text(n['title']?.toString() ?? ''),
          subtitle: Text(n['body']?.toString() ?? ''),
          trailing: Text(n['delivered'] == true ? 'أُرسل' : 'stub'),
        );
      },
    );
  }
}
