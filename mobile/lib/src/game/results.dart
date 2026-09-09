import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../mode.dart';
import '../streak.dart';

/// A stored daily result, keyed by puzzle number under
/// `<mode.resultPrefix><num>` in shared_preferences. Mirrors the web's
/// `StoredResult` (app/lib/results-local.ts); `history`/`timeMs` arrive
/// with accounts sync in a later phase, so stay off this shape for now.
class StoredResult {
  const StoredResult({
    required this.moves,
    required this.bonus,
    required this.completedAt,
    this.revealed = false,
    this.minSwaps,
  });

  final int moves;
  final bool bonus;

  /// Epoch millis when the puzzle was solved/revealed.
  final int completedAt;
  final bool revealed;

  /// The puzzle's exact optimum, captured at solve time so history/tier
  /// views don't need the generator. Absent on very old entries.
  final int? minSwaps;

  Map<String, dynamic> toJson() => {
    'moves': moves,
    'bonus': bonus,
    'completedAt': completedAt,
    if (revealed) 'revealed': true,
    if (minSwaps != null) 'minSwaps': minSwaps,
  };

  factory StoredResult.fromJson(Map<String, dynamic> j) => StoredResult(
    moves: (j['moves'] as num?)?.toInt() ?? 0,
    bonus: j['bonus'] as bool? ?? false,
    completedAt: (j['completedAt'] as num?)?.toInt() ?? 0,
    revealed: j['revealed'] as bool? ?? false,
    minSwaps: (j['minSwaps'] as num?)?.toInt(),
  );
}

/// All stored results for a mode, keyed by puzzle number. Hydrates from
/// shared_preferences on first read (defaults to empty), like
/// [SettingsController].
final resultsProvider =
    NotifierProvider.family<ResultsController, Map<int, StoredResult>, ModeId>(
      ResultsController.new,
    );

class ResultsController
    extends FamilyNotifier<Map<int, StoredResult>, ModeId> {
  late String _prefix;

  @override
  Map<int, StoredResult> build(ModeId arg) {
    _prefix = modeById(arg).resultPrefix;
    _load();
    return const {};
  }

  Future<void> _load() async {
    final p = await SharedPreferences.getInstance();
    final out = <int, StoredResult>{};
    for (final key in p.getKeys()) {
      if (!key.startsWith(_prefix)) continue;
      final num = int.tryParse(key.substring(_prefix.length));
      if (num == null) continue;
      final raw = p.getString(key);
      if (raw == null) continue;
      try {
        out[num] = StoredResult.fromJson(
          jsonDecode(raw) as Map<String, dynamic>,
        );
      } catch (_) {
        // A corrupt entry is skipped rather than breaking history.
      }
    }
    state = out;
  }

  /// Record (or overwrite) the result for [num] and persist it.
  void record(int num, StoredResult result) {
    state = {...state, num: result};
    SharedPreferences.getInstance().then(
      (p) => p.setString('$_prefix$num', jsonEncode(result.toJson())),
    );
  }
}

/// Won puzzle numbers for a mode (revealed results don't count), sorted.
final wonNumbersProvider = Provider.family<List<int>, ModeId>((ref, mode) {
  final results = ref.watch(resultsProvider(mode));
  final nums = [
    for (final e in results.entries)
      if (!e.value.revealed) e.key,
  ]..sort();
  return nums;
});

/// Streak for a mode, derived from stored wins via [computeStreak].
final streakProvider = Provider.family<Streak, ModeId>((ref, mode) {
  return computeStreak(ref.watch(wonNumbersProvider(mode)));
});
