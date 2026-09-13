// A catapult-style pull-to-refresh: pulling down sags the top edge into a
// curved "pocket" (a c.cream membrane against c.paper, traced with a
// c.rule hairline), with a blank ink tile riding at the bottom of the
// sag. Release past the trigger and the curve snaps flat while the tile
// flies up and settles into a docked, gently-bobbing position until the
// refresh finishes; release short of it and the whole thing eases back
// into the surface instead.
//
// Built from scratch rather than Material's RefreshIndicator, which has
// no shape/animation hook — only color and stroke width. Tracks the same
// two notification shapes RefreshIndicator itself has to handle
// internally: ClampingScrollPhysics (Android) reports a pull past the
// top as OverscrollNotification, but BouncingScrollPhysics (iOS's
// default, what this app actually runs under) never "overscrolls" at
// all — it just lets ScrollMetrics.pixels go negative via an ordinary
// ScrollUpdateNotification. Both are handled; see the iOS-physics test
// group in organic_refresh_test.dart for why that distinction matters.

import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';

import '../theme/tokens.dart';

class OrganicRefresh extends StatefulWidget {
  const OrganicRefresh({
    super.key,
    required this.onRefresh,
    required this.child,
  });

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  State<OrganicRefresh> createState() => _OrganicRefreshState();
}

enum _Phase { idle, dragging, launching, refreshing, snapping }

