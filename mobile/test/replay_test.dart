import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/chrome/replay_screen.dart';
import 'package:tessera/src/game/board_controller.dart';
import 'package:tessera/src/game/board_view.dart';
import 'package:tessera/src/game/puzzle.dart';
import 'package:tessera/src/game/puzzle_repository.dart';
import 'package:tessera/src/game/replay.dart';
import 'package:tessera/src/game/results.dart';
import 'package:tessera/src/mode.dart';
import 'package:tessera/src/theme/theme.dart';

import 'support/test_dict.dart';

const _body = {
  'num': 4,
  'goldRows': ['turf', 'anal', 'sire', 'stew'],
  'startTiles': [
    {'id': 13, 'letter': 'T'},
    {'id': 10, 'letter': 'R'},
    {'id': 4, 'letter': 'A'},
    {'id': 3, 'letter': 'F'},
    {'id': 2, 'letter': 'R'},
    {'id': 0, 'letter': 'T'},
    {'id': 6, 'letter': 'A'},
    {'id': 8, 'letter': 'S'},
    {'id': 5, 'letter': 'N'},
    {'id': 1, 'letter': 'U'},
    {'id': 12, 'letter': 'S'},
    {'id': 11, 'letter': 'E'},
    {'id': 7, 'letter': 'L'},
    {'id': 15, 'letter': 'W'},
    {'id': 14, 'letter': 'E'},
    {'id': 9, 'letter': 'I'},
  ],
  'minSwaps': 8,
};

class _FakeAdapter implements HttpClientAdapter {
  int calls = 0;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls++;
    return ResponseBody.fromString(
      jsonEncode(_body),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('forDate fetches then serves the per-day cache', () async {
    final adapter = _FakeAdapter();
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = adapter;
    final repo = PuzzleRepository(dio: dio);

    final p = await repo.forDate('2026-05-01');
    expect(p.num, 4);
    expect(adapter.calls, 1);

    await repo.forDate('2026-05-01');
    expect(adapter.calls, 1, reason: 'second call is cached');
  });

  testWidgets('replaying a puzzle never writes a result', (tester) async {
    final args = const ReplayArgs(
      date: '2026-05-01',
      modeId: ModeId.classic,
      locale: 'en',
    );
    // A board one swap from solved so the test can finish it.
    final almost = () {
      final base = Puzzle.sample();
      final tiles = [
        for (var i = 0; i < 16; i++)
          base.startTiles.firstWhere((t) => t.id == i),
      ];
      final t = tiles[0];
      tiles[0] = tiles[1];
      tiles[1] = t;
      return Puzzle(
        num: 4,
        goldRows: base.goldRows,
        minSwaps: 1,
        startTiles: tiles,
      );
    }();

    final rootContainer = ProviderContainer(
      overrides: [
        dictOverride(),
        replayPuzzleProvider(args).overrideWith((ref) async => almost),
      ],
    );
    addTearDown(rootContainer.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: rootContainer,
        child: MaterialApp(
          theme: buildTesseraTheme(brightness: Brightness.light),
          home: ReplayScreen(date: args.date, modeId: args.modeId),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(BoardView), findsOneWidget);
    expect(find.text('← Back to today'), findsOneWidget);

    // The board lives in a nested ProviderScope (isolated overrides).
    final nested = ProviderScope.containerOf(
      tester.element(find.byType(BoardView)),
      listen: false,
    );
    expect(nested.read(boardProvider).isSolved, isFalse);
    nested.read(boardProvider.notifier).tap(0);
    nested.read(boardProvider.notifier).tap(1);
    await tester.pumpAndSettle();
    expect(nested.read(boardProvider).isSolved, isTrue);

    // Solving a replay writes nothing to the real results store.
    expect(rootContainer.read(resultsProvider(ModeId.classic)), isEmpty);
  });
}
