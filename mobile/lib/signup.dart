import 'package:flutter/material.dart';
import 'package:ertaki_mobile/api.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/shell.dart';
import 'package:ertaki_mobile/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SignupPage extends StatefulWidget {
  const SignupPage({super.key});

  @override
  State<SignupPage> createState() => _SignupPageState();
}

class _SignupPageState extends State<SignupPage> {
  final firstCtrl = TextEditingController();
  final lastCtrl = TextEditingController();
  final phoneCtrl = TextEditingController();
  final passCtrl = TextEditingController();
  final cityCtrl = TextEditingController();
  String role = 'student';
  bool loading = false;
  String? successMessage;

  @override
  void dispose() {
    firstCtrl.dispose();
    lastCtrl.dispose();
    phoneCtrl.dispose();
    passCtrl.dispose();
    cityCtrl.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    setState(() {
      loading = true;
      successMessage = null;
    });
    try {
      final api = ApiClient(null);
      final res = await api.post('/auth/register', {
        'firstName': firstCtrl.text.trim(),
        'lastName': lastCtrl.text.trim(),
        'phone': phoneCtrl.text.trim(),
        'password': passCtrl.text,
        'role': role,
        if (cityCtrl.text.trim().isNotEmpty) 'city': cityCtrl.text.trim(),
      });
      final token = res['accessToken'] as String?;
      if (token != null && role == 'student') {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('token', token);
        if (!mounted) return;
        showToast(context, res['message'] as String? ?? 'تم إنشاء الحساب');
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => HomeShell(token: token)),
          (_) => false,
        );
        return;
      }
      final msg = res['message'] as String? ??
          'تم إنشاء الحساب وبانتظار موافقة المشرف';
      setState(() => successMessage = msg);
      if (mounted) {
        showToast(context, msg);
      }
    } catch (e) {
      if (mounted) showToast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('إنشاء حساب', style: ui(size: 18, weight: FontWeight.w700)),
      ),
      body: Atmosphere(
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  Text('ارتق', style: brandStyle(size: 48), textAlign: TextAlign.center),
                  const SizedBox(height: 6),
                  Text(
                    role == 'teacher'
                        ? 'تسجيل معلم — التفعيل بعد موافقة المشرف'
                        : 'تسجيل طالب — الحساب يُفعَّل فوراً ثم تختار مجموعة',
                    style: ui(size: 14, color: Brand.muted),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),
                  if (successMessage != null)
                    SoftPanel(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const StatusChip(label: 'بانتظار الموافقة', tone: ChipTone.warn),
                          const SizedBox(height: 10),
                          Text(successMessage!, style: ui(size: 15, weight: FontWeight.w600)),
                          const SizedBox(height: 8),
                          Text(
                            'حساب المعلم لا يمكنه الدخول حتى يوافق المشرف.',
                            style: ui(size: 13, color: Brand.muted),
                          ),
                          const SizedBox(height: 14),
                          OutlinedButton(
                            onPressed: () => Navigator.of(context).pop(),
                            child: const Text('العودة لتسجيل الدخول'),
                          ),
                        ],
                      ),
                    )
                  else
                    SoftPanel(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text('بيانات الحساب', style: ui(size: 18, weight: FontWeight.w700)),
                          const SizedBox(height: 14),
                          Text('الدور', style: ui(size: 13, color: Brand.muted)),
                          const SizedBox(height: 6),
                          SegmentedButton<String>(
                            segments: const [
                              ButtonSegment(value: 'student', label: Text('طالب'), icon: Icon(Icons.school_outlined)),
                              ButtonSegment(value: 'teacher', label: Text('معلم'), icon: Icon(Icons.menu_book_outlined)),
                            ],
                            selected: {role},
                            onSelectionChanged: (s) => setState(() => role = s.first),
                          ),
                          const SizedBox(height: 14),
                          TextField(
                            controller: firstCtrl,
                            decoration: const InputDecoration(labelText: 'الاسم'),
                          ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: lastCtrl,
                            decoration: const InputDecoration(labelText: 'اللقب'),
                          ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: phoneCtrl,
                            keyboardType: TextInputType.phone,
                            textDirection: TextDirection.ltr,
                            decoration: const InputDecoration(labelText: 'رقم الهاتف'),
                          ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: passCtrl,
                            obscureText: true,
                            decoration: const InputDecoration(
                              labelText: 'كلمة المرور',
                              helperText: '6 أحرف على الأقل',
                            ),
                          ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: cityCtrl,
                            decoration: const InputDecoration(labelText: 'المدينة (اختياري)'),
                          ),
                          const SizedBox(height: 16),
                          FilledButton(
                            onPressed: loading ? null : submit,
                            child: Text(loading ? 'جاري التسجيل…' : 'إنشاء الحساب'),
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
