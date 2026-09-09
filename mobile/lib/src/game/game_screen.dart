import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../auth/auth_controller.dart';
import '../auth/sign_in_sheet.dart';
import '../chrome/how_to_sheet.dart';
import '../chrome/history_screen.dart';
import '../chrome/legend.dart';
import '../chrome/settings_screen.dart';
import '../chrome/words_screen.dart';
import '../epoch.dart';
import '../i18n.dart';
import '../i18n/dict.dart';
import '../clock.dart';
import '../mode.dart';
import '../puzzle_number.dart';
import '../settings/settings.dart';
import '../share.dart';
import '../streak.dart';
import '../theme/tokens.dart';
import '../tier.dart';
import 'board.dart';
import 'board_controller.dart';
import 'board_view.dart';
import 'feedback.dart';
import 'first_run.dart';
import 'results.dart';

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
      _recordSolve(next);
    } else if (next.moves > prev.moves) {
      _feedback.swap();
    } else if (next.selectedIndex != null && prev.selectedIndex == null) {
      _feedback.select();
    }
  }

  void _recordSolve(BoardState board) {
    final puzzle = ref.read(puzzleProvider).valueOrNull;
    if (puzzle == null) return;
    final mode = ref.read(activeModeProvider);
    if (ref.read(resultsProvider(mode.id)).containsKey(puzzle.num)) return;
    ref
        .read(resultsProvider(mode.id).notifier)
        .record(
          puzzle.num,
          StoredResult(
            moves: board.moves,
            bonus: board.isBonus,
            completedAt: DateTime.now().millisecondsSinceEpoch,
            minSwaps: puzzle.minSwaps,
          ),
        );
  }

  Future<void> _confirmReveal() async {
    final c = context.colors;
    final dict = ref.read(dictOrEmptyProvider);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: c.paper,
        title: Text(t(dict, 'game.revealConfirm.title')),
        content: Text(t(dict, 'game.revealConfirm.body')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(t(dict, 'game.revealConfirm.cancel')),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: c.ink,
              foregroundColor: c.paper,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(t(dict, 'game.revealConfirm.confirm')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final puzzle = ref.read(puzzleProvider).valueOrNull;
    final mode = ref.read(activeModeProvider);
    final board = ref.read(boardProvider);
    ref.read(boardProvider.notifier).reveal();
    if (puzzle != null &&
        !ref.read(resultsProvider(mode.id)).containsKey(puzzle.num)) {
      ref
          .read(resultsProvider(mode.id).notifier)
          .record(
            puzzle.num,
            StoredResult(
              moves: board.moves,
              bonus: false,
              completedAt: DateTime.now().millisecondsSinceEpoch,
              revealed: true,
              minSwaps: puzzle.minSwaps,
            ),
          );
    }
  }

  Future<void> _share() async {
    final dict = ref.read(dictProvider).valueOrNull;
    final puzzle = ref.read(puzzleProvider).valueOrNull;
    if (dict == null || puzzle == null) return;
    final mode = ref.read(activeModeProvider);
    final locale = ref.read(settingsProvider).locale;
    final stored = ref.read(resultsProvider(mode.id))[puzzle.num];
    final board = ref.read(boardProvider);

    final revealed = stored?.revealed ?? false;
    final int moves;
    final bool bonus;
    if (revealed) {
      moves = stored!.moves;
      bonus = false;
    } else if (board.isSolved) {
      moves = board.moves;
      bonus = board.isBonus;
    } else if (stored != null) {
      moves = stored.moves;
      bonus = stored.bonus;
    } else {
      return;
    }

    final todayNum = puzzleNumber(todayUtcDate(), kEpoch);
    final streak = visibleCurrent(ref.read(streakProvider(mode.id)), todayNum);
    final payload = buildSharePayload(
      ShareInput(
        puzzleNumber: puzzle.num,
        moves: moves,
        minSwaps: puzzle.minSwaps,
        streak: streak,
        bonus: bonus,
        revealed: revealed,
        locale: locale,
        dict: dict,
        mode: mode.id == ModeId.hard ? 'hard' : 'classic',
      ),
    );
    await Share.share(payload.full);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final puzzle = ref.watch(puzzleProvider);
    final showDemo = puzzle.hasValue && !ref.watch(firstRunSeenProvider);

    // Keep sound/haptics and the settings mute in sync once a board exists.
    if (puzzle.hasValue) {
      ref.listen<BoardState>(boardProvider, _onBoardChanged);
    }
    ref.listen<bool>(
      settingsProvider.select((s) => s.muted),
      (_, muted) => _feedback.muted = muted,
    );

    if (showDemo) {
      return Scaffold(
        backgroundColor: c.paper,
        body: SafeArea(child: FirstRunDemo(onDone: () => setState(() {}))),
      );
    }

    return Scaffold(
      backgroundColor: c.paper,
      body: SafeArea(
        child: Column(
          children: [
            const _TopBar(),
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                  child: puzzle.when(
                    loading: () => const _BoardSkeleton(),
                    error: (_, _) => _PuzzleError(
                      onRetry: () => ref.invalidate(puzzleProvider),
                    ),
                    data: (_) => _Playing(
                      onShare: _share,
                      onReveal: _confirmReveal,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopBar extends ConsumerWidget {
  const _TopBar();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final mode = ref.watch(activeModeProvider);
    final todayNum = puzzleNumber(todayUtcDate(), kEpoch);
    final streak = visibleCurrent(ref.watch(streakProvider(mode.id)), todayNum);

    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
      child: Row(
        children: [
          if (streak > 0)
            _StreakChip(count: streak)
          else
            const SizedBox(width: 8),
          const Spacer(),
          IconButton(
            tooltip: t(dict, 'game.howToPlay'),
            onPressed: () => showHowToSheet(context, n: mode.n),
            icon: Icon(Icons.help_outline, color: c.muted),
          ),
          IconButton(
            tooltip: t(dict, 'history.title'),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const HistoryScreen()),
            ),
            icon: Icon(Icons.bar_chart, color: c.muted),
          ),
          IconButton(
            tooltip: t(dict, 'howto.tabs.settings'),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const SettingsScreen()),
            ),
            icon: Icon(Icons.tune, color: c.muted),
          ),
        ],
      ),
    );
  }
}

class _StreakChip extends ConsumerWidget {
  const _StreakChip({required this.count});

  final int count;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final mode = ref.watch(activeModeProvider);

    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: () {
        final tierKey = ref.read(dominantTierProvider(mode.id));
        final String msg;
        if (tierKey != null) {
          final key = count == 1 ? 'streakToast.single' : 'streakToast.plural';
          msg = t(dict, key, {
            'n': count,
            'tier': t(dict, 'tiers.${tierKey.name}'),
          });
        } else {
          msg = t(dict, 'streakToast.noTier', {'n': count});
        }
        ScaffoldMessenger.of(context)
          ..clearSnackBars()
          ..showSnackBar(
            SnackBar(
              content: Text(msg, textAlign: TextAlign.center),
              behavior: SnackBarBehavior.floating,
              width: 260,
              duration: const Duration(milliseconds: 2400),
            ),
          );
      },
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          border: Border.all(color: c.rule),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          '🔥 $count',
          style: TextStyle(fontSize: 13, color: c.inkSoft),
        ),
      ),
    );
  }
}

