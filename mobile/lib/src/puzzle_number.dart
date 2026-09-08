// Port of the puzzle-number arithmetic in app/lib/rng.ts (puzzleNumber /
// dateFromPuzzleNumber), off EPOCH. The client recomputes streak from
// locally-known results for offline display; puzzle numbers are derived
// here, never from the device clock's timezone (spec §5). Fixture-locked
// against test/fixtures/parity.json.

int _utcMillis(String ymd) {
  final y = int.parse(ymd.substring(0, 4));
  final m = int.parse(ymd.substring(5, 7));
  final d = int.parse(ymd.substring(8, 10));
  return DateTime.utc(y, m, d).millisecondsSinceEpoch;
}

const int _dayMs = 86400000;

/// Days since [epoch] (inclusive). Epoch is day 1. Matches
/// `Math.floor((t - e) / 86400000) + 1` including negative (pre-epoch).
int puzzleNumber(String today, String epoch) {
  final diff = _utcMillis(today) - _utcMillis(epoch);
  return (diff / _dayMs).floor() + 1;
}

/// Inverse of [puzzleNumber]: the YYYY-MM-DD UTC date for a puzzle number.
String dateFromPuzzleNumber(int num, String epoch) {
  final ms = _utcMillis(epoch) + (num - 1) * _dayMs;
  final d = DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true);
  final mm = d.month.toString().padLeft(2, '0');
  final dd = d.day.toString().padLeft(2, '0');
  return '${d.year}-$mm-$dd';
}
