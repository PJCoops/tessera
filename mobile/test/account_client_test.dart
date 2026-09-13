import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/auth/account_client.dart';
import 'package:tessera/src/auth/auth_controller.dart';
import 'package:tessera/src/mode.dart';

class _FakeBackend implements AuthBackend {
  _FakeBackend(this.accessToken);
  @override
  final String? accessToken;
  @override
  Stream<AuthUser?> authChanges() => Stream.value(null);
  @override
  AuthUser? get currentUser => null;
  @override
  int? get authTimeMs => null;
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Adapter implements HttpClientAdapter {
  _Adapter(this.responder);
  final ({int status, Object body}) Function(RequestOptions o) responder;
  RequestOptions? last;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    last = options;
    final r = responder(options);
    return ResponseBody.fromString(
      jsonEncode(r.body),
      r.status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

AccountClient _client(_Adapter adapter, {String? token = 'tok-123'}) {
  final dio = Dio(BaseOptions(baseUrl: 'https://x.test', validateStatus: (_) => true))
    ..httpClientAdapter = adapter;
  final container = ProviderContainer(
    overrides: [authBackendProvider.overrideWithValue(_FakeBackend(token))],
  );
  addTearDown(container.dispose);
  return container.read(Provider((ref) => AccountClient(ref, dio: dio)));
}

void main() {
  test('getResults parses rows + streaks and sends the bearer token', () async {
    final adapter = _Adapter(
      (o) => (
        status: 200,
        body: {
          'ok': true,
          'results': [
            {
              'num': 5,
              'mode': 'classic',
              'moves': 10,
              'bonus': false,
              'revealed': false,
              'verified': true,
              'timeMs': null,
              'completedAt': 111,
            },
            {
              'num': 9,
              'mode': 'hard',
              'moves': 14,
              'bonus': true,
              'revealed': false,
              'verified': false,
              'timeMs': 4200,
              'completedAt': 222,
            },
          ],
          'streaks': {
            'classic': {'current': 2, 'max': 5, 'lastWon': 5},
            'hard': {'current': 1, 'max': 1, 'lastWon': 9},
          },
        },
      ),
    );
    final res = await _client(adapter).getResults();

    expect(adapter.last!.headers['authorization'], 'Bearer tok-123');
    expect(res.results, hasLength(2));
    expect(res.results[1].mode, ModeId.hard);
    expect(res.results[1].timeMs, 4200);
    expect(res.classicStreak.max, 5);
    expect(res.streakFor(ModeId.hard).lastWon, 9);
  });

  test('submitResult returns the server verdict', () async {
    final adapter = _Adapter((o) => (status: 200, body: {'ok': true, 'verified': true}));
    final verified = await _client(adapter).submitResult(
      const SubmitArgs(
        number: 7,
        mode: ModeId.classic,
        locale: 'en',
        moves: 12,
        bonus: false,
        completedAt: 999,
      ),
    );
    expect(verified, isTrue);
    expect((adapter.last!.data as Map<String, dynamic>)['num'], 7);
  });

  test('importResults posts results + streak maxima', () async {
    final adapter = _Adapter(
      (o) => (status: 200, body: {'ok': true, 'imported': 3, 'verified': 1}),
    );
    final r = await _client(adapter).importResults(
      [
        const SubmitArgs(
          number: 1,
          mode: ModeId.classic,
          locale: 'en',
          moves: 8,
          bonus: false,
          completedAt: 1,
        ),
      ],
      classicMax: 6,
      hardMax: 3,
    );
    expect(r.imported, 3);
    final body = adapter.last!.data as Map<String, dynamic>;
    expect((body['results'] as List), hasLength(1));
    expect(body['streaks']['classic']['max'], 6);
  });

  test('deleteAccount maps the grace-state response', () async {
    final adapter = _Adapter(
      (o) => (
        status: 200,
        body: {
          'ok': true,
          'status': 'pending_deletion',
          'permanentAt': '2026-09-11T09:00:00.000Z',
          'alreadyPending': false,
        },
      ),
    );
    final r = await _client(adapter).deleteAccount();
    expect(r.alreadyPending, isFalse);
    expect(r.permanentAt.toUtc().day, 11);
  });

  test('deleteAccount throws ReauthRequired on a stale token', () async {
    final adapter = _Adapter(
      (o) => (status: 401, body: {'ok': false, 'reason': 'reauth_required'}),
    );
    expect(_client(adapter).deleteAccount(), throwsA(isA<ReauthRequired>()));
  });

  test('an {ok:false} body becomes an AccountApiException', () async {
    final adapter = _Adapter(
      (o) => (status: 429, body: {'ok': false, 'reason': 'rate_limited'}),
    );
    expect(
      _client(adapter).getResults(),
      throwsA(
        isA<AccountApiException>().having((e) => e.reason, 'reason', 'rate_limited'),
      ),
    );
  });

  test('registerDeviceToken posts the platform, token and tz offset', () async {
    final adapter = _Adapter((o) => (status: 200, body: {'ok': true}));
    await _client(adapter).registerDeviceToken(
      platform: 'ios',
      token: 'abc123',
      tzOffsetMinutes: -60,
    );
    final body = adapter.last!.data as Map<String, dynamic>;
    expect(body, {'platform': 'ios', 'token': 'abc123', 'tzOffset': -60});
  });

  test('deregisterDeviceToken posts the token', () async {
    final adapter = _Adapter((o) => (status: 200, body: {'ok': true}));
    await _client(adapter).deregisterDeviceToken('abc123');
    final body = adapter.last!.data as Map<String, dynamic>;
    expect(body, {'token': 'abc123'});
  });
}
