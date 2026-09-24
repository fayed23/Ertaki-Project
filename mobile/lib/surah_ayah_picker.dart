import 'package:flutter/material.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/quran_qalun.dart';
import 'package:ertaki_mobile/widgets.dart';

class SurahAyahRangePicker extends StatelessWidget {
  const SurahAyahRangePicker({
    super.key,
    required this.catalog,
    required this.surah,
    required this.ayahFrom,
    required this.ayahTo,
    required this.onChanged,
  });

  final QalunCatalog catalog;
  final QalunSurah? surah;
  final int ayahFrom;
  final int ayahTo;
  final void Function(QalunSurah surah, int from, int to) onChanged;

  @override
  Widget build(BuildContext context) {
    final maxAyah = surah?.ayahCount ?? 1;
    final from = ayahFrom.clamp(1, maxAyah);
    final to = ayahTo.clamp(from, maxAyah);
    return SoftPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('موضع الحفظ (قالون عن نافع)', style: ui(size: 16, weight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(
            'عدد الآيات حسب رواية قالون · المجموع ${catalog.totalAyahs}',
            style: ui(size: 12, color: Brand.muted),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<int>(
            value: surah?.number,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'السورة'),
            items: catalog.surahs
                .map(
                  (s) => DropdownMenuItem(
                    value: s.number,
                    child: Text('${s.number}. ${s.nameAr} (${s.ayahCount})'),
                  ),
                )
                .toList(),
            onChanged: (n) {
              if (n == null) return;
              final s = catalog.byNumber(n)!;
              onChanged(s, 1, s.ayahCount.clamp(1, s.ayahCount));
            },
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<int>(
                  value: surah == null ? null : from,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'من آية'),
                  items: [
                    for (var i = 1; i <= maxAyah; i++)
                      DropdownMenuItem(value: i, child: Text('$i')),
                  ],
                  onChanged: surah == null
                      ? null
                      : (v) {
                          if (v == null || surah == null) return;
                          final nextTo = to < v ? v : to;
                          onChanged(surah!, v, nextTo);
                        },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonFormField<int>(
                  value: surah == null ? null : to,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'إلى آية'),
                  items: [
                    for (var i = from; i <= maxAyah; i++)
                      DropdownMenuItem(value: i, child: Text('$i')),
                  ],
                  onChanged: surah == null
                      ? null
                      : (v) {
                          if (v == null || surah == null) return;
                          onChanged(surah!, from, v);
                        },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
