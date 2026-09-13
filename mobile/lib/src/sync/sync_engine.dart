import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../auth/account_client.dart';
import '../clock.dart';
import '../epoch.dart';
import '../game/results.dart';
import '../mode.dart';
import '../puzzle_number.dart';
import '../settings/settings.dart';
import '../streak.dart';

/// Shown once when a sign-in merge lowers the visible streak (spec §6.2 —
/// "never let the number drop without that explanation").
class StreakDecrease {
  const StreakDecrease({
    required this.mode,
    required this.previous,
    required this.current,
    required this.best,
    required this.pushed,
    required this.pulled,
  });

  final ModeId mode;
  final int previous; // visible current before the merge
  final int current; // visible current after recompute
  final int best; // preserved historical max
  final int pushed;
  final int pulled;
}

class SyncOutcome {
  const SyncOutcome({
    required this.pushed,
    required this.pulled,
    required this.adsRemoved,
    this.streakDecrease,
  });
  final int pushed;
  final int pulled;

  /// The account-level ads-removed entitlement (§8.2), as of this pull.
  final bool adsRemoved;
  final StreakDecrease? streakDecrease;
}

/// Port of app/lib/sync.ts. Push on-device results to the server, pull the
/// canonical history, recompute the streak from the merged set. Failures
/// on a single submit are queued and retried on the next launch.
class SyncEngine {
  SyncEngine(this._ref);

  final Ref _ref;

  static const _queueKey = 'tessera:sync-queue';
  static const _guardPrefix = 'tessera:synced:';

  AccountApi get _api => _ref.read(accountClientProvider);

  /// Fire-and-forget submit of one solved/revealed result. On failure the
  /// row is queued for [flushQueue].
  Future<void> submitOne(SubmitArgs a) async {
    try {
      await _api.submitResult(a);
    } catch (_) {
      await _enqueue(a);
    }
  }

  /// Drain the offline submit queue. Rows that still fail stay queued.
  Future<void> flushQueue() async {
    final p = await SharedPreferences.getInstance();
    final raw = p.getStringList(_queueKey) ?? const [];
    if (raw.isEmpty) return;
    final remaining = <String>[];
    for (final s in raw) {
      try {
        await _api.submitResult(
          _argsFromJson(jsonDecode(s) as Map<String, dynamic>),
        );
      } catch (_) {
        remaining.add(s);
      }
    }
    await p.setStringList(_queueKey, remaining);
  }

  Future<bool> alreadySynced(String userId) async {
    final p = await SharedPreferences.getInstance();
    return p.getBool('$_guardPrefix$userId') ?? false;
  }

  /// First-sign-in reconciliation. Safe to call again — it re-pushes local
  /// rows the server lacks and re-pulls, both idempotent server-side.
  Future<SyncOutcome> syncOnSignIn(String userId) async {
    final today = puzzleNumber(todayUtcDate(), kEpoch);
    final locale = _ref.read(settingsProvider).locale;

    // Snapshot local state before the merge.
    final localResults = <ModeId, Map<int, StoredResult>>{
      for (final m in ModeId.values) m: Map.of(_ref.read(resultsProvider(m))),
    };
    final localStreak = <ModeId, Streak>{
      for (final m in ModeId.values) m: _ref.read(streakProvider(m)),
    };
    final visibleBefore = <ModeId, int>{
      for (final m in ModeId.values)
        m: visibleCurrent(localStreak[m]!, today),
    };

    final server = await _api.getResults();
    final serverByKey = <String, ServerResult>{
      for (final r in server.results) '${r.mode.name}:${r.number}': r,
    };

    // ── Push: rows the server lacks, plus local rows whose captured
    //    history could upgrade an unverified server row. ──
    final toPush = <SubmitArgs>[];
    for (final m in ModeId.values) {
      localResults[m]!.forEach((n, r) {
        final sv = serverByKey['${m.name}:$n'];
        final couldUpgrade = sv != null &&
            !sv.verified &&
            !r.revealed &&
            (r.history?.isNotEmpty ?? false);
        if (sv == null || couldUpgrade) {
          toPush.add(
            SubmitArgs(
              number: n,
              mode: m,
              locale: locale,
              moves: r.moves,
              bonus: r.bonus,
              revealed: r.revealed,
              completedAt: r.completedAt,
              timeMs: r.timeMs,
              history: r.history,
            ),
          );
        }
      });
    }
    var pushed = 0;
    if (toPush.isNotEmpty) {
      final res = await _api.importResults(
        toPush,
        classicMax: localStreak[ModeId.classic]!.max,
        hardMax: localStreak[ModeId.hard]!.max,
      );
      pushed = res.imported;
    }

    // ── Pull + merge: the server row wins on (mode, num). ──
    var pulled = 0;
    for (final m in ModeId.values) {
      final rows = <int, StoredResult>{};
      for (final r in server.results.where((r) => r.mode == m)) {
        if (!localResults[m]!.containsKey(r.number)) pulled++;
        rows[r.number] = StoredResult(
          moves: r.moves,
          bonus: r.bonus,
          completedAt: r.completedAt,
          revealed: r.revealed,
          timeMs: r.timeMs,
          // Keep any locally-captured minSwaps for tier display.
          minSwaps: localResults[m]![r.number]?.minSwaps,
        );
      }
      _ref.read(resultsProvider(m).notifier).mergeServerRows(rows);
      // The server's streak.max already folds imported_max_streak_*.
      _ref.read(importedMaxProvider(m).notifier).state =
          server.streakFor(m).max;
    }

    // ── Streak-decrease detection (recomputed, not merged). ──
    StreakDecrease? decrease;
    for (final m in ModeId.values) {
      final after = _ref.read(streakProvider(m));
      final visibleAfter = visibleCurrent(after, today);
      if (visibleAfter < visibleBefore[m]!) {
        decrease = StreakDecrease(
          mode: m,
          previous: visibleBefore[m]!,
          current: visibleAfter,
          best: after.max,
          pushed: pushed,
          pulled: pulled,
        );
        break;
      }
    }

    final p = await SharedPreferences.getInstance();
    await p.setBool('$_guardPrefix$userId', true);

    return SyncOutcome(
      pushed: pushed,
      pulled: pulled,
      adsRemoved: server.adsRemoved,
      streakDecrease: decrease,
    );
  }

  /// Clear the once-per-user guard + offline queue (called on sign-out).
  Future<void> reset(String? userId) async {
    final p = await SharedPreferences.getInstance();
    await p.remove(_queueKey);
    if (userId != null) await p.remove('$_guardPrefix$userId');
  }

  Future<void> _enqueue(SubmitArgs a) async {
    final p = await SharedPreferences.getInstance();
    final q = p.getStringList(_queueKey) ?? <String>[];
    q.add(jsonEncode(a.toJson()));
    await p.setStringList(_queueKey, q);
  }

  SubmitArgs _argsFromJson(Map<String, dynamic> j) => SubmitArgs(
    number: (j['num'] as num).toInt(),
    mode: j['mode'] == 'hard' ? ModeId.hard : ModeId.classic,
    locale: j['locale'] as String? ?? 'en',
    moves: (j['moves'] as num).toInt(),
    bonus: j['bonus'] as bool? ?? false,
    revealed: j['revealed'] as bool? ?? false,
    completedAt: (j['completedAt'] as num?)?.toInt() ?? 0,
    timeMs: (j['timeMs'] as num?)?.toInt(),
    history: (j['history'] as List?)
        ?.map((p) => (p as List).map((n) => (n as num).toInt()).toList())
        .toList(),
  );
}
