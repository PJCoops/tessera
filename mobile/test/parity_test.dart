// Locks the Dart ports against test/fixtures/parity.json — the same
// snapshot the web side asserts (app/lib/mobile-parity.test.ts). Any
// divergence in slug, grid, puzzle-number or streak math fails here.
// Regenerate the fixture web-side with `npm run gen:parity`.

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/puzzle_number.dart';
import 'package:tessera/src/share.dart';
import 'package:tessera/src/streak.dart';

Map<String, dynamic> _json(String path) =>
    jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

void main() {
  final fixture = _json('test/fixtures/parity.json');
  final epoch = fixture['meta']['epoch'] as String;
  final dicts = {
    'en': _json('assets/locales/en.json'),
    'es': _json('assets/locales/es.json'),
  };

  test('meta.epoch matches the vendored EPOCH', () {
    expect(epoch, '2026-04-27');
  });

  group('puzzle number arithmetic', () {
    for (final row in (fixture['puzzleNumber'] as List)) {
      final num = row['num'] as int;
      final date = row['date'] as String;
      test('#$num <-> $date', () {
        expect(dateFromPuzzleNumber(num, epoch), date);
        expect(puzzleNumber(date, epoch), num);
        expect(row['roundTrips'], true);
      });
    }
  });

  group('share slugs', () {
    for (final row in (fixture['shareSlugs'] as List)) {
      final input = row['input'] as Map<String, dynamic>;
      final slug = row['slug'] as String;
      test('$input -> $slug', () {
        final built = buildShareSlug(
          ShareSlug(
            num: input['num'] as int,
            moves: input['moves'] as int?,
            bonus: input['bonus'] as bool,
            revealed: input['revealed'] as bool,
            mode: input['mode'] as String?,
          ),
        );
        expect(built, slug);

        final parsed = parseShareSlug(slug)!;
        final expected = row['parsed'] as Map<String, dynamic>;
        expect(parsed.num, expected['num']);
        expect(parsed.moves, expected['moves']);
        expect(parsed.bonus, expected['bonus']);
        expect(parsed.revealed, expected['revealed']);
        expect(parsed.mode, expected['mode']);
      });
    }
  });

  group('share grids (default + colour-blind)', () {
    for (final row in (fixture['shareGrids'] as List)) {
      final input = row['input'] as Map<String, dynamic>;
      test('$input', () {
        final grid = buildGrid(
          revealed: input['revealed'] as bool,
          bonus: input['bonus'] as bool,
          n: input['N'] as int,
        );
        expect(grid, row['default']);
        expect(toColourBlindGrid(grid), row['colourBlind']);
      });
    }
  });

  group('share payloads', () {
    for (final row in (fixture['sharePayloads'] as List)) {
      final input = row['input'] as Map<String, dynamic>;
      final locale = input['locale'] as String;
      test('#${input['puzzleNumber']} ${input['mode']} $locale '
          'moves=${input['moves']} revealed=${input['revealed']}', () {
        final payload = buildSharePayload(
          ShareInput(
            puzzleNumber: input['puzzleNumber'] as int,
            moves: input['moves'] as int,
            minSwaps: input['minSwaps'] as int,
            streak: input['streak'] as int,
            bonus: input['bonus'] as bool,
            revealed: input['revealed'] as bool,
            locale: locale,
            mode: input['mode'] as String,
            dict: dicts[locale]!,
          ),
        );
        expect(payload.text, row['text']);
        expect(payload.url, row['url']);
        expect(payload.full, row['full']);
      });
    }
  });

  group('streak math', () {
    for (final row in (fixture['streaks'] as List)) {
      final nums = (row['nums'] as List).cast<int>();
      final importedMax = row['importedMax'] as int;
      final want = row['result'] as Map<String, dynamic>;
      test('$nums importedMax=$importedMax', () {
        final s = computeStreak(nums, importedMax);
        expect(s.current, want['current']);
        expect(s.max, want['max']);
        expect(s.lastWon, want['lastWon']);
      });
    }
  });
}
