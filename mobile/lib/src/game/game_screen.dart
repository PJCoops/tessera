import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../settings/settings.dart';
import '../theme/tokens.dart';
import 'board.dart';
import 'board_controller.dart';
import 'board_view.dart';
import 'feedback.dart';

class GameScreen extends ConsumerStatefulWidget {
  const GameScreen({super.key});

  @override
  ConsumerState<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends ConsumerState<GameScreen> {
  final _feedback = GameFeedback();

  @override
  void dispose() {
    _feedback.dispose();
    super.dispose();
  }

  void _onBoardChanged(BoardState? prev, BoardState next) {
    if (prev == null) return;
    if (next.justSolved) {
      _feedback.solved();
    } else if (next.moves > prev.moves) {
      _feedback.swap();
    } else if (next.selectedIndex != null && prev.selectedIndex == null) {
      _feedback.select();
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(boardProvider, _onBoardChanged);

    final c = context.colors;
    final board = ref.watch(boardProvider);
    final puzzle = ref.watch(puzzleProvider);

    final status = board.isSolved
        ? 'Solved in ${board.moves} ${board.moves == 1 ? "move" : "moves"}'
        : board.selectedIndex != null
        ? 'Tap another tile to swap'
        : 'Moves ${board.moves} · ${board.validRowCount}/${board.n} rows';

    final settings = ref.watch(settingsProvider);

    return Scaffold(
      backgroundColor: c.paper,
      body: SafeArea(
        child: Stack(
          children: [
            Align(
              alignment: Alignment.topRight,
              child: IconButton(
                tooltip: 'Colour-blind palette',
                onPressed: () =>
                    ref.read(settingsProvider.notifier).toggleColourBlind(),
                icon: Icon(
                  settings.colourBlind
                      ? Icons.visibility
                      : Icons.visibility_outlined,
                  color: c.muted,
                ),
              ),
            ),
            Center(
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
          ],
        ),
      ),
    );
  }
}
