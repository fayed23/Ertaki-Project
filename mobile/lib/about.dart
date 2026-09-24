import 'package:flutter/material.dart';
import 'package:ertaki_mobile/brand.dart';

Future<void> showAboutErtaki(BuildContext context) {
  return showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: Brand.paper,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      contentPadding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.asset(
            'assets/branding/GroupLogo.png',
            height: 120,
            fit: BoxFit.contain,
          ),
          const SizedBox(height: 16),
          Text(
            'ارتق',
            style: brandStyle(size: 28),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'نص التعريف سيُضاف لاحقاً',
            style: ui(size: 14, color: Brand.muted),
            textAlign: TextAlign.center,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: Text('إغلاق', style: ui(weight: FontWeight.w700, color: Brand.forestMid)),
        ),
      ],
    ),
  );
}
