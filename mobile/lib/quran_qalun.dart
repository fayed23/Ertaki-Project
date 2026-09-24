import 'dart:convert';

import 'package:flutter/services.dart';

class QalunSurah {
  const QalunSurah({
    required this.number,
    required this.nameAr,
    required this.ayahCount,
    required this.revelationOrder,
    required this.meccan,
  });
  final int number;
  final String nameAr;
  final int ayahCount;
  final int revelationOrder;
  final bool meccan;

  String get label => '$number. $nameAr';

  factory QalunSurah.fromJson(Map<String, dynamic> j) => QalunSurah(
        number: (j['number'] as num).toInt(),
        nameAr: '${j['nameAr']}',
        ayahCount: (j['ayahCount'] as num).toInt(),
        revelationOrder: (j['revelationOrder'] as num).toInt(),
        meccan: j['meccan'] == true,
      );
}

class QalunCatalog {
  QalunCatalog._(this.surahs, this.riwayahAr, this.totalAyahs, this.sourceNote);
  final List<QalunSurah> surahs;
  final String riwayahAr;
  final int totalAyahs;
  final String sourceNote;

  static QalunCatalog? _instance;

  static Future<QalunCatalog> load() async {
    if (_instance != null) return _instance!;
    final raw = await rootBundle.loadString('assets/quran/qalun_surahs.json');
    final j = jsonDecode(raw) as Map<String, dynamic>;
    final list = (j['surahs'] as List)
        .map((e) => QalunSurah.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
    final source = j['source'] is Map ? Map<String, dynamic>.from(j['source'] as Map) : {};
    _instance = QalunCatalog._(
      list,
      '${j['riwayahAr'] ?? 'قالون عن نافع'}',
      (j['totalAyahs'] as num?)?.toInt() ?? 6214,
      '${source['primary'] ?? 'quran-meta QalunLists'}',
    );
    return _instance!;
  }

  QalunSurah? byNumber(int n) {
    for (final s in surahs) {
      if (s.number == n) return s;
    }
    return null;
  }
}
