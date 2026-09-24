import 'package:flutter/material.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/shell.dart';
import 'package:ertaki_mobile/signup.dart';
import 'package:ertaki_mobile/widgets.dart';
import 'package:ertaki_mobile/notify.dart';
import 'package:shared_preferences/shared_preferences.dart';

class GatePage extends StatefulWidget {
  const GatePage({super.key});

  @override
  State<GatePage> createState() => _GatePageState();
}

class _GatePageState extends State<GatePage> {
  late final TextEditingController phoneCtrl;
  final passCtrl = TextEditingController(text: 'password123');
  late final TextEditingController apiCtrl;
  bool loading = false;
  bool showApi = true;

  @override
  void initState() {
    super.initState();
    final q = Uri.base.queryParameters['phone'];
    phoneCtrl = TextEditingController(
      text: (q != null && q.isNotEmpty) ? q : '0500000003',
    );
    apiCtrl = TextEditingController(text: AppConfig.apiBase);
    if (Uri.base.queryParameters['auto'] == '1') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) login();
      });
    }
  }

  @override
  void dispose() {
    phoneCtrl.dispose();
    passCtrl.dispose();
    apiCtrl.dispose();
    super.dispose();
  }

  Future<void> login() async {
    setState(() => loading = true);
    try {
      await AppConfig.setApiBase(apiCtrl.text);
      final api = ApiClient(null);
      final res = await api.post('/auth/login', {
        'phone': phoneCtrl.text.trim(),
        'password': passCtrl.text,
      });
      final token = res['accessToken'] as String;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', token);
      final authed = ApiClient(token);
      await NotifyHub.instance.registerDevice(authed);
      await NotifyHub.instance.pollAndAlert(authed);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => HomeShell(token: token)),
      );
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Atmosphere(
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                children: [
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.all(24),
                      children: [
                        const SizedBox(height: 20),
                        Center(
                          child: Image.asset(
                            'assets/branding/app_logo.png',
                            height: 96,
                            fit: BoxFit.contain,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text('ارتق', style: brandStyle(size: 56), textAlign: TextAlign.center),
                        const SizedBox(height: 8),
                        Text(
                          'متابعة حفظ القرآن الكريم',
                          style: ui(size: 16, color: Brand.muted),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 24),
                        SoftPanel(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text('تسجيل الدخول', style: ui(size: 20, weight: FontWeight.w700)),
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
                              const SizedBox(height: 8),
                              TextButton(
                                onPressed: () => setState(() => showApi = !showApi),
                                child: Text(
                                  showApi ? 'إخفاء عنوان الخادم' : 'إعداد عنوان الخادم (API)',
                                  style: ui(size: 13, color: Brand.forestMid, weight: FontWeight.w600),
                                ),
                              ),
                              if (showApi) ...[
                                TextField(
                                  controller: apiCtrl,
                                  keyboardType: TextInputType.url,
                                  textDirection: TextDirection.ltr,
                                  decoration: const InputDecoration(
                                    labelText: 'API base URL',
                                    hintText: 'http://192.168.1.10:43124/api',
                                    helperText: 'Phone must reach this host (LAN / ngrok / deployed)',
                                  ),
                                ),
                                const SizedBox(height: 8),
                              ],
                              const SizedBox(height: 10),
                              FilledButton(
                                onPressed: loading ? null : login,
                                child: Text(loading ? 'جاري الدخول…' : 'دخول'),
                              ),
                              const SizedBox(height: 10),
                              OutlinedButton(
                                onPressed: loading
                                    ? null
                                    : () {
                                        Navigator.of(context).push(
                                          MaterialPageRoute(builder: (_) => const SignupPage()),
                                        );
                                      },
                                child: const Text('إنشاء حساب طالب / معلم'),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                'الطالب يُفعَّل فوراً ويختار مجموعة · المعلم ينتظر موافقة المشرف',
                                style: ui(size: 11, color: Brand.muted),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 12),
                              Text(
                                'طالب 0500000003 · معلم 0500000002 · مشرف 0500000001',
                                style: ui(size: 11, color: Brand.muted),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'المشرف يدخل من التطبيق أو لوحة الويب بنفس الحساب',
                                style: ui(size: 11, color: Brand.muted),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 8, 24, 20),
                    child: Center(
                      child: Image.asset(
                        'assets/branding/GroupLogo.png',
                        height: 72,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
