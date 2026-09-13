import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/auth/account_client.dart';
import 'package:tessera/src/auth/auth_controller.dart';
import 'package:tessera/src/clock.dart';
import 'package:tessera/src/epoch.dart';
import 'package:tessera/src/game/results.dart';
import 'package:tessera/src/mode.dart';
import 'package:tessera/src/puzzle_number.dart';
import 'package:tessera/src/streak.dart';
import 'package:tessera/src/sync/sync_providers.dart';

final _today = puzzleNumber(todayUtcDate(), kEpoch);

class _FakeApi implements AccountApi {
  _FakeApi(this._get);
  final GetResultsResponse Function() _get;

  final List<SubmitArgs> imported = [];
  int? importClassicMax;
  int submitCalls = 0;
  bool submitFails = false;

  @override
  Future<GetResultsResponse> getResults() async => _get();

  @override
  Future<bool> submitResult(SubmitArgs a) async {
    submitCalls++;
    if (submitFails) throw AccountApiException('boom');
    return true;
  }

  @override
  Future<ImportResult> importResults(
    List<SubmitArgs> results, {
    int classicMax = 0,
    int hardMax = 0,
  }) async {
    imported.addAll(results);
    importClassicMax = classicMax;
    return ImportResult(imported: results.length, verified: 0);
  }

  @override
  Future<AccountDeleteResult> deleteAccount() => throw UnimplementedError();
  @override
  Future<bool> restoreAccount() => throw UnimplementedError();
  @override
  Future<AppConfigResponse> appConfig() => throw UnimplementedError();
  @override
  Future<void> registerDeviceToken({
    required String platform,
    required String token,
    required int tzOffsetMinutes,
  }) => throw UnimplementedError();
  @override
  Future<void> deregisterDeviceToken(String token) =>
      throw UnimplementedError();
}

GetResultsResponse _resp(
  List<ServerResult> rows, {
  Streak? classic,
  Streak? hard,
  bool adsRemoved = false,
}) => GetResultsResponse(
  results: rows,
  classicStreak: classic ?? const Streak(current: 0, max: 0, lastWon: 0),
  hardStreak: hard ?? const Streak(current: 0, max: 0, lastWon: 0),
  adsRemoved: adsRemoved,
);

ServerResult _sr(
  int n, {
  int moves = 10,
  bool revealed = false,
  bool verified = true,
  ModeId mode = ModeId.classic,
}) => ServerResult(
  number: n,
  mode: mode,
  moves: moves,
  bonus: false,
  revealed: revealed,
  verified: verified,
  completedAt: 1000 + n,
);

String _localResult(int moves, {bool revealed = false}) =>
    '{"moves":$moves,"bonus":false,"completedAt":1,"minSwaps":6'
    '${revealed ? ',"revealed":true' : ''}}';

