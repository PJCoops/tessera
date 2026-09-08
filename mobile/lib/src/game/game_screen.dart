import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../settings/settings.dart';
import '../theme/tokens.dart';
import 'board.dart';
import 'board_controller.dart';
import 'board_view.dart';
import 'feedback.dart';
import 'first_run.dart';

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
    final c = context.colors;
    final settings = ref.watch(settingsProvider);
    final puzzle = ref.watch(puzzleProvider);
    final showDemo = puzzle.hasValue && !ref.watch(firstRunSeenProvider);

    // Only wire sound/haptics once there's a board to react to.
    if (puzzle.hasValue) {
      ref.listen<BoardState>(boardProvider, _onBoardChanged);
    }

    if (showDemo) {
      return Scaffold(
        backgroundColor: c.paper,
        body: SafeArea(child: FirstRunDemo(onDone: () => setState(() {}))),
      );
    }

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
                child: puzzle.when(
                  loading: () => const _BoardSkeleton(),
                  error: (_, _) => _PuzzleError(
                    onRetry: () => ref.invalidate(puzzleProvider),
                  ),
                  data: (_) => const _Playing(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Playing extends ConsumerWidget {
  const _Playing();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final board = ref.watch(boardProvider);
    final puzzle = ref.watch(puzzleProvider).requireValue;

    final status = board.isSolved
        ? 'Solved in ${board.moves} ${board.moves == 1 ? "move" : "moves"}'
        : board.selectedIndex != null
        ? 'Tap another tile to swap'
        : 'Moves ${board.moves} · ${board.validRowCount}/${board.n} rows';

    return Column(
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
          child: Text(status, style: TextStyle(fontSize: 15, color: c.inkSoft)),
        ),
        const SizedBox(height: 28),
        const BoardView(),
        const SizedBox(height: 28),
        TextButton(
          onPressed: () => ref.read(boardProvider.notifier).reset(),
          child: Text('Reset', style: TextStyle(color: c.muted)),
        ),
      ],
    );
  }
}

class _BoardSkeleton extends StatelessWidget {
  const _BoardSkeleton();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Center(
      child: Container(
        width: 320,
        height: 320,
        decoration: BoxDecoration(
          color: c.cream,
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }
}

class _PuzzleError extends StatelessWidget {
  const _PuzzleError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          "Connect to load today's puzzle",
          style: TextStyle(fontSize: 15, color: c.inkSoft),
        ),
        const SizedBox(height: 16),
        OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
      ],
    );
  }
}
