// Port of app/lib/share.ts — share slug encode/decode, the emoji result
// grid (default + colour-blind), and the full share payload (headline +
// meta + grid + CTA). Fixture-locked against test/fixtures/parity.json.
//
// The colour-blind grid swaps the solved tile only (green -> blue); the
// bonus/orange and revealed/white tiles are unchanged (spec §17.2).

import 'i18n.dart';
import 'tier.dart';

const String solvedTile = '\u{1F7E9}'; // 🟩
const String colourBlindSolvedTile = '\u{1F7E6}'; // 🟦
const String bonusTile = '\u{1F7E7}'; // 🟧
const String revealedTile = '\u{2B1C}'; // ⬜

const Map<TierKey, String> tierEmoji = {
  TierKey.legendary: '\u{1F3C6}', // 🏆
  TierKey.genius: '\u{1F9E0}', // 🧠
  TierKey.wordsmith: '\u{1F4D6}', // 📖
  TierKey.persistent: '\u{1F9E9}', // 🧩
  TierKey.tenacious: '\u{1F4AA}', // 💪
};

class ShareSlug {
  const ShareSlug({
    required this.num,
    required this.moves,
    required this.bonus,
    required this.revealed,
    this.mode,
  });

  final int num;
  final int? moves;
  final bool bonus;
  final bool revealed;
  final String? mode; // "hard" or null

  @override
  bool operator ==(Object other) =>
      other is ShareSlug &&
      other.num == num &&
      other.moves == moves &&
      other.bonus == bonus &&
      other.revealed == revealed &&
      other.mode == mode;

  @override
  int get hashCode => Object.hash(num, moves, bonus, revealed, mode);
}

/// Encode a result into a short URL slug: "6-12", "6-12-b", "6-r";
/// hard mode gets an "h" prefix.
String buildShareSlug(ShareSlug s) {
  final prefix = s.mode == 'hard' ? 'h' : '';
  if (s.revealed) return '$prefix${s.num}-r';
  final flag = s.bonus ? '-b' : '';
  final moves = s.moves ?? 0;
  return '$prefix${s.num}-$moves$flag';
}

final _hardSlug = RegExp(r'^h(\d.*)$');
final _slugBody = RegExp(r'^\d+(?:-(?:r|\d+(?:-b)?))?$');

/// Inverse of [buildShareSlug]. Returns null on anything malformed.
ShareSlug? parseShareSlug(String slug) {
  final hardMatch = _hardSlug.firstMatch(slug);
  final isHard = hardMatch != null;
  final body = isHard ? hardMatch.group(1)! : slug;
  if (!_slugBody.hasMatch(body)) return null;
  final parts = body.split('-');
  final num = int.tryParse(parts[0]);
  if (num == null || num <= 0) return null;
  final mode = isHard ? 'hard' : null;
  if (parts.length == 1) {
    return ShareSlug(num: num, moves: null, bonus: false, revealed: false, mode: mode);
  }
  if (parts[1] == 'r') {
    return ShareSlug(num: num, moves: null, bonus: false, revealed: true, mode: mode);
  }
  final moves = int.tryParse(parts[1]);
  if (moves == null || moves < 0) return null;
  final bonus = parts.length > 2 && parts[2] == 'b';
  return ShareSlug(num: num, moves: moves, bonus: bonus, revealed: false, mode: mode);
}

/// N x N emoji grid encoding the result. Solved rows fill green; a bonus
/// solve flips the four corners to orange; a reveal is all-white.
String buildGrid({required bool revealed, required bool bonus, required int n}) {
  if (revealed) {
    return List.generate(n, (_) => revealedTile * n).join('\n');
  }
  if (!bonus) {
    return List.generate(n, (_) => solvedTile * n).join('\n');
  }
  final last = n - 1;
  bool isCorner(int r, int c) => (r == 0 || r == last) && (c == 0 || c == last);
  return List.generate(
    n,
    (r) => List.generate(n, (c) => isCorner(r, c) ? bonusTile : solvedTile).join(),
  ).join('\n');
}

/// The colour-blind text grid: green -> blue only (spec §17.2).
String toColourBlindGrid(String grid) => grid.replaceAll(solvedTile, colourBlindSolvedTile);

class ShareInput {
  const ShareInput({
    required this.puzzleNumber,
    required this.moves,
    required this.minSwaps,
    required this.streak,
    required this.locale,
    required this.dict,
    this.bonus = false,
    this.revealed = false,
    this.mode = 'classic',
  });

  final int puzzleNumber;
  final int moves;
  final int minSwaps;
  final int streak;
  final String locale;
  final Map<String, dynamic> dict;
  final bool bonus;
  final bool revealed;
  final String mode; // "classic" | "hard"
}

class SharePayload {
  const SharePayload({required this.text, required this.url, required this.full});
  final String text;
  final String url;
  final String full;
}

/// Full share payload: headline + optional meta + blank + grid, plus a CTA
/// on solved shares. `text` and `url` are separate because Web Share targets
/// disagree on which they read; `full` is the joined clipboard fallback.
SharePayload buildSharePayload(ShareInput input) {
  final isHard = input.mode == 'hard';
  final n = isHard ? 5 : 4;
  final tier = getTier(input.moves, input.minSwaps);
  final tierName = t(input.dict, 'tiers.${tier.key.name}');
  final emoji = tierEmoji[tier.key] ?? '';
  final swapWord =
      t(input.dict, input.moves == 1 ? 'game.swapSingular' : 'game.swapPlural');

  final headlineKey = isHard ? 'share.headlineSolvedHard' : 'share.headlineSolved';
  final revealedKey =
      isHard ? 'share.headlineRevealedHard' : 'share.headlineRevealed';
  final headline = input.revealed
      ? t(input.dict, revealedKey, {'num': input.puzzleNumber})
      : t(input.dict, headlineKey, {
          'num': input.puzzleNumber,
          'moves': input.moves,
          'swapWord': swapWord,
          'tierEmoji': emoji,
          'tier': tierName,
        }).trim();

  final meta = <String>[];
  if (!input.revealed && input.streak > 1) {
    meta.add(t(input.dict, 'share.streakMeta', {'streak': input.streak}));
  }
  if (!input.revealed && input.bonus) {
    meta.add(t(input.dict, 'share.bonusMeta'));
  }

  final slug = buildShareSlug(ShareSlug(
    num: input.puzzleNumber,
    moves: input.moves,
    bonus: input.bonus,
    revealed: input.revealed,
    mode: input.mode,
  ));
  final localePrefix = input.locale == 'en' ? '' : '/${input.locale}';
  final sharePath = isHard ? '/hard/s' : '/s';
  final url = 'https://tesserapuzzle.com$localePrefix$sharePath/$slug';

  final lines = <String>[headline];
  if (meta.isNotEmpty) lines.add(meta.join(' · ')); // " · "
  lines.add('');
  lines.add(buildGrid(revealed: input.revealed, bonus: input.bonus, n: n));
  if (!input.revealed) {
    lines.add('');
    lines.add(t(input.dict, 'share.challenge'));
  }
  final text = lines.join('\n');
  return SharePayload(text: text, url: url, full: '$text\n\n$url');
}
