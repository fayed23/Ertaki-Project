import 'package:flutter/material.dart';
import 'package:ertaki_mobile/brand.dart';
import 'package:ertaki_mobile/widgets.dart';

/// Shared observer for hub nested navigators — homes refresh badges on didPopNext.
final RouteObserver<ModalRoute<void>> hubRouteObserver =
    RouteObserver<ModalRoute<void>>();

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

class RoleHubHome extends StatefulWidget {
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
  State<RoleHubHome> createState() => _RoleHubHomeState();
}

class _RoleHubHomeState extends State<RoleHubHome> {
  final _scroll = ScrollController();
  double _logoReveal = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final next = ((_scroll.offset - 8) / 48).clamp(0.0, 1.0);
    if ((next - _logoReveal).abs() > 0.02) {
      setState(() => _logoReveal = next);
    }
  }

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      controller: _scroll,
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          sliver: SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(widget.title, style: ui(size: 22, weight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(widget.subtitle, style: ui(size: 13, color: Brand.muted)),
                if (widget.header != null) ...[
                  const SizedBox(height: 12),
                  widget.header!,
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
                      children: widget.categories.map((c) => _HubTile(category: c)).toList(),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
        const SliverFillRemaining(
          hasScrollBody: false,
          child: SizedBox.shrink(),
        ),
        SliverToBoxAdapter(
          child: IgnorePointer(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
              child: Opacity(
                opacity: _logoReveal,
                child: Center(
                  child: Image.asset(
                    'assets/branding/GroupLogo.png',
                    height: 72,
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            ),
          ),
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
