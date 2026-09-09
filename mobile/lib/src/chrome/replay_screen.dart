import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../epoch.dart';
import '../i18n.dart';
import '../i18n/dict.dart';
import '../mode.dart';
import '../puzzle_number.dart';
import '../settings/settings.dart';
import '../theme/tokens.dart';
import '../game/board_controller.dart';
import '../game/board_view.dart';
import '../game/replay.dart';

/// An isolated replay of a past puzzle (opened from the history "Replay"
/// list). The board runs in a nested [ProviderScope] that overrides
/// [puzzleProvider] and [boardProvider], so nothing here touches the
/// stored result or the streak.
class ReplayScreen extends ConsumerWidget {
  const ReplayScreen({super.key, required this.date, required this.modeId});

  final String date;
  final ModeId modeId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final locale = ref.watch(settingsProvider.select((s) => s.locale));
    final args = ReplayArgs(date: date, modeId: modeId, locale: locale);
    final puzzle = ref.watch(replayPuzzleProvider(args));

    return Scaffold(
      backgroundColor: c.paper,
      appBar: AppBar(
        backgroundColor: c.paper,
        title: Text(t(dict, 'game.replay.kicker')),
      ),
      body: SafeArea(
        child: Center(
          child: puzzle.when(
            loading: () => const CircularProgressIndicator(),
            error: (_, _) => Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    t(dict, 'game.loadError'),
                    textAlign: TextAlign.center,
                    style: TextStyle(color: c.inkSoft),
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton(
                    onPressed: () =>
                        ref.invalidate(replayPuzzleProvider(args)),
                    child: Text(t(dict, 'game.loadRetry')),
                  ),
                ],
              ),
            ),
            data: (p) => ProviderScope(
              overrides: [
                puzzleProvider.overrideWith((ref) => p),
                boardProvider.overrideWith(BoardController.new),
              ],
              child: _ReplayBoard(date: date),
            ),
          ),
        ),
      ),
    );
  }
}

class _ReplayBoard extends ConsumerWidget {
  const _ReplayBoard({required this.date});

  final String date;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final board = ref.watch(boardProvider);
    final num = puzzleNumber(date, kEpoch);

    final status = board.isSolved
        ? t(dict, 'game.solvedShort')
        : t(dict, 'game.replay.movesStatus', {
            'moves': board.moves,
            'valid': board.validRowCount,
            'total': board.n,
          });

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            t(dict, 'game.replay.subKicker', {
              'num': num,
              'date': date,
            }).toUpperCase(),
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
            onPressed: () => Navigator.of(context).pop(),
            child: Text(
              t(dict, 'game.replay.backToToday'),
              style: TextStyle(color: c.muted),
            ),
          ),
        ],
      ),
    );
  }
}
