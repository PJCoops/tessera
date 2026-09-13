// A catapult-style pull-to-refresh: pulling down sags the top edge into a
// curved "pocket" (a c.cream membrane against c.paper, traced with a
// c.rule hairline), with a blank tile (c.paper fill, c.rule outline —
// matching a real board tile) riding at the bottom of the
// sag. The list content is pinned to sit exactly below the curve — it
// never bounces on its own — so nothing overlaps or races the elastic.
// Release past the trigger and the tile is flung straight up, past the
// top edge, clipped away behind the app/tab bar rather than fading;
// release short of it and everything eases back down to flat instead.
// Either way the tile stays fully opaque throughout — no opacity trick.
//
// Built from scratch rather than Material's RefreshIndicator, which has
// no shape/animation hook — only color and stroke width. Tracks the same
// two notification shapes RefreshIndicator itself has to handle
// internally: ClampingScrollPhysics (what the wrapped list should use —
// see the physics note below) reports a pull past the top as
// OverscrollNotification; BouncingScrollPhysics (iOS's un-overridden
// default) never "overscrolls" at all, it just lets ScrollMetrics.pixels
// go negative via an ordinary ScrollUpdateNotification. Both are
// handled, so this still degrades gracefully if some caller's list
// doesn't force clamping physics — see the iOS-physics test group in
// organic_refresh_test.dart for why that distinction matters.
//
// Callers should pass a child using
// `AlwaysScrollableScrollPhysics(parent: ClampingScrollPhysics())`
// (not bouncing) — otherwise the list's own native rubber-band, on its
// own spring timing, fights this widget's, which is exactly the
// "overlaps and snaps back too fast" bug this shape was built to fix.

import 'dart:math' as math;

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

enum _Phase { idle, dragging, retracting, waiting }

class _OrganicRefreshState extends State<OrganicRefresh>
    with SingleTickerProviderStateMixin {
  static const _maxPull = 90.0;
  static const _triggerPull = 62.0;
  static const _tileSize = 22.0;
  // How far above the top edge a launch flings the tile before holding —
  // well past _tileSize so it's fully behind the clip, not peeking.
  static const _overshoot = 56.0;
  static const _launchDuration = Duration(milliseconds: 420);
  static const _cancelDuration = Duration(milliseconds: 620);
  // Full turns the tile spins through while it's flung away on launch.
  static const _spinTurns = 1.4;
  // Snappy, short-period spring — Flutter's default ElasticOutCurve(0.4)
  // reads as loose/sluggish for a quick UI gesture; this settles fast.
  static const _cancelCurve = ElasticOutCurve(0.5);

  // Eagerly built in initState, not a lazy `late final` field initializer:
  // an idle build never touches _controller at all, so a lazy initializer
  // would fire on its first-ever access — inside dispose() — by which
  // point the element is deactivating and AnimationController's vsync
  // lookup throws.
  late final AnimationController _controller;

  _Phase _phase = _Phase.idle;
  double _pull = 0; // 0.._maxPull, follows the finger 1:1 while dragging
  double _snapFrom = 0;
  double _retractTarget = 0; // 0 (cancel) or -_overshoot (launch)
  double _rotationAtRelease = 0;
  bool _isLaunch = false;
  bool _refreshDone = false;

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
      _retract(launch: _pull >= _triggerPull);
    }
    return false;
  }

  static double _dragTilt(double pull) =>
      (pull / _maxPull).clamp(0.0, 1.0) * 0.16;

  void _retract({required bool launch}) {
    final from = _pull;
    setState(() {
      _snapFrom = from;
      _rotationAtRelease = _dragTilt(from);
      _pull = 0;
      _isLaunch = launch;
      _refreshDone = false;
      _retractTarget = launch ? -_overshoot : 0;
      _phase = _Phase.retracting;
    });
    _controller
      ..duration = launch ? _launchDuration : _cancelDuration
      ..reset();
    _controller.forward().whenComplete(_afterRetract);
    if (launch) {
      widget.onRefresh().whenComplete(() {
        if (!mounted) return;
        _refreshDone = true;
        if (_phase == _Phase.waiting) _finish();
      });
    }
  }

  void _afterRetract() {
    if (!mounted) return;
    if (!_isLaunch) {
      _finish();
      return;
    }
    if (_refreshDone) {
      _finish();
    } else {
      setState(() => _phase = _Phase.waiting);
    }
  }

  void _finish() {
    if (!mounted) return;
    setState(() {
      _phase = _Phase.idle;
      _snapFrom = 0;
      _retractTarget = 0;
    });
  }

  /// Unclamped — negative once a launch has flung the tile past the top
  /// edge, which is exactly what lets it clip away behind the app/tab
  /// bar instead of needing an opacity fade.
  double get _depth {
    switch (_phase) {
      case _Phase.idle:
        return 0;
      case _Phase.dragging:
        return _pull;
      case _Phase.retracting:
        // Launch stays a decisive one-way acceleration (it's being flung
        // away, not springing back); cancel gets the elastic wobble —
        // giving up on a short pull should feel like letting go of a
        // rubber band, not a clean linear ease.
        final curve = _isLaunch ? Curves.easeInExpo : _cancelCurve;
        final t = curve.transform(_controller.value);
        return _snapFrom + (_retractTarget - _snapFrom) * t;
      case _Phase.waiting:
        return _retractTarget;
    }
  }

  /// Separate from [_depth]: a launch keeps spinning through multiple
  /// turns as it flies away (decoupled from position), while dragging
  /// and cancelling just tilt in proportion to how far it's pulled.
  double get _rotation {
    switch (_phase) {
      case _Phase.idle:
        return 0;
      case _Phase.dragging:
        return _dragTilt(_pull);
      case _Phase.retracting:
        if (_isLaunch) {
          final t = Curves.easeIn.transform(_controller.value);
          return _rotationAtRelease + t * _spinTurns * 2 * math.pi;
        }
        final t = _cancelCurve.transform(_controller.value);
        return _rotationAtRelease * (1 - t);
      case _Phase.waiting:
        return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final depth = _depth;
    // The curve panel and the list beneath it never go negative — only
    // the tile is allowed past the top edge, to clip away there.
    final curveHeight = depth < 0 ? 0.0 : depth;
    final tileVisible = _phase != _Phase.idle;
    final rotation = _rotation;
    final scale = depth >= 0
        ? 0.7 + (depth / _triggerPull).clamp(0.0, 1.0) * 0.3
        : 1.0;

    return NotificationListener<ScrollNotification>(
      onNotification: _onNotification,
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          // Pinned exactly below the curve, in lockstep with it — this
          // (not the list's own scroll physics) is what stops the list
          // from overlapping or out-racing the elastic on release.
          Transform.translate(
            offset: Offset(0, curveHeight),
            child: widget.child,
          ),
          if (curveHeight > 0.5)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: curveHeight,
              child: CustomPaint(
                size: Size.infinite,
                painter: _CurvePainter(fill: c.cream, stroke: c.rule),
              ),
            ),
          if (tileVisible)
            Positioned(
              top: depth - _tileSize / 2,
              left: 0,
              right: 0,
              child: IgnorePointer(
                child: Center(
                  child: Transform.rotate(
                    angle: rotation,
                    child: Transform.scale(
                      scale: scale,
                      child: Container(
                        width: _tileSize,
                        height: _tileSize,
                        decoration: BoxDecoration(
                          color: c.paper,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: c.rule, width: 1.5),
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
