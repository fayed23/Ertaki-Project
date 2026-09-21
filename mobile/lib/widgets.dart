import 'package:flutter/material.dart';
import 'package:ertaki_mobile/brand.dart';

class Atmosphere extends StatelessWidget {
  const Atmosphere({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
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
            top: -50,
            left: -30,
            child: _blob(Brand.leaf.withValues(alpha: 0.16), 160),
          ),
          Positioned(
            bottom: -40,
            right: -20,
            child: _blob(Brand.gold.withValues(alpha: 0.14), 140),
          ),
          child,
        ],
      ),
    );
  }

  Widget _blob(Color c, double s) => IgnorePointer(
        child: Container(
          width: s,
          height: s,
          decoration: BoxDecoration(shape: BoxShape.circle, color: c),
        ),
      );
}

class SoftPanel extends StatelessWidget {
  const SoftPanel({super.key, required this.child, this.padding, this.margin});
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: margin,
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Brand.paper.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Brand.line),
        boxShadow: [
          BoxShadow(
            color: Brand.ink.withValues(alpha: 0.05),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: child,
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    this.tone = ChipTone.neutral,
  });
  final String label;
  final ChipTone tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      ChipTone.ok => (Brand.leaf.withValues(alpha: 0.15), Brand.forestMid),
      ChipTone.warn => (Brand.warnBg, Brand.gold),
      ChipTone.danger => (Brand.danger.withValues(alpha: 0.12), Brand.danger),
      ChipTone.neutral => (Brand.mistDeep, Brand.inkSoft),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(label, style: ui(size: 12, weight: FontWeight.w700, color: fg)),
    );
  }
}

enum ChipTone { ok, warn, danger, neutral }

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return SoftPanel(
      child: Column(
        children: [
          Icon(icon, size: 40, color: Brand.leaf),
          const SizedBox(height: 10),
          Text(title, style: ui(size: 16, weight: FontWeight.w700), textAlign: TextAlign.center),
          if (subtitle != null) ...[
            const SizedBox(height: 6),
            Text(subtitle!, style: ui(size: 13, color: Brand.muted), textAlign: TextAlign.center),
          ],
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 14),
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}

class SeatBar extends StatelessWidget {
  const SeatBar({super.key, required this.current, required this.total});
  final int current;
  final int total;

  @override
  Widget build(BuildContext context) {
    final ratio = total == 0 ? 0.0 : (current / total).clamp(0.0, 1.0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: ratio,
            minHeight: 8,
            backgroundColor: Brand.mistDeep,
            color: Brand.forestMid,
          ),
        ),
        const SizedBox(height: 4),
        Text('$current / $total مقعد', style: ui(size: 12, color: Brand.muted)),
      ],
    );
  }
}

void showToast(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(message),
      backgroundColor: error ? Brand.danger : Brand.forest,
    ),
  );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, top: 4),
      child: Row(
        children: [
          Expanded(child: Text(text, style: ui(size: 17, weight: FontWeight.w700))),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}
