import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme/tokens.dart';
import 'board.dart';
import 'board_controller.dart';

const _gap = 8.0;
const _radius = 10.0;

/// The tile grid. Tiles are positioned absolutely and animate to their
/// slot on a swap (transform only — spec §13.2). Every tile carries a
/// semantic label with its position, letter, and state (§17.1).
class BoardView extends ConsumerWidget {
  const BoardView({super.key, this.maxSize = 360});

  final double maxSize;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final board = ref.watch(boardProvider);
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
    required this.onTap,
  });

  final Tile tile;
  final int slot;
  final int n;
  final double size;
  final bool selected;
  final bool rowValid;
  final bool solved;
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

    final state = solved
        ? 'row complete'
        : rowValid
            ? 'row complete'
            : selected
                ? 'selected'
                : null;
    final label = [
      'Row ${row + 1}, column ${col + 1}',
      tile.letter,
      ?state,
    ].join(', ');

    return AnimatedPositioned(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
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
            child: AnimatedScale(
              scale: selected ? 1.04 : 1,
              duration: const Duration(milliseconds: 120),
              curve: Curves.easeOut,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
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
    );
  }
}
