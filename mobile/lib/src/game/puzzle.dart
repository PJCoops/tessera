import 'board.dart';

/// A day's puzzle as served by GET /api/v1/puzzle. Phase 2 seeds the board
/// from [Puzzle.sample]; the live fetch + per-day cache lands in a
/// follow-up slice (spec §7).
class Puzzle {
  const Puzzle({
    required this.num,
    required this.goldRows,
    required this.startTiles,
    required this.minSwaps,
  });

  final int num;
  final List<String> goldRows;
  final List<Tile> startTiles;
  final int minSwaps;

  factory Puzzle.fromJson(Map<String, dynamic> json) {
    return Puzzle(
      num: json['num'] as int,
      goldRows: (json['goldRows'] as List).cast<String>(),
      startTiles: [
        for (final t in (json['startTiles'] as List))
          Tile(t['id'] as int, t['letter'] as String),
      ],
      minSwaps: json['minSwaps'] as int,
    );
  }

  /// Puzzle #7 (en, classic) from the parity fixture — a real generated
  /// grid, used as the dev placeholder until the endpoint is wired.
  factory Puzzle.sample() => Puzzle(
    num: 7,
    goldRows: const ['turf', 'anal', 'sire', 'stew'],
    minSwaps: 8,
    startTiles: const [
      Tile(13, 'T'),
      Tile(10, 'R'),
      Tile(4, 'A'),
      Tile(3, 'F'),
      Tile(2, 'R'),
      Tile(0, 'T'),
      Tile(6, 'A'),
      Tile(8, 'S'),
      Tile(5, 'N'),
      Tile(1, 'U'),
      Tile(12, 'S'),
      Tile(11, 'E'),
      Tile(7, 'L'),
      Tile(15, 'W'),
      Tile(14, 'E'),
      Tile(9, 'I'),
    ],
  );

  BoardState toBoardState() => BoardState.start(
    goldRows: goldRows,
    startTiles: startTiles,
    minSwaps: minSwaps,
  );
}
