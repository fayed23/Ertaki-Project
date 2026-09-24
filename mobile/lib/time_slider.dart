import 'package:flutter/material.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/widgets.dart';

const int kDayMinutes = 24 * 60;
const int kTimeStepMinutes = 5;

int clampTimeMinutes(int m) {
  if (m < 0) return 0;
  if (m > kDayMinutes - kTimeStepMinutes) {
    return kDayMinutes - kTimeStepMinutes;
  }
  return (m / kTimeStepMinutes).round() * kTimeStepMinutes;
}

int parseHhMm(String? raw, {int fallback = 0}) {
  if (raw == null || raw.trim().isEmpty) return clampTimeMinutes(fallback);
  final parts = raw.trim().split(':');
  if (parts.length < 2) return clampTimeMinutes(fallback);
  final h = int.tryParse(parts[0]) ?? 0;
  final m = int.tryParse(parts[1]) ?? 0;
  return clampTimeMinutes(h * 60 + m);
}

String formatHhMm(int minutes) {
  final m = clampTimeMinutes(minutes);
  final h = m ~/ 60;
  final min = m % 60;
  return '${h.toString().padLeft(2, '0')}:${min.toString().padLeft(2, '0')}';
}

/// Single HH:mm slider (5-minute steps).
class TimeSlider extends StatelessWidget {
  const TimeSlider({
    super.key,
    required this.label,
    required this.minutes,
    required this.onChanged,
    this.minMinutes = 0,
    this.maxMinutes = kDayMinutes - kTimeStepMinutes,
  });

  final String label;
  final int minutes;
  final ValueChanged<int> onChanged;
  final int minMinutes;
  final int maxMinutes;

  @override
  Widget build(BuildContext context) {
    final minV = clampTimeMinutes(minMinutes).toDouble();
    final maxV = clampTimeMinutes(maxMinutes).toDouble();
    final value = clampTimeMinutes(minutes).clamp(minV.toInt(), maxV.toInt()).toDouble();
    final divisions = ((maxV - minV) / kTimeStepMinutes).round().clamp(1, 10000);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Text(label, style: ui(weight: FontWeight.w600))),
            Text(
              formatHhMm(value.toInt()),
              style: ui(size: 18, weight: FontWeight.w800, color: Brand.forest),
              textDirection: TextDirection.ltr,
            ),
          ],
        ),
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            activeTrackColor: Brand.forestMid,
            inactiveTrackColor: Brand.mistDeep,
            thumbColor: Brand.forest,
            overlayColor: Brand.forest.withValues(alpha: 0.12),
            valueIndicatorColor: Brand.forest,
          ),
          child: Slider(
            value: value,
            min: minV,
            max: maxV,
            divisions: divisions,
            label: formatHhMm(value.toInt()),
            onChanged: (v) => onChanged(clampTimeMinutes(v.round())),
          ),
        ),
      ],
    );
  }
}

/// Dual start/end HH:mm range slider. Guarantees end ≥ start.
class TimeRangeSlider extends StatelessWidget {
  const TimeRangeSlider({
    super.key,
    required this.title,
    required this.startMinutes,
    required this.endMinutes,
    required this.onChanged,
    this.startLabel = 'من',
    this.endLabel = 'إلى',
  });

  final String title;
  final String startLabel;
  final String endLabel;
  final int startMinutes;
  final int endMinutes;
  final void Function(int start, int end) onChanged;

  @override
  Widget build(BuildContext context) {
    var start = clampTimeMinutes(startMinutes);
    var end = clampTimeMinutes(endMinutes);
    if (end < start) end = start;
    final divisions = ((kDayMinutes - kTimeStepMinutes) / kTimeStepMinutes).round();

    return SoftPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: ui(size: 15, weight: FontWeight.w700)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(startLabel, style: ui(size: 12, color: Brand.muted)),
                    Text(
                      formatHhMm(start),
                      style: ui(size: 20, weight: FontWeight.w800, color: Brand.forest),
                      textDirection: TextDirection.ltr,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_back, color: Brand.muted, size: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(endLabel, style: ui(size: 12, color: Brand.muted)),
                    Text(
                      formatHhMm(end),
                      style: ui(size: 20, weight: FontWeight.w800, color: Brand.forest),
                      textDirection: TextDirection.ltr,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: Brand.forestMid,
              inactiveTrackColor: Brand.mistDeep,
              rangeThumbShape: const RoundRangeSliderThumbShape(enabledThumbRadius: 10),
              overlayColor: Brand.forest.withValues(alpha: 0.12),
              valueIndicatorColor: Brand.forest,
              showValueIndicator: ShowValueIndicator.always,
            ),
            child: RangeSlider(
              values: RangeValues(start.toDouble(), end.toDouble()),
              min: 0,
              max: (kDayMinutes - kTimeStepMinutes).toDouble(),
              divisions: divisions,
              labels: RangeLabels(formatHhMm(start), formatHhMm(end)),
              onChanged: (v) {
                var s = clampTimeMinutes(v.start.round());
                var e = clampTimeMinutes(v.end.round());
                if (e < s) e = s;
                onChanged(s, e);
              },
            ),
          ),
          Text(
            'اسحب المؤشرين — خطوة ${kTimeStepMinutes} دقائق · النهاية ≥ البداية',
            style: ui(size: 11, color: Brand.muted),
          ),
        ],
      ),
    );
  }
}
