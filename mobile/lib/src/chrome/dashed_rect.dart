import 'package:flutter/widgets.dart';

/// Paints a dashed rounded-rectangle stroke inset by [inset] from the
/// widget's edge. Used for the home-position tile hint (board + legend),
/// mirroring the web's `outline-dashed ... -outline-offset-[3px]`.
class DashedRectPainter extends CustomPainter {
  const DashedRectPainter({
    required this.color,
    this.strokeWidth = 2,
    this.radius = 10,
    this.inset = 3,
    this.dash = 4,
    this.gap = 3,
  });

  final Color color;
  final double strokeWidth;
  final double radius;
  final double inset;
  final double dash;
  final double gap;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(
      inset,
      inset,
      size.width - inset * 2,
      size.height - inset * 2,
    );
    final rrect = RRect.fromRectAndRadius(
      rect,
      Radius.circular((radius - inset).clamp(0, radius)),
    );
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;

    final path = Path()..addRRect(rrect);
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(
          metric.extractPath(distance, distance + dash),
          paint,
        );
        distance += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(DashedRectPainter old) =>
      old.color != color ||
      old.strokeWidth != strokeWidth ||
      old.radius != radius ||
      old.inset != inset ||
      old.dash != dash ||
      old.gap != gap;
}
