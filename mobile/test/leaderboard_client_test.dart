import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/auth/auth_controller.dart';
import 'package:tessera/src/leaderboard/leaderboard_client.dart';
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

LeaderboardClient _client(_Adapter adapter) {
  final dio = Dio(BaseOptions(baseUrl: 'https://x.test', validateStatus: (_) => true))
    ..httpClientAdapter = adapter;
  final container = ProviderContainer(
    overrides: [authBackendProvider.overrideWithValue(_FakeBackend('tok-123'))],
  );
  addTearDown(container.dispose);
  return container.read(Provider((ref) => LeaderboardClient(ref, dio: dio)));
}

void main() {
  test('getLeaderboard sends mode/num query params + bearer token and parses the response', () async {
    final adapter = _Adapter(
      (o) => (
        status: 200,
        body: {
          'ok': true,
          'global': [
            {'rank': 1, 'handle': 'Jem', 'moves': 9, 'timeMs': 22896, 'isMe': false},
          ],
          'country': {
            'code': 'GB',
            'entries': [
              {'rank': 1, 'handle': 'Jem', 'moves': 9, 'timeMs': 22896, 'isMe': false},
            ],
          },
          'me': {'global': null, 'country': null},
          'hasHandle': true,
          'signedIn': true,
        },
      ),
    );
    final client = _client(adapter);
    final res = await client.getLeaderboard(ModeId.hard, 137);

    expect(adapter.last!.path, '/api/v1/leaderboard');
    expect(adapter.last!.queryParameters, {'mode': 'hard', 'num': 137});
    expect(adapter.last!.headers['authorization'], 'Bearer tok-123');
    expect(res.global.single.handle, 'Jem');
    expect(res.country.code, 'GB');
    expect(res.hasHandle, isTrue);
    expect(res.signedIn, isTrue);
  });

  test('myLeagues parses the list', () async {
    final adapter = _Adapter(
      (o) => (
        status: 200,
        body: {
          'ok': true,
          'leagues': [
            {'id': 'l1', 'name': 'Family', 'inviteCode': 'ABC12345', 'memberCount': 3},
          ],
        },
      ),
    );
    final leagues = await _client(adapter).myLeagues();
    expect(leagues.single.name, 'Family');
    expect(leagues.single.memberCount, 3);
  });

  test('createLeague posts the name and returns the new league', () async {
    final adapter = _Adapter(
      (o) => (
        status: 200,
        body: {
          'ok': true,
          'league': {'id': 'l1', 'name': 'Family', 'inviteCode': 'ABC12345'},
        },
      ),
    );
    final client = _client(adapter);
    final league = await client.createLeague('Family');
    expect(adapter.last!.method, 'POST');
    expect(adapter.last!.path, '/api/v1/leagues');
    expect(league.inviteCode, 'ABC12345');
  });

  test('joinLeague posts the code', () async {
    final adapter = _Adapter(
      (o) => (
        status: 200,
        body: {
          'ok': true,
          'league': {'id': 'l1', 'name': 'Family'},
        },
      ),
    );
    final client = _client(adapter);
    final league = await client.joinLeague('abc12345');
    expect(adapter.last!.path, '/api/v1/leagues/join');
    expect((adapter.last!.data as Map)['code'], 'abc12345');
    expect(league.name, 'Family');
  });

  test('leagueStandings requests /api/v1/leagues/:id with mode/num', () async {
    final adapter = _Adapter(
      (o) => (
        status: 200,
        body: {
          'ok': true,
          'league': {'id': 'l1', 'name': 'Family', 'inviteCode': 'X'},
          'board': [
            {'rank': 1, 'handle': 'Jem', 'moves': 9, 'timeMs': null, 'isMe': true},
          ],
          'tally': [
            {'handle': 'Jem', 'daysWon': 3, 'isMe': true},
          ],
          'hasHandle': true,
        },
      ),
    );
    final standings = await _client(adapter).leagueStandings('l1', ModeId.classic, 5);
    expect(adapter.last!.path, '/api/v1/leagues/l1');
    expect(adapter.last!.queryParameters, {'mode': 'classic', 'num': 5});
    expect(standings.league.name, 'Family');
    expect(standings.board.single.isMe, isTrue);
    expect(standings.tally.single.daysWon, 3);
  });

  test('reportScore posts mode/num/handle and throws on {ok:false}', () async {
    final adapter = _Adapter((o) => (status: 200, body: {'ok': true}));
    final client = _client(adapter);
    await client.reportScore(ModeId.hard, 5, 'Alice');
    expect((adapter.last!.data as Map)['handle'], 'Alice');

    final failing = _client(_Adapter((o) => (status: 404, body: {'ok': false, 'reason': 'not_found'})));
    await expectLater(
      failing.reportScore(ModeId.classic, 5, 'Nobody'),
      throwsA(isA<Exception>()),
    );
  });
}
