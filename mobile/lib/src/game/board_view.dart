import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../chrome/dashed_rect.dart';
import '../settings/settings.dart';
import '../theme/tokens.dart';
import 'board.dart';
import 'board_controller.dart';

const _gap = 8.0;
const _radius = 10.0;
const _cascadeStagger = Duration(milliseconds: 70);

/// The tile grid. Tiles are positioned absolutely and animate to their
/// slot on a swap (transform only — spec §13.2). Every tile carries a
/// semantic label with its position, letter, and state (§17.1). When the
/// board is solved the tiles bounce in reading order; the reduce-motion
/// path skips the bounce and just recolours (§17.3, §20.2).
class BoardView extends ConsumerWidget {
  const BoardView({super.key, this.maxSize = 360});

  final double maxSize;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final board = ref.watch(boardProvider);
    final hideHints = ref.watch(settingsProvider.select((s) => s.hideHints));
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    final n = board.n;

    return LayoutBuilder(
      builder: (context, constraints) {
        final side = constraints.maxWidth.clamp(0.0, maxSize);
        final tile = (side - _gap * (n - 1)) / n;

        return SizedBox(
          width: side,
          height: side,
          child: Stack(
            children: [
              for (var index = 0; index < board.positions.length; index++)
                _PositionedTile(
                  key: ValueKey(board.positions[index].id),
                  tile: board.positions[index],
                  slot: index,
                  n: n,
                  size: tile,
                  selected: board.selectedIndex == index,
                  rowValid: board.rowValid[index ~/ n],
                  solved: board.isSolved,
                  hint:
                      !hideHints &&
                      board.homeHint[index] &&
                      !board.rowValid[index ~/ n] &&
                      !board.isSolved,
                  reduceMotion: reduceMotion,
                  onTap: () => ref.read(boardProvider.notifier).tap(index),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _PositionedTile extends StatelessWidget {
  const _PositionedTile({
    super.key,
    required this.tile,
    required this.slot,
    required this.n,
    required this.size,
    required this.selected,
    required this.rowValid,
    required this.solved,
    required this.hint,
    required this.reduceMotion,
    required this.onTap,
  });

  final Tile tile;
  final int slot;
  final int n;
  final double size;
  final bool selected;
  final bool rowValid;
  final bool solved;

  /// Draw the dashed home-position outline (tile is on its home row).
  final bool hint;
  final bool reduceMotion;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final row = slot ~/ n;
    final col = slot % n;

    final Color bg;
    final Color fg;
    if (solved) {
      bg = c.solved;
      fg = c.onSolved;
    } else if (rowValid) {
      bg = c.rowValid;
      fg = c.onRowValid;
    } else {
      bg = c.tile;
      fg = c.ink;
    }

    final state = (solved || rowValid)
        ? 'row complete'
        : selected
        ? 'selected'
        : null;
    final label = [
      'Row ${row + 1}, column ${col + 1}',
      tile.letter,
      ?state,
    ].join(', ');

    final swapDuration = reduceMotion
        ? const Duration(milliseconds: 90)
        : const Duration(milliseconds: 200);
    final swapCurve = reduceMotion ? Curves.linear : Curves.easeOut;

    return AnimatedPositioned(
      duration: swapDuration,
      curve: swapCurve,
      left: col * (size + _gap),
      top: row * (size + _gap),
      width: size,
      height: size,
      child: RepaintBoundary(
        child: Semantics(
          button: true,
          label: label,
          excludeSemantics: true,
          child: GestureDetector(
            onTap: onTap,
            child: _CascadeScale(
              active: solved && !reduceMotion,
              delay: _cascadeStagger * slot,
              child: AnimatedScale(
                scale: selected ? 1.04 : 1,
                duration: Duration(milliseconds: reduceMotion ? 0 : 120),
                curve: Curves.easeOut,
                child: CustomPaint(
                  foregroundPainter: hint && !selected
                      ? DashedRectPainter(color: c.hint, radius: _radius)
                      : null,
                  child: AnimatedContainer(
                    duration: Duration(milliseconds: reduceMotion ? 120 : 180),
                    curve: Curves.easeOut,
                    decoration: BoxDecoration(
                      color: bg,
                      borderRadius: BorderRadius.circular(_radius),
                      border: Border.all(
                        color: selected ? c.tileSelected : c.rule,
                        width: selected ? 2.5 : 1,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      tile.letter,
                      style: TextStyle(
                        fontFamily: 'Fraunces',
                        fontSize: size * 0.42,
                        fontWeight: FontWeight.w300,
                        color: fg,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// One-shot bounce (scale 1 -> 1.1 -> 1) that starts [delay] after
/// [active] first becomes true. Used for the solved cascade so tiles pop
/// in reading order.
class _CascadeScale extends StatefulWidget {
  const _CascadeScale({
    required this.active,
    required this.delay,
    required this.child,
  });

  final bool active;
  final Duration delay;
  final Widget child;

  @override
  State<_CascadeScale> createState() => _CascadeScaleState();
}

class _CascadeScaleState extends State<_CascadeScale>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 320),
  );
  late final Animation<double> _scale = TweenSequence<double>([
    TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.1), weight: 1),
    TweenSequenceItem(tween: Tween(begin: 1.1, end: 1.0), weight: 1),
  ]).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));

  @override
  void didUpdateWidget(_CascadeScale old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) {
      Future.delayed(widget.delay, () {
        if (mounted) _ctrl.forward(from: 0);
      });
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      ScaleTransition(scale: _scale, child: widget.child);
}
