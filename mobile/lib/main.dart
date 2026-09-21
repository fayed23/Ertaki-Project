import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

const apiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'http://127.0.0.1:43124/api',
);

class Brand {
  static const ink = Color(0xFF0B1A14);
  static const inkSoft = Color(0xFF24382E);
  static const muted = Color(0xFF5A7266);
  static const forest = Color(0xFF0F3D2E);
  static const forestMid = Color(0xFF176B4D);
  static const leaf = Color(0xFF2A8F68);
  static const mist = Color(0xFFE8F0EB);
  static const mistDeep = Color(0xFFD3E2DA);
  static const paper = Color(0xFFF7FAF8);
  static const gold = Color(0xFFB8923E);
  static const goldSoft = Color(0xFFF0E4C4);
  static const line = Color(0xFFC5D4CB);
  static const danger = Color(0xFF8F2F2F);
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ErtakiApp());
}

TextStyle displayStyle({
  double size = 48,
  FontWeight weight = FontWeight.w700,
  Color color = Brand.forest,
}) {
  return GoogleFonts.amiri(
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: 1.1,
  );
}

TextStyle bodyStyle({
  double size = 15,
  FontWeight weight = FontWeight.w400,
  Color color = Brand.ink,
}) {
  return GoogleFonts.cairo(
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: 1.45,
  );
}

class ErtakiApp extends StatelessWidget {
  const ErtakiApp({super.key});

  @override
  Widget build(BuildContext context) {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: const ColorScheme.light(
        primary: Brand.forestMid,
        secondary: Brand.gold,
        surface: Brand.paper,
        onPrimary: Brand.paper,
        onSecondary: Brand.ink,
        onSurface: Brand.ink,
        error: Brand.danger,
      ),
      scaffoldBackgroundColor: Brand.mist,
      textTheme: GoogleFonts.cairoTextTheme(),
    );

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
      theme: base.copyWith(
        appBarTheme: AppBarTheme(
          backgroundColor: Colors.transparent,
          elevation: 0,
          centerTitle: true,
          foregroundColor: Brand.ink,
          titleTextStyle: displayStyle(size: 28),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: Brand.forestMid,
            foregroundColor: Brand.paper,
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            textStyle: bodyStyle(size: 16, weight: FontWeight.w700, color: Brand.paper),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Brand.paper.withValues(alpha: 0.9),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Brand.line),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Brand.line),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Brand.leaf, width: 1.4),
          ),
          labelStyle: bodyStyle(color: Brand.muted),
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: Brand.paper.withValues(alpha: 0.92),
          indicatorColor: Brand.leaf.withValues(alpha: 0.18),
          labelTextStyle: WidgetStatePropertyAll(bodyStyle(size: 12, weight: FontWeight.w600)),
        ),
      ),
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: const GatePage(),
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
    return _decode(res) as Map<String, dynamic>;
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
    return _decode(res) as Map<String, dynamic>;
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

class Atmosphere extends StatelessWidget {
  const Atmosphere({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [Brand.paper, Brand.mist, Brand.mistDeep],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -60,
            left: -40,
            child: _Orb(color: Brand.leaf.withValues(alpha: 0.22), size: 180),
          ),
          Positioned(
            bottom: -50,
            right: -30,
            child: _Orb(color: Brand.gold.withValues(alpha: 0.2), size: 160),
          ),
          child,
        ],
      ),
    );
  }
}

class _Orb extends StatelessWidget {
  const _Orb({required this.color, required this.size});
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      ),
    );
  }
}

class SoftPanel extends StatelessWidget {
  const SoftPanel({super.key, required this.child, this.padding});
  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Brand.paper.withValues(alpha: 0.86),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Brand.line),
        boxShadow: [
          BoxShadow(
            color: Brand.ink.withValues(alpha: 0.06),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: child,
    );
  }
}

class GatePage extends StatefulWidget {
  const GatePage({super.key});

  @override
  State<GatePage> createState() => _GatePageState();
}

