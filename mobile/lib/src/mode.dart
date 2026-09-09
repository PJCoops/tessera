// Port of the mode config in app/lib/mode.ts. Everything that varies
// between the 4x4 daily (classic) and the 5x5 daily (hard) reads from
// here: grid size and the shared_preferences key prefixes for results,
// in-progress games and the streak. Keys match the web's localStorage
// names so a later sync slice lines up.

enum ModeId { classic, hard }

class Mode {
  const Mode({
    required this.id,
    required this.n,
    required this.resultPrefix,
    required this.progressPrefix,
    required this.streakKey,
  });

  final ModeId id;

  /// Grid side length (4 for classic, 5 for hard).
  final int n;

  final String resultPrefix;
  final String progressPrefix;
  final String streakKey;

  /// The API `mode` query value ("classic" | "hard").
  String get apiValue => id.name;

  Mode get other => id == ModeId.hard ? classicMode : hardMode;
}

const classicMode = Mode(
  id: ModeId.classic,
  n: 4,
  resultPrefix: 'tessera:result:',
  progressPrefix: 'tessera:progress:',
  streakKey: 'tessera:streak',
);

const hardMode = Mode(
  id: ModeId.hard,
  n: 5,
  resultPrefix: 'tessera:hard:result:',
  progressPrefix: 'tessera:hard:progress:',
  streakKey: 'tessera:hard:streak',
);

Mode modeById(ModeId id) => id == ModeId.hard ? hardMode : classicMode;