class _OrganicRefreshState extends State<OrganicRefresh>
    with SingleTickerProviderStateMixin {
  static const _maxPull = 90.0;
  static const _triggerPull = 62.0;
  static const _dockedY = 30.0;
  static const _tileSize = 22.0;

  // Eagerly built in initState, not a lazy `late final` field initializer:
  // an idle build never touches _controller at all, so a lazy initializer
  // would fire on its first-ever access — inside dispose() — by which
  // point the element is deactivating and AnimationController's vsync
  // lookup throws.
  late final AnimationController _controller;

  _Phase _phase = _Phase.idle;
  double _pull = 0; // 0.._maxPull, follows the finger 1:1 while dragging
  double _snapFrom = 0;
  bool _refreshResolvedEarly = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this)
      ..addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool _onNotification(ScrollNotification n) {
    if (n is OverscrollNotification && n.dragDetails != null) {
      if (_phase == _Phase.idle || _phase == _Phase.dragging) {
        setState(() {
          _phase = _Phase.dragging;
          _pull = (_pull - n.overscroll).clamp(0.0, _maxPull);
        });
      }
    } else if (n is ScrollUpdateNotification &&
        n.dragDetails != null &&
        n.metrics.pixels < 0) {
      if (_phase == _Phase.idle || _phase == _Phase.dragging) {
        setState(() {
          _phase = _Phase.dragging;
          _pull = (-n.metrics.pixels).clamp(0.0, _maxPull);
        });
      }
    } else if (n is ScrollEndNotification && _phase == _Phase.dragging) {
      if (_pull >= _triggerPull) {
        _launch();
      } else {
        _cancel();
      }
    }
    return false;
  }

  void _launch() {
    setState(() {
      _snapFrom = _pull;
      _pull = 0;
      _refreshResolvedEarly = false;
      _phase = _Phase.launching;
    });
    _controller
      ..duration = const Duration(milliseconds: 520)
      ..reset();
    _controller.forward().whenComplete(_settleAfterLaunch);
    widget.onRefresh().whenComplete(() {
      if (!mounted) return;
      if (_phase == _Phase.launching) {
        // Let the launch animation finish landing before reacting —
        // stopping it mid-flight would jump the tile awkwardly.
        _refreshResolvedEarly = true;
        return;
      }
      _controller.stop();
      _cancel();
    });
  }

  void _settleAfterLaunch() {
    if (!mounted) return;
    if (_refreshResolvedEarly) {
      _cancel();
      return;
    }
    setState(() => _phase = _Phase.refreshing);
    _controller
      ..duration = const Duration(milliseconds: 1400)
      ..repeat();
  }

  void _cancel() {
    final current = _curveDepth; // capture before mutating _phase
    setState(() {
      _snapFrom = current;
      _pull = 0;
      _phase = _Phase.snapping;
    });
    _controller
      ..duration = const Duration(milliseconds: 500)
      ..reset();
    _controller.forward().whenComplete(() {
      if (!mounted) return;
      setState(() {
        _phase = _Phase.idle;
        _snapFrom = 0;
      });
    });
  }

  double get _curveDepth {
    switch (_phase) {
      case _Phase.idle:
        return 0;
      case _Phase.dragging:
        return _pull;
      case _Phase.launching:
        final t = Curves.easeOutExpo.transform(_controller.value);
        return _snapFrom * (1 - t);
      case _Phase.refreshing:
        return 0;
      case _Phase.snapping:
        final t = Curves.easeOut.transform(_controller.value);
        return _snapFrom * (1 - t);
    }
  }

  double get _tileY {
    switch (_phase) {
      case _Phase.idle:
        return 0;
      case _Phase.dragging:
      case _Phase.snapping:
        return _curveDepth;
      case _Phase.launching:
        final t = Curves.easeOutBack.transform(_controller.value);
        return lerpDouble(_snapFrom, _dockedY, t)!;
      case _Phase.refreshing:
        return _dockedY + math.sin(_controller.value * 2 * math.pi) * 3;
    }
  }

  double get _tileOpacity {
    switch (_phase) {
      case _Phase.idle:
        return 0;
      case _Phase.dragging:
      case _Phase.snapping:
        return (_curveDepth / 18).clamp(0.0, 1.0);
      case _Phase.launching:
      case _Phase.refreshing:
        return 1;
    }
  }

  double get _tileScale {
    switch (_phase) {
      case _Phase.idle:
        return 0.7;
      case _Phase.dragging:
      case _Phase.snapping:
        final progress = (_curveDepth / _triggerPull).clamp(0.0, 1.0);
        return 0.7 + progress * 0.3;
      case _Phase.launching:
      case _Phase.refreshing:
        return 1;
    }
  }

  double get _tileRotation {
    switch (_phase) {
      case _Phase.idle:
        return 0;
      case _Phase.dragging:
      case _Phase.snapping:
        final progress = (_curveDepth / _triggerPull).clamp(0.0, 1.0);
        return progress * 0.12;
      case _Phase.launching:
        final t = Curves.easeOutBack.transform(_controller.value);
        return (1 - t).clamp(0.0, 1.0) * -0.35;
      case _Phase.refreshing:
        return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final curveDepth = _curveDepth;
    final tileVisible = _phase != _Phase.idle;

    return NotificationListener<ScrollNotification>(
      onNotification: _onNotification,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          widget.child,
          if (curveDepth > 0.5)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: curveDepth,
              child: CustomPaint(
                size: Size.infinite,
                painter: _CurvePainter(fill: c.cream, stroke: c.rule),
              ),
            ),
          if (tileVisible)
            Positioned(
              top: _tileY - _tileSize / 2,
              left: 0,
              right: 0,
              child: IgnorePointer(
                child: Center(
                  child: Opacity(
                    opacity: _tileOpacity,
                    child: Transform.rotate(
                      angle: _tileRotation,
                      child: Transform.scale(
                        scale: _tileScale,
                        child: Container(
                          width: _tileSize,
                          height: _tileSize,
                          decoration: BoxDecoration(
                            color: c.ink,
                            borderRadius: BorderRadius.circular(6),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The sagging "membrane" between the top edge and the pull depth — a
/// filled cup shape (quadratic bezier dipping to [size.height] at the
/// midpoint) with just its curved edge stroked, not the straight top.
class _CurvePainter extends CustomPainter {
  const _CurvePainter({required this.fill, required this.stroke});

  final Color fill;
  final Color stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final cup = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..quadraticBezierTo(size.width / 2, size.height * 2, 0, 0)
      ..close();
    canvas.drawPath(cup, Paint()..color = fill);

    final edge = Path()
      ..moveTo(size.width, 0)
      ..quadraticBezierTo(size.width / 2, size.height * 2, 0, 0);
    canvas.drawPath(
      edge,
      Paint()
        ..color = stroke
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
  }

  @override
  bool shouldRepaint(_CurvePainter oldDelegate) =>
      oldDelegate.fill != fill || oldDelegate.stroke != stroke;
}
