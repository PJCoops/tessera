import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../epoch.dart';
import '../i18n.dart';
import '../i18n/dict.dart';
import '../clock.dart';
import '../mode.dart';
import '../puzzle_number.dart';
import '../settings/settings.dart';
import '../streak.dart';
import '../theme/tokens.dart';
import '../tier.dart';
import '../game/results.dart';
import 'replay_screen.dart';
import 'tier_colors.dart';

/// Port of app/HistoryModal.tsx. Mode-scoped stats (Classic/Hard toggle),
/// a "Your solves" tab (tier breakdown + streak + solve list) and a
/// "Replay" tab listing every past puzzle.
class HistoryScreen extends ConsumerStatefulWidget {
  const HistoryScreen({super.key});

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  ModeId? _mode;

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final mode = _mode ??= ref.read(settingsProvider).modeId;
    final results = ref.watch(resultsProvider(mode));
    final streak = ref.watch(streakProvider(mode));

    final entries = results.entries.toList()
      ..sort((a, b) => b.key.compareTo(a.key));
    final solved = entries.where((e) => !e.value.revealed).toList();
    final solvedCount = solved.length;
    final avgMoves = solvedCount == 0
        ? 0
        : (solved.fold<int>(0, (s, e) => s + e.value.moves) / solvedCount)
              .round();

    final tierCounts = <TierKey, int>{};
    for (final e in solved) {
      final k = getTier(e.value.moves, e.value.minSwaps ?? 1).key;
      tierCounts[k] = (tierCounts[k] ?? 0) + 1;
    }

    return Scaffold(
      backgroundColor: c.paper,
      appBar: AppBar(
        backgroundColor: c.paper,
        title: Text(t(dict, 'history.title')),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(96),
          child: Column(
            children: [
              _ModeToggle(
                value: mode,
                onChanged: (m) => setState(() => _mode = m),
                labels: (
                  t(dict, 'history.mode.classic'),
                  t(dict, 'history.mode.hard'),
                ),
              ),
              const SizedBox(height: 8),
              TabBar(
                controller: _tabs,
                labelColor: c.ink,
                unselectedLabelColor: c.muted,
                indicatorColor: c.ink,
                tabs: [
                  Tab(text: t(dict, 'history.tabs.solves')),
                  Tab(text: t(dict, 'history.tabs.all')),
                ],
              ),
            ],
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _SolvesTab(
            dict: dict,
            entries: entries,
            solvedCount: solvedCount,
            avgMoves: avgMoves,
            streak: streak,
            tierCounts: tierCounts,
          ),
          _ReplayTab(dict: dict, mode: mode, results: results),
        ],
      ),
    );
  }
}

class _ModeToggle extends StatelessWidget {
  const _ModeToggle({
    required this.value,
    required this.onChanged,
    required this.labels,
  });

  final ModeId value;
  final ValueChanged<ModeId> onChanged;
  final (String, String) labels;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    Widget seg(ModeId id, String label) {
      final active = id == value;
      return GestureDetector(
        onTap: () => onChanged(id),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: active ? c.paper : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
            border: active ? Border.all(color: c.rule) : null,
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: active ? c.ink : c.muted,
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: c.cream,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: c.rule),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          seg(ModeId.classic, labels.$1),
          seg(ModeId.hard, labels.$2),
        ],
      ),
    );
  }
}

class _SolvesTab extends StatelessWidget {
  const _SolvesTab({
    required this.dict,
    required this.entries,
    required this.solvedCount,
    required this.avgMoves,
    required this.streak,
    required this.tierCounts,
  });

  final Map<String, dynamic> dict;
  final List<MapEntry<int, StoredResult>> entries;
  final int solvedCount;
  final int avgMoves;
  final Streak streak;
  final Map<TierKey, int> tierCounts;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          children: [
            _Stat(label: t(dict, 'history.stats.solved'), value: solvedCount),
            _Stat(label: t(dict, 'history.stats.avgMoves'), value: avgMoves),
            _Stat(
              label: t(dict, 'history.stats.streak'),
              value: streak.current,
            ),
            _Stat(label: t(dict, 'history.stats.best'), value: streak.max),
          ],
        ),
        const SizedBox(height: 20),
        Text(
          t(dict, 'history.byTier').toUpperCase(),
          style: TextStyle(fontSize: 10, letterSpacing: 1, color: c.muted),
        ),
        const SizedBox(height: 8),
        _TierDistribution(dict: dict, counts: tierCounts),
        const SizedBox(height: 20),
        if (entries.isEmpty)
          Text(
            t(dict, 'history.empty'),
            style: TextStyle(fontSize: 14, color: c.muted),
          )
        else
          ...entries.map((e) => _ResultRow(dict: dict, num: e.key, r: e.value)),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 3),
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: c.cream,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Column(
          children: [
            Text(
              '$value',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w300,
                color: c.ink,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label.toUpperCase(),
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 9, letterSpacing: 0.5, color: c.muted),
            ),
          ],
        ),
      ),
    );
  }
}