class _GatePageState extends State<GatePage> with SingleTickerProviderStateMixin {
  final phoneCtrl = TextEditingController(text: '0500000003');
  final passCtrl = TextEditingController(text: 'password123');
  String? error;
  bool loading = false;
  late final AnimationController _anim =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 700))
        ..forward();

  @override
  void dispose() {
    _anim.dispose();
    phoneCtrl.dispose();
    passCtrl.dispose();
    super.dispose();
  }

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
      body: Atmosphere(
        child: SafeArea(
          child: FadeTransition(
            opacity: _anim,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      const SizedBox(height: 24),
                      Text('ارتق', style: displayStyle(size: 64)),
                      const SizedBox(height: 8),
                      Text(
                        'متابعة حفظ القرآن الكريم',
                        style: bodyStyle(size: 16, color: Brand.muted),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 28),
                      SoftPanel(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text('دخول الطالب', style: bodyStyle(size: 20, weight: FontWeight.w700)),
                            const SizedBox(height: 16),
                            TextField(
                              controller: phoneCtrl,
                              keyboardType: TextInputType.phone,
                              textDirection: TextDirection.ltr,
                              decoration: const InputDecoration(labelText: 'رقم الهاتف'),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: passCtrl,
                              obscureText: true,
                              decoration: const InputDecoration(labelText: 'كلمة المرور'),
                            ),
                            if (error != null) ...[
                              const SizedBox(height: 12),
                              Text(error!, style: bodyStyle(size: 13, color: Brand.danger)),
                            ],
                            const SizedBox(height: 18),
                            FilledButton(
                              onPressed: loading ? null : login,
                              child: Text(loading ? 'جاري الدخول…' : 'دخول'),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'تجريبي: 0500000003 / password123',
                              style: bodyStyle(size: 12, color: Brand.muted),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
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
        body: Atmosphere(
          child: Center(
            child: error == null
                ? const CircularProgressIndicator(color: Brand.forestMid)
                : Text(error!, style: bodyStyle(color: Brand.danger)),
          ),
        ),
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
            MyGroupPage(api: api),
            DailyReportPage(api: api),
            ProgressPage(api: api, me: me!),
          ];

    final destinations = isTeacher
        ? const [
            NavigationDestination(icon: Icon(Icons.dashboard_outlined), label: 'لوحتي'),
            NavigationDestination(icon: Icon(Icons.groups_outlined), label: 'المجموعات'),
            NavigationDestination(icon: Icon(Icons.notifications_outlined), label: 'إشعارات'),
          ]
        : const [
            NavigationDestination(icon: Icon(Icons.home_outlined), label: 'الرئيسية'),
            NavigationDestination(icon: Icon(Icons.groups_outlined), label: 'مجموعتي'),
            NavigationDestination(icon: Icon(Icons.edit_note_outlined), label: 'تقرير يومي'),
            NavigationDestination(icon: Icon(Icons.insights_outlined), label: 'تقدمي'),
          ];

    return Scaffold(
      appBar: AppBar(
        title: Text('ارتق', style: displayStyle(size: 30)),
        actions: [
          IconButton(onPressed: logout, icon: const Icon(Icons.logout_rounded)),
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
  Map<String, dynamic>? quota;
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
      final q = await widget.api.get('/quotas');
      setState(() {
        membership = m is Map<String, dynamic> ? m : null;
        myReports = reports;
        notes = n;
        quota = q is Map<String, dynamic> ? q : null;
      });
    } catch (e) {
      setState(() => error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null) {
      return Center(child: Text(error!, style: bodyStyle(color: Brand.danger)));
    }
    final group = membership?['group'] as Map<String, dynamic>?;
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final submittedToday = myReports.any((r) => r['reportDate'] == today);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
      children: [
        Text('ارتق', style: displayStyle(size: 42)),
        const SizedBox(height: 4),
        Text(
          'مرحباً ${widget.me['firstName']} — واصل حفظك بثبات',
          style: bodyStyle(size: 15, color: Brand.muted),
        ),
        const SizedBox(height: 18),
        SoftPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                submittedToday ? 'تم إرسال تقرير اليوم' : 'تقرير اليوم بانتظارك',
                style: bodyStyle(size: 18, weight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              Text(
                group == null
                    ? 'لست منضماً لمجموعة بعد.'
                    : '${group['name']} · القسط: ${quota?['dailyQuotaDescription'] ?? 'يحدده المعلم'}',
                style: bodyStyle(size: 14, color: Brand.muted),
              ),
              const SizedBox(height: 8),
              Text(
                'تقاريرك خاصة بك — الزملاء لا يرونها',
                style: bodyStyle(size: 12, color: Brand.gold),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SoftPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('آخر تقاريري', style: bodyStyle(size: 17, weight: FontWeight.w700)),
              const SizedBox(height: 8),
              if (myReports.isEmpty)
                Text('لا تقارير بعد', style: bodyStyle(color: Brand.muted))
              else
                ...myReports.take(4).map(
                      (r) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text('${r['reportDate']}', style: bodyStyle(weight: FontWeight.w600)),
                            ),
                            Text(
                              r['memorizedQuota'] == true ? 'القسط ✓' : 'القسط ✗',
                              style: bodyStyle(
                                size: 13,
                                color: r['memorizedQuota'] == true ? Brand.forestMid : Brand.danger,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
            ],
          ),
        ),
        if (notes.isNotEmpty) ...[
          const SizedBox(height: 14),
          SoftPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('ملاحظات المعلم', style: bodyStyle(size: 17, weight: FontWeight.w700)),
                ...notes.take(3).map(
                      (n) => Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: Text('${n['body']}', style: bodyStyle(size: 14)),
                      ),
                    ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class MyGroupPage extends StatefulWidget {
  const MyGroupPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<MyGroupPage> createState() => _MyGroupPageState();
}

class _MyGroupPageState extends State<MyGroupPage> {
  Map<String, dynamic>? membership;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final m = await widget.api.get('/memberships/me');
      setState(() => membership = m is Map<String, dynamic> ? m : null);
    } catch (e) {
      setState(() => error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null) {
      return Center(child: Text(error!, style: bodyStyle(color: Brand.danger)));
    }
    final group = membership?['group'] as Map<String, dynamic>?;
    final teacher = group?['teacher'] as Map<String, dynamic>?;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
      children: [
        Text('مجموعتي', style: displayStyle(size: 36)),
        const SizedBox(height: 6),
        Text('موعد المجلس ورابط واتساب الخارجي', style: bodyStyle(color: Brand.muted)),
        const SizedBox(height: 18),
        SoftPanel(
          child: group == null
              ? Text('لم تُقبل في مجموعة بعد. يمكنك طلب الانضمام عبر المشرف.', style: bodyStyle())
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(group['name']?.toString() ?? '', style: displayStyle(size: 30)),
                    const SizedBox(height: 10),
                    Text(
                      '${group['weeklySessionDay']} · ${group['weeklySessionTime']}',
                      style: bodyStyle(size: 15, weight: FontWeight.w600),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'المعلم: ${teacher?['firstName'] ?? ''} ${teacher?['lastName'] ?? ''}',
                      style: bodyStyle(color: Brand.muted),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'المقاعد: ${group['currentStudentCount']}/${group['seatCount']}',
                      style: bodyStyle(color: Brand.muted),
                    ),
                    if (group['whatsappUrl'] != null) ...[
                      const SizedBox(height: 16),
                      FilledButton.tonal(
                        style: FilledButton.styleFrom(
                          backgroundColor: Brand.goldSoft,
                          foregroundColor: Brand.inkSoft,
                        ),
                        onPressed: () async {
                          await launchUrl(
                            Uri.parse(group['whatsappUrl']),
                            mode: LaunchMode.externalApplication,
                          );
                        },
                        child: const Text('فتح واتساب المجموعة'),
                      ),
                    ],
                  ],
                ),
        ),
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
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
      children: [
        Text('التقرير اليومي', style: displayStyle(size: 36)),
        const SizedBox(height: 6),
        Text(
          'حقول منظمة — لا تعديل بعد الإرسال · لا موعد إغلاق حالياً',
          style: bodyStyle(color: Brand.muted),
        ),
        const SizedBox(height: 18),
        SoftPanel(
          child: Column(
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                activeColor: Brand.forestMid,
                title: Text('حفظت القسط اليومي', style: bodyStyle(weight: FontWeight.w600)),
                value: memorizedQuota,
                onChanged: (v) => setState(() => memorizedQuota = v),
              ),
              TextField(
                controller: reviewCtrl,
                decoration: const InputDecoration(labelText: 'ورد المراجعة'),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                activeColor: Brand.forestMid,
                title: Text('أكملت 50 تكراراً', style: bodyStyle(weight: FontWeight.w600)),
                value: fifty,
                onChanged: (v) => setState(() => fifty = v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                activeColor: Brand.forestMid,
                title: Text('التكرار في مجلس واحد', style: bodyStyle(weight: FontWeight.w600)),
                value: oneSitting,
                onChanged: (v) => setState(() => oneSitting = v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                activeColor: Brand.forestMid,
                title: Text('قرأت ورد التفسير', style: bodyStyle(weight: FontWeight.w600)),
                value: tafsir,
                onChanged: (v) => setState(() => tafsir = v),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: loading ? null : submit,
                  child: Text(loading ? 'جاري الإرسال…' : 'إرسال التقرير'),
                ),
              ),
              if (message != null) ...[
                const SizedBox(height: 12),
                Text(message!, style: bodyStyle(size: 13, color: Brand.inkSoft)),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class ProgressPage extends StatefulWidget {
  const ProgressPage({super.key, required this.api, required this.me});
  final ApiClient api;
  final Map<String, dynamic> me;

  @override
  State<ProgressPage> createState() => _ProgressPageState();
}

class _ProgressPageState extends State<ProgressPage> {
  List<dynamic> reports = [];
  List<dynamic> weekly = [];
  List<dynamic> infractions = [];
  Map<String, dynamic>? quota;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await widget.api.get('/daily-reports') as List<dynamic>;
      final w = await widget.api.get('/weekly-reports') as List<dynamic>;
      final i = await widget.api.get('/infractions') as List<dynamic>;
      final q = await widget.api.get('/quotas');
      setState(() {
        reports = r;
        weekly = w;
        infractions = i;
        quota = q is Map<String, dynamic> ? q : null;
      });
    } catch (e) {
      setState(() => error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null) {
      return Center(child: Text(error!, style: bodyStyle(color: Brand.danger)));
    }
    final quotaMet = reports.where((r) => r['memorizedQuota'] == true).length;
    final repsMet = reports.where((r) => r['completedFiftyRepetitions'] == true).length;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
      children: [
        Text('تقدّمي', style: displayStyle(size: 36)),
        const SizedBox(height: 6),
        Text(
          'المحفوظ الحالي: ${widget.me['currentMemorization'] ?? '—'}',
          style: bodyStyle(color: Brand.muted),
        ),
        const SizedBox(height: 18),
        SoftPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('التزام التقارير', style: bodyStyle(size: 17, weight: FontWeight.w700)),
              const SizedBox(height: 12),
              _StatLine(label: 'تقارير مُرسلة', value: '${reports.length}'),
              _StatLine(label: 'أيام حققت القسط', value: '$quotaMet'),
              _StatLine(label: 'أيام أكملت التكرار', value: '$repsMet'),
              _StatLine(
                label: 'القسط المحدد',
                value: quota?['dailyQuotaDescription']?.toString() ?? 'غير محدد',
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SoftPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('التقصير', style: bodyStyle(size: 17, weight: FontWeight.w700)),
              const SizedBox(height: 8),
              if (infractions.isEmpty)
                Text('لا سجل تقصير حالياً — أحسنت', style: bodyStyle(color: Brand.forestMid))
              else
                ...infractions.take(5).map(
                      (i) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Text(
                          '${i['occurredOn']} · ${i['type']}',
                          style: bodyStyle(size: 13, color: Brand.inkSoft),
                        ),
                      ),
                    ),
            ],
          ),
        ),
        if (weekly.isNotEmpty) ...[
          const SizedBox(height: 14),
          SoftPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('تقارير أسبوعية', style: bodyStyle(size: 17, weight: FontWeight.w700)),
                ...weekly.take(3).map((w) {
                  final confirmed = w['studentConfirmedAt'] != null;
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      '${w['weekStartDate']} → ${w['weekEndDate']}',
                      style: bodyStyle(weight: FontWeight.w600),
                    ),
                    subtitle: Text(
                      confirmed ? 'مؤكَّد' : 'بانتظار تأكيدك',
                      style: bodyStyle(size: 13, color: Brand.muted),
                    ),
                    trailing: confirmed
                        ? null
                        : TextButton(
                            onPressed: () async {
                              await widget.api.patch('/weekly-reports/${w['id']}/confirm', {});
                              await _load();
                            },
                            child: Text('تأكيد', style: bodyStyle(color: Brand.forestMid, weight: FontWeight.w700)),
                          ),
                  );
                }),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _StatLine extends StatelessWidget {
  const _StatLine({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(child: Text(label, style: bodyStyle(color: Brand.muted))),
          Text(value, style: bodyStyle(weight: FontWeight.w700, color: Brand.forest)),
        ],
      ),
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
    if (error != null) return Center(child: Text(error!, style: bodyStyle(color: Brand.danger)));
    if (data == null) {
      return const Center(child: CircularProgressIndicator(color: Brand.forestMid));
    }
    final groups = (data!['groups'] as List<dynamic>?) ?? [];
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('لوحة المعلم', style: displayStyle(size: 34)),
        Text('اليوم ${data!['today']}', style: bodyStyle(color: Brand.muted)),
        const SizedBox(height: 14),
        ...groups.map((g) {
          final group = g['group'] as Map<String, dynamic>;
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: SoftPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(group['name']?.toString() ?? '', style: displayStyle(size: 26)),
                  const SizedBox(height: 8),
                  Text(
                    'طلبة: ${g['studentCount']} · أرسلوا اليوم: ${g['submittedToday']} · بدون تقرير: ${g['missingToday']}',
                    style: bodyStyle(color: Brand.muted),
                  ),
                ],
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
    if (error != null) return Center(child: Text(error!, style: bodyStyle(color: Brand.danger)));
    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: groups.length,
      itemBuilder: (_, i) {
        final g = groups[i] as Map<String, dynamic>;
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: SoftPanel(
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(g['name']?.toString() ?? '', style: displayStyle(size: 24)),
              subtitle: Text(
                '${g['status']} · ${g['currentStudentCount']}/${g['seatCount']}',
                style: bodyStyle(color: Brand.muted),
              ),
              trailing: g['whatsappUrl'] != null
                  ? IconButton(
                      icon: const Icon(Icons.chat_outlined, color: Brand.forestMid),
                      onPressed: () async {
                        await launchUrl(
                          Uri.parse(g['whatsappUrl']),
                          mode: LaunchMode.externalApplication,
                        );
                      },
                    )
                  : null,
            ),
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
    if (error != null) return Center(child: Text(error!, style: bodyStyle(color: Brand.danger)));
    if (items.isEmpty) {
      return Center(
        child: Text('لا إشعارات (طبقة stub)', style: bodyStyle(color: Brand.muted)),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: items.length,
      itemBuilder: (_, i) {
        final n = items[i] as Map<String, dynamic>;
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: SoftPanel(
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(n['title']?.toString() ?? '', style: bodyStyle(weight: FontWeight.w700)),
              subtitle: Text(n['body']?.toString() ?? '', style: bodyStyle(color: Brand.muted)),
            ),
          ),
        );
      },
    );
  }
}