Future<void> _settle() async {
  for (var i = 0; i < 5; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

ProviderContainer _container(_FakeApi api, Map<String, Object> prefs) {
  SharedPreferences.setMockInitialValues(prefs);
  final c = ProviderContainer(
    overrides: [accountClientProvider.overrideWithValue(api)],
  );
  addTearDown(c.dispose);
  return c;
}

void main() {
  test(
    'merges local-only, server-only and conflicting rows; server wins',
    () async {
      final api = _FakeApi(
        () => _resp([
          _sr(6, moves: 99), // conflict — server's moves win
          _sr(7, moves: 8), // server-only
        ], classic: Streak(current: 3, max: 5, lastWon: 7)),
      );
      final c = _container(api, {
        'tessera:result:5': _localResult(10),
        'tessera:result:6': _localResult(12),
      });
      c.read(resultsProvider(ModeId.classic)); // hydrate
      await _settle();

      final out = await c.read(syncEngineProvider).syncOnSignIn('u1');
      await _settle();

      final merged = c.read(resultsProvider(ModeId.classic));
      expect(merged.keys.toSet(), {5, 6, 7});
      expect(merged[6]!.moves, 99, reason: 'server row wins on conflict');
      expect(merged[5]!.moves, 10, reason: 'local-only row kept');
      // Local-only row #5 was pushed; the verified server #6 was not.
      expect(api.imported.map((a) => a.number), [5]);
      expect(api.importClassicMax, isNotNull);
      expect(out.pulled, 1); // #7
      expect(c.read(streakProvider(ModeId.classic)).current, 3);
    },
  );

  test('imported_max flows into the recomputed streak', () async {
    final api = _FakeApi(
      () => _resp([
        _sr(_today),
      ], classic: Streak(current: 1, max: 9, lastWon: _today)),
    );
    final c = _container(api, {'tessera:result:$_today': _localResult(10)});
    c.read(resultsProvider(ModeId.classic));
    await _settle();

    await c.read(syncEngineProvider).syncOnSignIn('u1');
    await _settle();

    expect(c.read(streakProvider(ModeId.classic)).max, 9);
  });

  test(
    'a server reveal that overrides a local win triggers streak-decrease',
    () async {
      final api = _FakeApi(
        () => _resp(
          [_sr(_today, revealed: true)], // server says today was revealed
          classic: Streak(current: 1, max: 4, lastWon: _today - 1),
        ),
      );
      final c = _container(api, {
        'tessera:result:${_today - 1}': _localResult(10),
        'tessera:result:$_today': _localResult(12), // local counted it a win
      });
      c.read(resultsProvider(ModeId.classic));
      await _settle();
      expect(
        visibleCurrent(c.read(streakProvider(ModeId.classic)), _today),
        2,
        reason: 'before sync the player sees a 2-day streak',
      );

      final out = await c.read(syncEngineProvider).syncOnSignIn('u1');
      await _settle();

      expect(c.read(resultsProvider(ModeId.classic))[_today]!.revealed, isTrue);
      expect(out.streakDecrease, isNotNull);
      expect(out.streakDecrease!.previous, 2);
      expect(out.streakDecrease!.current, 1);
      expect(out.streakDecrease!.best, 4);
    },
  );

  test('failed submits queue and drain on the next flush', () async {
    final api = _FakeApi(() => _resp([]));
    final c = _container(api, {});
    final engine = c.read(syncEngineProvider);

    api.submitFails = true;
    await engine.submitOne(
      const SubmitArgs(
        number: 42,
        mode: ModeId.classic,
        locale: 'en',
        moves: 9,
        bonus: false,
        completedAt: 1,
      ),
    );
    var p = await SharedPreferences.getInstance();
    expect(p.getStringList('tessera:sync-queue'), hasLength(1));

    api.submitFails = false;
    await engine.flushQueue();
    p = await SharedPreferences.getInstance();
    expect(p.getStringList('tessera:sync-queue'), isEmpty);
    expect(api.submitCalls, 2);
  });

  test(
    'syncOnSignIn surfaces the account-level ads-removed entitlement',
    () async {
      final api = _FakeApi(() => _resp([], adsRemoved: true));
      final c = _container(api, {});

      final out = await c.read(syncEngineProvider).syncOnSignIn('u1');

      expect(out.adsRemoved, isTrue);
    },
  );

  test(
    'adsRemovedProvider is set from the sync pull, then cleared on sign-out',
    () async {
      SharedPreferences.setMockInitialValues({});
      final api = _FakeApi(() => _resp([], adsRemoved: true));
      final auth = _MutableAuth(const AuthUser(id: 'u1', email: 'a@b.com'));
      final c = ProviderContainer(
        overrides: [
          accountClientProvider.overrideWithValue(api),
          authBackendProvider.overrideWithValue(auth),
        ],
      );
      addTearDown(c.dispose);

      c.listen(accountSyncProvider, (_, _) {}, fireImmediately: true);
      await _settle();

      expect(c.read(adsRemovedProvider), isTrue);

      auth.emit(null); // sign out
      await _settle();

      expect(c.read(adsRemovedProvider), isFalse);
    },
  );

  test(
    'signing out clears the per-user guard so the next sign-in re-syncs',
    () async {
      final api = _FakeApi(() => _resp([]));
      SharedPreferences.setMockInitialValues({'tessera:synced:u1': true});
      final auth = _MutableAuth(const AuthUser(id: 'u1', email: 'a@b.com'));
      final c = ProviderContainer(
        overrides: [
          accountClientProvider.overrideWithValue(api),
          authBackendProvider.overrideWithValue(auth),
        ],
      );
      addTearDown(c.dispose);

      c.listen(accountSyncProvider, (_, _) {}, fireImmediately: true);
      await _settle();

      auth.emit(null); // sign out
      await _settle();

      final p = await SharedPreferences.getInstance();
      expect(
        p.getBool('tessera:synced:u1'),
        isNull,
        reason: 'reset() must clear the guard on sign-out',
      );
      expect(await c.read(syncEngineProvider).alreadySynced('u1'), isFalse);
    },
  );
}

class _MutableAuth implements AuthBackend {
  _MutableAuth(this._user);
  AuthUser? _user;
  final _ctrl = StreamController<AuthUser?>.broadcast();

  void emit(AuthUser? u) {
    _user = u;
    _ctrl.add(u);
  }

  @override
  Stream<AuthUser?> authChanges() async* {
    yield _user;
    yield* _ctrl.stream;
  }

  @override
  AuthUser? get currentUser => _user;
  @override
  String? get accessToken => _user == null ? null : 'tok';
  @override
  int? get authTimeMs => null;
  @override
  Future<void> sendOtp(String email) async {}
  @override
  Future<void> verifyOtp(String email, String token) async {}
  @override
  Future<void> signInWithApple() async {}
  @override
  Future<void> signInWithGoogle() async {}
  @override
  Future<void> signOut() async => emit(null);
}
