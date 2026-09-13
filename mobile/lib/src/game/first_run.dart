import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../theme/tokens.dart';
import 'board.dart';
import 'feedback.dart';

const _seenKey = 'tessera:first_run_demo_seen';

/// Whether the one-move first-run demo has been completed/dismissed.
/// Starts false, loads the persisted value, and flips to true (and
/// persists) when [FirstRunController.markSeen] is called.
final firstRunSeenProvider = NotifierProvider<FirstRunController, bool>(
  FirstRunController.new,
);

class FirstRunController extends Notifier<bool> {
  @override
  bool build() {
    _load();
    return false;
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_seenKey) ?? false) state = true;
  }

  Future<void> markSeen() async {
    state = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_seenKey, true);
  }
}

Future<void> markFirstRunSeen(WidgetRef ref) =>
    ref.read(firstRunSeenProvider.notifier).markSeen();

/// Teaches the swap mechanic by doing (spec §16.1): a single row one swap
/// from complete. The player makes the move, the row lands, and the demo
/// dismisses itself. This is the first thing shown — no sign-in, no
/// permissions — and it's what a store reviewer sees on first run
/// (rejection risk #1, §15).
class FirstRunDemo extends ConsumerStatefulWidget {
  const FirstRunDemo({super.key, required this.onDone});

  final VoidCallback onDone;

  @override
  ConsumerState<FirstRunDemo> createState() => _FirstRunDemoState();
}

class _FirstRunDemoState extends ConsumerState<FirstRunDemo> {
  // A 2x2 board one swap from solved: "IT / ON". Start has the T and O
  // exchanged; swapping them back completes both rows.
  static const _gold = ['it', 'on'];
  final _feedback = GameFeedback(muted: true);

  late BoardState _board = BoardState.start(
    goldRows: _gold,
    startTiles: const [Tile(0, 'I'), Tile(2, 'O'), Tile(1, 'T'), Tile(3, 'N')],
    minSwaps: 1,
  );
  bool _dismissing = false;

  @override
  void dispose() {
    _feedback.dispose();
    super.dispose();
  }

  void _tap(int index) {
    if (_dismissing) return;
    final prev = _board;
    setState(() => _board = _board.tap(index));
    if (_board.moves > prev.moves) _feedback.swap();
    if (_board.justSolved) {
      _feedback.solved();
      setState(() => _dismissing = true);
      Future.delayed(const Duration(milliseconds: 900), () async {
        if (!mounted) return;
        await markFirstRunSeen(ref);
        widget.onDone();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final done = _board.isSolved;

    return Container(
      color: c.paper,
      alignment: Alignment.center,
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            done ? 'That’s the whole game.' : 'Tap two tiles to swap them',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 24,
              fontWeight: FontWeight.w300,
              color: c.ink,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            done ? 'Now the real puzzle.' : 'Make each row spell a word.',
            style: TextStyle(fontSize: 14, color: c.muted),
          ),
          const SizedBox(height: 32),
          _DemoGrid(board: _board, onTap: _tap),
          const SizedBox(height: 32),
          TextButton(
            onPressed: () async {
              await markFirstRunSeen(ref);
              widget.onDone();
            },
            child: Text('Skip', style: TextStyle(color: c.muted)),
          ),
        ],
      ),
    );
  }
}

class _DemoGrid extends StatelessWidget {
  const _DemoGrid({required this.board, required this.onTap});

  final BoardState board;
  final void Function(int) onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    const size = 64.0;
    const gap = 8.0;

    Widget tile(int i) => GestureDetector(
      onTap: () => onTap(i),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: board.isSolved ? c.solved : c.tile,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: board.selectedIndex == i ? c.tileSelected : c.rule,
            width: board.selectedIndex == i ? 2.5 : 1,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          board.positions[i].letter,
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 26,
            fontWeight: FontWeight.w500,
            color: board.isSolved ? c.onSolved : c.ink,
          ),
        ),
      ),
    );

    return SizedBox(
      width: size * 2 + gap,
      height: size * 2 + gap,
      child: Column(
        children: [
          Row(
            children: [
              tile(0),
              const SizedBox(width: gap),
              tile(1),
            ],
          ),
          const SizedBox(height: gap),
          Row(
            children: [
              tile(2),
              const SizedBox(width: gap),
              tile(3),
            ],
          ),
        ],
      ),
    );
  }
}
