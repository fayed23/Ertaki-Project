import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/gate.dart';

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
      theme: buildErtakiTheme(),
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: const GatePage(),
    );
  }
}
