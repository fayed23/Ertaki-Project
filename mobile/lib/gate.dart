import 'package:flutter/material.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/shell.dart';
import 'package:ertaki_mobile/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

class GatePage extends StatefulWidget {
  const GatePage({super.key});

  @override
  State<GatePage> createState() => _GatePageState();
}

class _GatePageState extends State<GatePage> {
  late final TextEditingController phoneCtrl;
  final passCtrl = TextEditingController(text: 'password123');
  bool loading = false;

  @override
  void initState() {
    super.initState();
    final q = Uri.base.queryParameters['phone'];
    phoneCtrl = TextEditingController(
      text: (q != null && q.isNotEmpty) ? q : '0500000003',
    );
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
    super.dispose();
  }

  Future<void> login() async {
    setState(() => loading = true);
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
              child: ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const SizedBox(height: 28),
                  Text('ارتق', style: brandStyle(size: 64), textAlign: TextAlign.center),
                  const SizedBox(height: 8),
                  Text(
                    'متابعة حفظ القرآن الكريم',
                    style: ui(size: 16, color: Brand.muted),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 28),
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
                        const SizedBox(height: 18),
                        FilledButton(
                          onPressed: loading ? null : login,
                          child: Text(loading ? 'جاري الدخول…' : 'دخول'),
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
          ),
        ),
      ),
    );
  }
}
