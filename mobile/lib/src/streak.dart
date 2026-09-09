// Port of app/lib/streak-compute.ts. A streak is a run of consecutive
// puzzle numbers; callers pass won puzzle numbers only (revealed results
// are not wins). Fixture-locked against test/fixtures/parity.json.

class Streak {
  const Streak({
    required this.current,
    required this.max,
    required this.lastWon,
  });

  final int current;
  final int max;
  final int lastWon;

  @override
  bool operator ==(Object other) =>
      other is Streak &&
      other.current == current &&
      other.max == max &&
      other.lastWon == lastWon;

  @override
  int get hashCode => Object.hash(current, max, lastWon);

  @override
  String toString() =>
      'Streak(current: $current, max: $max, lastWon: $lastWon)';
}

/// Derives a streak from won puzzle numbers.
Streak computeStreak(List<int> nums, [int importedMax = 0]) {
  final uniq = nums.toSet().toList()..sort();
  var max = 0;
  var run = 0;
  int? prev;
  for (final n in uniq) {
    run = (prev != null && n == prev + 1) ? run + 1 : 1;
    if (run > max) max = run;
    prev = n;
  }
  if (uniq.isEmpty) {
    return Streak(current: 0, max: importedMax, lastWon: 0);
  }
  return Streak(
    current: run,
    max: max > importedMax ? max : importedMax,
    lastWon: uniq.last,
  );
}

/// A streak is "live" only if its last win was today or yesterday;
/// otherwise the visible current count is 0. Port of `visibleCurrent`
/// in app/lib/streak.ts. [today] is today's puzzle number.
int visibleCurrent(Streak s, int today) {
  if (s.lastWon == today || s.lastWon == today - 1) return s.current;
  return 0;
}

/// Merge a local and a server streak: the fresher lastWon decides `current`,
/// maxima combine.
Streak mergeStreaks(Streak a, Streak b) {
  final fresher = a.lastWon >= b.lastWon ? a : b;
  return Streak(
    current: fresher.current,
    max: a.max > b.max ? a.max : b.max,
    lastWon: fresher.lastWon,
  );
}
