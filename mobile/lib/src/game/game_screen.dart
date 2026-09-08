import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme/tokens.dart';
import 'board_controller.dart';
import 'board_view.dart';

class GameScreen extends ConsumerWidget {
  const GameScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final board = ref.watch(boardProvider);
    final puzzle = ref.watch(puzzleProvider);

    final status = board.isSolved
        ? 'Solved in ${board.moves} ${board.moves == 1 ? "move" : "moves"}'
        : board.selectedIndex != null
            ? 'Tap another tile to swap'
            : 'Moves ${board.moves} · ${board.validRowCount}/${board.n} rows';

    return Scaffold(
      backgroundColor: c.paper,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'TESSERA · #${puzzle.num}',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    letterSpacing: 2,
                    fontWeight: FontWeight.w600,
                    color: c.muted,
                  ),
                ),
                const SizedBox(height: 10),
                Semantics(
                  liveRegion: true,
                  child: Text(
                    status,
                    style: TextStyle(fontSize: 15, color: c.inkSoft),
                  ),
                ),
                const SizedBox(height: 28),
                const BoardView(),
                const SizedBox(height: 28),
                TextButton(
                  onPressed: () => ref.read(boardProvider.notifier).reset(),
                  child: Text('Reset', style: TextStyle(color: c.muted)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
