/// Today's date as YYYY-MM-DD in UTC. The puzzle rolls over at 00:00 UTC
/// everywhere (spec §5); the client never derives the puzzle number from a
/// local-timezone clock. Port of `todayUtc` in app/lib/rng.ts.
String todayUtcDate([DateTime? now]) {
  final d = (now ?? DateTime.now()).toUtc();
  final mm = d.month.toString().padLeft(2, '0');
  final dd = d.day.toString().padLeft(2, '0');
  return '${d.year}-$mm-$dd';
}
