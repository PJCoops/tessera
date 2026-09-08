import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/game/puzzle_repository.dart';

const _sampleBody = {
  'num': 7,
  'goldRows': ['turf', 'anal', 'sire', 'stew'],
  'startLetters': 'TRAFRTASNUSELWEI',
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

/// Canned adapter: counts requests and replies with [status] / [body].
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter({this.status = 200, this.body});
  int calls = 0;
  int status;
  Object? body;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? _,
    Future<void>? _,
  ) async {
    calls++;
    return ResponseBody.fromString(
      jsonEncode(body ?? _sampleBody),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

PuzzleRepository _repo(_FakeAdapter adapter) {
  final dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
    ..httpClientAdapter = adapter;
  return PuzzleRepository(dio: dio);
}

void main() {
  final now = DateTime.utc(2026, 5, 3);

  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('fetches and caches on a cache miss', () async {
    final adapter = _FakeAdapter();
    final repo = _repo(adapter);

    final p = await repo.daily(now: now);
    expect(p.num, 7);
    expect(adapter.calls, 1);

    // Second call for the same day is served from the cache.
    final again = await _repo(adapter).daily(now: now);
    expect(again.num, 7);
    expect(adapter.calls, 1, reason: 'no second network request');
  });

  test('a 4xx throws PuzzleUnavailable without retrying', () async {
    final adapter = _FakeAdapter(status: 404, body: {'error': 'before_epoch'});
    final repo = _repo(adapter);

    await expectLater(repo.daily(now: now), throwsA(isA<PuzzleUnavailable>()));
    expect(adapter.calls, 1);
  });

  test('a 5xx is retried once', () async {
    final adapter = _FakeAdapter(status: 503);
    final repo = _repo(adapter);

    await expectLater(repo.daily(now: now), throwsA(isA<PuzzleUnavailable>()));
    expect(adapter.calls, 2);
  });

  test('devFallback returns the bundled sample instead of throwing', () async {
    final adapter = _FakeAdapter(status: 503);
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = adapter;
    final repo = PuzzleRepository(dio: dio, devFallback: true);

    final p = await repo.daily(now: now);
    expect(p.num, 7);
  });
}
