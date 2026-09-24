import 'package:flutter/material.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/widgets.dart';

String formatTimeOfDay(TimeOfDay t) =>
    '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

TimeOfDay timeFromMinutes(int minutes) {
  final m = minutes.clamp(0, 23 * 60 + 59);
  return TimeOfDay(hour: m ~/ 60, minute: m % 60);
}

int minutesFromTime(TimeOfDay t) => t.hour * 60 + t.minute;

/// Clock-style from–to time range (same UX as create-group `showTimePicker`).
class ClockTimeRangeField extends StatelessWidget {
  const ClockTimeRangeField({
    super.key,
    required this.title,
    required this.start,
    required this.end,
    required this.onChanged,
    this.startLabel = 'من',
    this.endLabel = 'إلى',
  });

  final String title;
  final TimeOfDay start;
  final TimeOfDay end;
  final void Function(TimeOfDay start, TimeOfDay end) onChanged;
  final String startLabel;
  final String endLabel;

  Future<void> _pick(BuildContext context, bool isStart) async {
    final initial = isStart ? start : end;
    final v = await showTimePicker(
      context: context,
      initialTime: initial,
      helpText: isStart ? '$title — $startLabel' : '$title — $endLabel',
      builder: (ctx, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: MediaQuery(
          data: MediaQuery.of(ctx).copyWith(alwaysUse24HourFormat: true),
          child: child ?? const SizedBox.shrink(),
        ),
      ),
    );
    if (v == null) return;
    if (isStart) {
      var nextEnd = end;
      if (minutesFromTime(nextEnd) < minutesFromTime(v)) {
        nextEnd = v;
      }
      onChanged(v, nextEnd);
    } else {
      var nextStart = start;
      if (minutesFromTime(v) < minutesFromTime(nextStart)) {
        nextStart = v;
      }
      onChanged(nextStart, v);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SoftPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: ui(size: 16, weight: FontWeight.w700)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _pick(context, true),
                  child: Text('$startLabel ${formatTimeOfDay(start)}'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _pick(context, false),
                  child: Text('$endLabel ${formatTimeOfDay(end)}'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'اختيار بساعة النظام (مثل إنشاء المجموعة)',
            style: ui(size: 12, color: Brand.muted),
          ),
        ],
      ),
    );
  }
}

class ClockTimeField extends StatelessWidget {
  const ClockTimeField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
  });
  final String label;
  final TimeOfDay value;
  final ValueChanged<TimeOfDay> onChanged;

  Future<void> _pick(BuildContext context) async {
    final v = await showTimePicker(
      context: context,
      initialTime: value,
      helpText: label,
      builder: (ctx, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: MediaQuery(
          data: MediaQuery.of(ctx).copyWith(alwaysUse24HourFormat: true),
          child: child ?? const SizedBox.shrink(),
        ),
      ),
    );
    if (v != null) onChanged(v);
  }

  @override
  Widget build(BuildContext context) {
    return SoftPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(label, style: ui(size: 15, weight: FontWeight.w700)),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => _pick(context),
            child: Text(formatTimeOfDay(value)),
          ),
        ],
      ),
    );
  }
}