class _Playing extends ConsumerWidget {
  const _Playing({required this.onShare, required this.onReveal});

  final Future<void> Function() onShare;
  final Future<void> Function() onReveal;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final board = ref.watch(boardProvider);
    final puzzle = ref.watch(puzzleProvider).requireValue;
    final mode = ref.watch(activeModeProvider);
    final stored = ref.watch(resultsProvider(mode.id))[puzzle.num];
    final wonCount = ref.watch(wonNumbersProvider(mode.id)).length;
    final hideHints = ref.watch(settingsProvider.select((s) => s.hideHints));

    final date = dateFromPuzzleNumber(puzzle.num, kEpoch);
    final finished = board.isSolved || stored != null;
    final revealed = (stored?.revealed ?? false) ||
        (board.isSolved && board.solvedAtMove == -1);

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          t(dict, mode.id == ModeId.hard ? 'game.kickerHard' : 'game.kicker', {
            'num': puzzle.num,
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
          child: _StatusLine(
            dict: dict,
            board: board,
            stored: stored,
            minSwaps: puzzle.minSwaps,
            n: mode.n,
            revealed: revealed,
          ),
        ),
        const SizedBox(height: 28),
        const BoardView(),
        const SizedBox(height: 28),

        if (finished)
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 12,
            children: [
              _OutlineButton(
                label: t(
                  dict,
                  revealed ? 'game.shareRevealed' : 'game.share',
                ),
                onPressed: onShare,
              ),
              _OutlineButton(
                label: t(dict, 'game.seeWords'),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const WordsScreen()),
                ),
              ),
            ],
          )
        else
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _PillButton(
                label: t(
                  dict,
                  hideHints ? 'game.showHints' : 'game.hideHints',
                ),
                onPressed: () => ref
                    .read(settingsProvider.notifier)
                    .setHideHints(!hideHints),
              ),
              const SizedBox(width: 8),
              _PillButton(
                label: t(dict, 'game.reveal'),
                onPressed: onReveal,
              ),
            ],
          ),

        if (finished) ...[
          const SizedBox(height: 16),
          _NextPuzzleCountdown(
            label: (cd) => t(dict, 'game.nextPuzzle', {'countdown': cd}),
          ),
        ],

        if (finished) const _AccountNudge(),

        if (wonCount < 2) ...[
          const SizedBox(height: 16),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 16,
            runSpacing: 8,
            children: [
              if (!hideHints)
                Legend(
                  variant: LegendVariant.hint,
                  label: t(dict, 'game.legend.correctRow'),
                ),
              Legend(
                variant: LegendVariant.row,
                label: t(dict, 'game.legend.correctWord'),
              ),
              Legend(
                variant: LegendVariant.bonus,
                label: t(dict, 'game.legend.puzzleComplete'),
              ),
            ],
          ),
        ],

        const SizedBox(height: 20),
        _ModeSwitchPill(
          label: t(
            dict,
            mode.id == ModeId.hard
                ? 'game.switchToClassic'
                : 'game.switchToHard',
          ),
          onPressed: () =>
              ref.read(settingsProvider.notifier).setMode(mode.other.id),
        ),
      ],
    );
  }
}

