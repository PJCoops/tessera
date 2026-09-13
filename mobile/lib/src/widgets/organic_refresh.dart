// A pull-to-refresh indicator with some personality: a single ink droplet
// that stretches taut as you pull — rubber-band physics, not a fade-in
// spinner — then snaps back with an elastic overshoot, or (past the
// trigger threshold) settles into a soft breathing pulse while the
// refresh runs.
//
// Built from scratch rather than Material's RefreshIndicator because that
// widget has no shape/animation hook — only color and stroke width — and
// the whole point here is a different feel, not a recolored spinner.
// Tracks the same OverscrollNotification/ScrollEndNotification pair
// RefreshIndicator itself uses internally, so it plays correctly with
// ClampingScrollPhysics (no visible overscroll needed to detect the pull).

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

enum _Phase { idle, dragging, docking, refreshing, snapping }

class _OrganicRefreshState extends State<OrganicRefresh>
    with SingleTickerProviderStateMixin {
  static const _maxPull = 88.0;
  static const _triggerPull = 60.0;
  static const _dockedPull = 44.0;

  // Eagerly built in initState, not a lazy `late final` field initializer:
  // idle builds never touch _controller at all (see _displayPull/build
  // below), so a lazy initializer would fire on its first-ever access —
  // inside dispose() — by which point the element is deactivating and
  // AnimationController's vsync lookup throws.
  late final AnimationController _controller;

  _Phase _phase = _Phase.idle;
  double _pull = 0; // 0.._maxPull, follows the finger 1:1 while dragging
  double _snapFrom = 0;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..addListener(() => setState(() {}));
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
    } else if (n is ScrollEndNotification && _phase == _Phase.dragging) {
      if (_pull >= _triggerPull) {
        _startRefresh();
      } else {
        _snapBack();
      }
    }
    return false;
  }

  void _startRefresh() {
    setState(() {
      _phase = _Phase.docking;
      _snapFrom = _pull;
    });
    _controller
      ..duration = const Duration(milliseconds: 220)
      ..reset();
    _controller.forward().whenComplete(() {
      if (!mounted) return;
      setState(() => _phase = _Phase.refreshing);
      _controller
        ..duration = const Duration(milliseconds: 1100)
        ..repeat(reverse: true);
    });
    widget.onRefresh().whenComplete(() {
      if (!mounted) return;
      _controller.stop();
      _snapBack();
    });
  }

  void _snapBack() {
    // _displayPull, not _pull: the latter only tracks the live drag and is
    // stale once docking/refreshing has taken over the visual position.
    final current = _displayPull;
    setState(() {
      _snapFrom = current;
      _pull = 0;
      _phase = _Phase.snapping;
    });
    _controller
      ..duration = const Duration(milliseconds: 650)
      ..reset();
    _controller.forward().whenComplete(() {
      if (!mounted) return;
      setState(() {
        _phase = _Phase.idle;
        _pull = 0;
      });
    });
  }

  double get _displayPull {
    switch (_phase) {
      case _Phase.idle:
        return 0;
      case _Phase.dragging:
        return _pull;
      case _Phase.docking:
        // Settle from wherever release happened down to the docked height.
        final t = Curves.easeOutCubic.transform(_controller.value);
        return _snapFrom + (_dockedPull - _snapFrom) * t;
      case _Phase.refreshing:
        // Holds at the docked height — the breathing wobble is a scale
        // effect layered on top in build(), not a position change, so it
        // doesn't fight this every repeat cycle.
        return _dockedPull;
      case _Phase.snapping:
        final t = Curves.elasticOut.transform(_controller.value);
        return _snapFrom * (1 - t);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final pull = _displayPull;
    final progress = (pull / _triggerPull).clamp(0.0, 1.0);
    final active =
        pull >= _triggerPull ||
        _phase == _Phase.docking ||
        _phase == _Phase.refreshing;

    // Rubber-band stretch: taller and narrower the further it's pulled,
    // like a droplet hanging off the top edge rather than a static icon
    // fading in.
    final stretch = 1 + progress * 0.9;
    final squeeze = 1 - progress * 0.28;
    final wobble = _phase == _Phase.refreshing
        ? math.sin(_controller.value * math.pi) * 0.12
        : 0.0;

    return NotificationListener<ScrollNotification>(
      onNotification: _onNotification,
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          widget.child,
          if (pull > 0.5)
            Positioned(
              top: 14,
              child: IgnorePointer(
                child: Opacity(
                  opacity: (pull / 18).clamp(0.0, 1.0),
                  child: Transform.scale(
                    scaleX: squeeze + wobble,
                    scaleY: stretch - wobble,
                    child: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: active ? c.ink : c.muted,
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
