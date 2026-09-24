import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

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
  static const warnBg = Color(0xFFF7EFE0);
}

TextStyle brandStyle({double size = 48, Color color = Brand.forest}) {
  return GoogleFonts.amiri(
    fontSize: size,
    fontWeight: FontWeight.w700,
    color: color,
    height: 1.1,
  );
}

TextStyle ui({
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

ThemeData buildErtakiTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    canvasColor: Brand.mist,
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
  return base.copyWith(
    appBarTheme: AppBarTheme(
      backgroundColor: Brand.paper.withValues(alpha: 0.92),
      elevation: 0,
      centerTitle: true,
      foregroundColor: Brand.ink,
      titleTextStyle: brandStyle(size: 28),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Brand.forestMid,
        foregroundColor: Brand.paper,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: ui(size: 16, weight: FontWeight.w700, color: Brand.paper),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Brand.paper,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
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
        borderSide: const BorderSide(color: Brand.leaf, width: 1.6),
      ),
      labelStyle: ui(color: Brand.muted),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Brand.paper,
      indicatorColor: Brand.leaf.withValues(alpha: 0.18),
      height: 68,
      labelTextStyle: WidgetStatePropertyAll(ui(size: 12, weight: FontWeight.w600)),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: Brand.forest,
      contentTextStyle: ui(color: Brand.paper, weight: FontWeight.w600),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
}