class _StatusLine extends StatelessWidget {
  const _StatusLine({
    required this.dict,
    required this.board,
    required this.stored,
    required this.minSwaps,
    required this.n,
    required this.revealed,
  });

  final Map<String, dynamic> dict;
  final BoardState board;
  final StoredResult? stored;
  final int minSwaps;
  final int n;
  final bool revealed;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final style = TextStyle(fontSize: 15, color: c.inkSoft);

    String text;
    if (revealed) {
      text = t(dict, 'game.revealedStatus');
    } else if (board.isSolved || stored != null) {
      final moves = board.isSolved ? board.moves : stored!.moves;
      final tier = getTier(moves, minSwaps);
      text = t(dict, 'game.solvedIn', {
        'moves': moves,
        'moveWord': t(
          dict,
          moves == 1 ? 'game.moveSingular' : 'game.movePlural',
        ),
        'tier': t(dict, 'tiers.${tier.key.name}'),
      });
    } else if (board.moves == 0 && board.selectedIndex == null) {
      return Column(
        children: [
          Text(t(dict, 'game.demoTipL1'), style: style, textAlign: TextAlign.center),
          Text(
            t(dict, 'game.demoTipL2', {'n': n}),
            style: style,
            textAlign: TextAlign.center,
          ),
        ],
      );
    } else {
      text = t(dict, 'game.movesStatus', {
        'moves': board.moves,
        'valid': board.validRowCount,
        'total': n,
      });
    }
    return Text(text, style: style, textAlign: TextAlign.center);
  }
}

class _NextPuzzleCountdown extends StatefulWidget {
  const _NextPuzzleCountdown({required this.label});

  final String Function(String) label;

  @override
  State<_NextPuzzleCountdown> createState() => _NextPuzzleCountdownState();
}

class _NextPuzzleCountdownState extends State<_NextPuzzleCountdown> {
  Timer? _timer;
  String _cd = _formatHms(_msToNextUtcMidnight());

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _cd = _formatHms(_msToNextUtcMidnight()));
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      widget.label(_cd),
      style: TextStyle(fontSize: 12, color: context.colors.muted),
    );
  }
}

int _msToNextUtcMidnight() {
  final now = DateTime.now().toUtc();
  final next = DateTime.utc(now.year, now.month, now.day + 1);
  return next.difference(now).inMilliseconds;
}

String _formatHms(int ms) {
  final total = ms < 0 ? 0 : ms ~/ 1000;
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(total ~/ 3600)}:${two((total % 3600) ~/ 60)}:${two(total % 60)}';
}

class _OutlineButton extends StatelessWidget {
  const _OutlineButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return OutlinedButton(
      style: OutlinedButton.styleFrom(
        foregroundColor: c.ink,
        side: BorderSide(color: c.rule),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      ),
      onPressed: onPressed,
      child: Text(label, style: const TextStyle(fontSize: 14)),
    );
  }
}

class _PillButton extends StatelessWidget {
  const _PillButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return TextButton(
      style: TextButton.styleFrom(
        foregroundColor: c.muted,
        backgroundColor: c.cream,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        minimumSize: const Size(0, 44),
      ),
      onPressed: onPressed,
      child: Text(label, style: const TextStyle(fontSize: 12)),
    );
  }
}

/// "Sign in to save your N-day streak →" — only for signed-out players
/// with a live streak (port of app/components/AccountCta.tsx).
class _AccountNudge extends ConsumerWidget {
  const _AccountNudge();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(activeModeProvider);
    final todayNum = puzzleNumber(todayUtcDate(), kEpoch);
    final streak = visibleCurrent(ref.watch(streakProvider(mode.id)), todayNum);
    if (streak < 1 || ref.watch(authUserProvider) != null) {
      return const SizedBox.shrink();
    }
    final dict = ref.watch(dictOrEmptyProvider);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: TextButton(
        onPressed: () => showSignInSheet(context),
        child: Text(
          t(dict, 'account.saveStreakLine', {'n': streak}),
          style: TextStyle(fontSize: 12, color: context.colors.muted),
        ),
      ),
    );
  }
}

class _ModeSwitchPill extends StatelessWidget {
  const _ModeSwitchPill({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return OutlinedButton(
      style: OutlinedButton.styleFrom(
        foregroundColor: c.muted,
        side: BorderSide(color: c.rule),
        shape: const StadiumBorder(),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        minimumSize: const Size(0, 44),
      ),
      onPressed: onPressed,
      child: Text(label, style: const TextStyle(fontSize: 12)),
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

class _PuzzleError extends ConsumerWidget {
  const _PuzzleError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          t(dict, 'game.loadError'),
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 15, color: c.inkSoft),
        ),
        const SizedBox(height: 16),
        OutlinedButton(
          onPressed: onRetry,
          child: Text(t(dict, 'game.loadRetry')),
        ),
      ],
    );
  }
}
