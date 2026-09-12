import 'package:flutter/widgets.dart';

/// `Share.share`'s `sharePositionOrigin` — required on iOS (it anchors the
/// share sheet popover); omitting it throws a `PlatformException`
/// ("sharePositionOrigin: argument must be set"). Any on-screen rect works;
/// the calling widget's own bounds are close enough.
Rect? sharePositionOrigin(BuildContext context) {
  final box = context.findRenderObject() as RenderBox?;
  if (box == null || !box.hasSize) return null;
  return box.localToGlobal(Offset.zero) & box.size;
}
