import 'package:flutter/material.dart';

import '../theme/tokens.dart';
import 'dashed_rect.dart';

enum LegendVariant { hint, row, bonus }

/// A mini tile swatch matching the real board colours 1:1, so the key in
/// the how-to sheet and the legend strip reads the same as the grid.
/// Port of app/components/Legend.tsx.
class Legend extends StatelessWidget {
  const Legend({super.key, required this.variant, this.label});

  final LegendVariant variant;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final (bg, fg, letter) = switch (variant) {
      LegendVariant.hint => (c.cream, c.ink, 'A'),
      LegendVariant.row => (c.rowValid, c.onRowValid, 'B'),
      LegendVariant.bonus => (c.solved, c.onSolved, 'C'),
    };

    final swatch = SizedBox(
      width: 20,
      height: 20,
      child: Stack(
        children: [
          Container(
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(4),
              border: variant == LegendVariant.hint
                  ? null
                  : Border.all(color: c.rule),
            ),
            alignment: Alignment.center,
            child: Text(
              letter,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: fg,
                height: 1,
              ),
            ),
          ),
          if (variant == LegendVariant.hint)
            Positioned.fill(
              child: CustomPaint(
                painter: DashedRectPainter(
                  color: c.hint,
                  strokeWidth: 1.5,
                  radius: 4,
                  inset: 1.5,
                  dash: 3,
                  gap: 2,
                ),
              ),
            ),
        ],
      ),
    );

    if (label == null) return swatch;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        swatch,
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            label!,
            style: TextStyle(fontSize: 12, color: c.muted),
          ),
        ),
      ],
    );
  }
}
