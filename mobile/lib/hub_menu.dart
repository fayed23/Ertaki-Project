import 'package:flutter/material.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/widgets.dart';

class HubCategory {
  const HubCategory({
    required this.icon,
    required this.label,
    required this.onTap,
    this.subtitle,
    this.badgeCount,
  });
  final IconData icon;
  final String label;
  final String? subtitle;
  /// Unread/new count. Badge is hidden when null or ≤ 0.
  final int? badgeCount;
  final VoidCallback onTap;
}

class RoleHubHome extends StatelessWidget {
  const RoleHubHome({
    super.key,
    required this.title,
    required this.subtitle,
    required this.categories,
    this.header,
  });
  final String title;
  final String subtitle;
  final List<HubCategory> categories;
  final Widget? header;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Text(title, style: ui(size: 22, weight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(subtitle, style: ui(size: 13, color: Brand.muted)),
        if (header != null) ...[
          const SizedBox(height: 12),
          header!,
        ],
        const SizedBox(height: 16),
        Text('الأقسام', style: ui(size: 15, weight: FontWeight.w700, color: Brand.muted)),
        const SizedBox(height: 10),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth > 520;
            final cross = wide ? 3 : 2;
            return GridView.count(
              crossAxisCount: cross,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: wide ? 1.35 : 1.15,
              children: categories.map((c) => _HubTile(category: c)).toList(),
            );
          },
        ),
      ],
    );
  }
}

class _HubTile extends StatelessWidget {
  const _HubTile({required this.category});
  final HubCategory category;

  @override
  Widget build(BuildContext context) {
    final count = category.badgeCount ?? 0;
    final showBadge = count > 0;
    return SoftPanel(
      onTap: category.onTap,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: Brand.leaf.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(category.icon, color: Brand.forestMid),
                  ),
                  if (showBadge)
                    Positioned(
                      top: -6,
                      left: -6,
                      child: Container(
                        constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                        decoration: BoxDecoration(
                          color: Brand.gold,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Brand.paper, width: 1.5),
                        ),
                        child: Text(
                          count > 99 ? '99+' : '$count',
                          textAlign: TextAlign.center,
                          style: ui(size: 10, weight: FontWeight.w800, color: Brand.ink),
                        ),
                      ),
                    ),
                ],
              ),
              const Spacer(),
            ],
          ),
          const Spacer(),
          Text(category.label, style: ui(size: 15, weight: FontWeight.w700)),
          if (category.subtitle != null) ...[
            const SizedBox(height: 2),
            Text(category.subtitle!, style: ui(size: 11, color: Brand.muted), maxLines: 2),
          ],
        ],
      ),
    );
  }
}