class _TierDistribution extends StatelessWidget {
  const _TierDistribution({required this.dict, required this.counts});

  final Map<String, dynamic> dict;
  final Map<TierKey, int> counts;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final max = [1, ...counts.values].reduce((a, b) => a > b ? a : b);
    return Column(
      children: [
        for (final tier in tiers)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              children: [
                SizedBox(
                  width: 80,
                  child: Text(
                    t(dict, 'tiers.${tier.key.name}'),
                    style: TextStyle(fontSize: 11, color: c.muted),
                  ),
                ),
                Expanded(
                  child: LayoutBuilder(
                    builder: (context, box) {
                      final count = counts[tier.key] ?? 0;
                      final frac = count == 0 ? 0.0 : (count / max);
                      return Stack(
                        children: [
                          Container(
                            height: 20,
                            decoration: BoxDecoration(
                              border: Border.all(color: c.rule),
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                          if (count > 0)
                            Container(
                              height: 20,
                              width: (box.maxWidth * frac).clamp(
                                20.0,
                                box.maxWidth,
                              ),
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.only(right: 6),
                              decoration: BoxDecoration(
                                color: tierColors[tier.key],
                                borderRadius: BorderRadius.circular(3),
                              ),
                              child: Text(
                                '$count',
                                style: const TextStyle(
                                  fontSize: 10,
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            )
                          else
                            const Padding(
                              padding: EdgeInsets.only(left: 6, top: 4),
                              child: Text('0', style: TextStyle(fontSize: 10)),
                            ),
                        ],
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _ResultRow extends StatelessWidget {
  const _ResultRow({required this.dict, required this.num, required this.r});

  final Map<String, dynamic> dict;
  final int num;
  final StoredResult r;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final date = dateFromPuzzleNumber(num, kEpoch);
    final tierKey = r.revealed ? null : getTier(r.moves, r.minSwaps ?? 1).key;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            '#$num · $date',
            style: TextStyle(fontSize: 13, color: c.muted),
          ),
          Row(
            children: [
              if (tierKey != null) ...[
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: tierColors[tierKey],
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
              ],
              Text(
                r.revealed
                    ? t(dict, 'history.revealed')
                    : '${r.moves} ${t(dict, r.moves == 1 ? 'game.moveSingular' : 'game.movePlural')}',
                style: TextStyle(
                  fontSize: 13,
                  color: r.revealed ? c.muted : c.ink,
                  fontWeight: r.revealed ? FontWeight.w400 : FontWeight.w600,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ReplayTab extends StatelessWidget {
  const _ReplayTab({
    required this.dict,
    required this.mode,
    required this.results,
  });

  final Map<String, dynamic> dict;
  final ModeId mode;
  final Map<int, StoredResult> results;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final todayNum = puzzleNumber(todayUtcDate(), kEpoch);
    if (todayNum <= 1) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            t(dict, 'history.allPuzzles.empty'),
            style: TextStyle(fontSize: 14, color: c.muted),
          ),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(20),
      itemCount: todayNum - 1,
      separatorBuilder: (_, _) => Divider(height: 1, color: c.rule),
      itemBuilder: (context, i) {
        final num = todayNum - 1 - i;
        final date = dateFromPuzzleNumber(num, kEpoch);
        final r = results[num];
        final tierKey = (r != null && !r.revealed)
            ? getTier(r.moves, r.minSwaps ?? 1).key
            : null;
        return InkWell(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => ReplayScreen(date: date, modeId: mode),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '#$num · $date',
                  style: TextStyle(fontSize: 13, color: c.muted),
                ),
                Row(
                  children: [
                    if (tierKey != null) ...[
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: tierColors[tierKey],
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],
                    Text(
                      r == null
                          ? t(dict, 'history.allPuzzles.notPlayed')
                          : r.revealed
                          ? t(dict, 'history.revealed')
                          : '${r.moves} ${t(dict, r.moves == 1 ? 'game.moveSingular' : 'game.movePlural')}',
                      style: TextStyle(
                        fontSize: 13,
                        color: r == null ? c.muted : c.ink,
                      ),
                    ),
                    Icon(Icons.chevron_right, size: 18, color: c.muted),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
