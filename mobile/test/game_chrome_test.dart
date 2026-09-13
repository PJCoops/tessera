import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/auth/account_client.dart';
import 'package:tessera/src/auth/auth_controller.dart';
import 'package:tessera/src/chrome/legend.dart';
import 'package:tessera/src/game/board_controller.dart';
import 'package:tessera/src/game/game_screen.dart';
import 'package:tessera/src/game/puzzle.dart';
import 'package:tessera/src/streak.dart';
import 'package:tessera/src/theme/theme.dart';

import 'support/test_dict.dart';

Puzzle _oneFromSolved() {
  final p = Puzzle.sample();
  final home = [
    for (var i = 0; i < 16; i++) p.startTiles.firstWhere((t) => t.id == i),
  ];
  final t = home[0];
  home[0] = home[1];
  home[1] = t;
  return Puzzle(num: p.num, goldRows: p.goldRows, minSwaps: 1, startTiles: home);
}

Widget _harness({List<Override> extra = const []}) => ProviderScope(
  overrides: [
    puzzleProvider.overrideWith((ref) => _oneFromSolved()),
    dictOverride(),
    ...extra,
  ],
  child: MaterialApp(
    theme: buildTesseraTheme(brightness: Brightness.light),
    home: const GameScreen(),
  ),
);

class _SignedInBackend implements AuthBackend {
  @override
  Stream<AuthUser?> authChanges() =>
      Stream.value(const AuthUser(id: 'u1', email: 'a@b.com'));
  @override
  AuthUser? get currentUser => const AuthUser(id: 'u1', email: 'a@b.com');
  @override
  String? get accessToken => 'tok';
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
  Future<void> signOut() async {}
}

class _RecordingApi implements AccountApi {
  int submitCalls = 0;
  final List<SubmitArgs> submitted = [];

  @override
  Future<bool> submitResult(SubmitArgs a) async {
    submitCalls++;
    submitted.add(a);
    return true;
  }

  @override
  Future<GetResultsResponse> getResults() async => GetResultsResponse(
    results: const [],
    classicStreak: const Streak(current: 0, max: 0, lastWon: 0),
    hardStreak: const Streak(current: 0, max: 0, lastWon: 0),
  );
  @override
  Future<ImportResult> importResults(
    List<SubmitArgs> results, {
    int classicMax = 0,
    int hardMax = 0,
  }) async => ImportResult(imported: 0, verified: 0);
  @override
  Future<AccountDeleteResult> deleteAccount() => throw UnimplementedError();
  @override
  Future<bool> restoreAccount() => throw UnimplementedError();
  @override
  Future<AppConfigResponse> appConfig() => throw UnimplementedError();
}

void main() {
  setUp(
    () => SharedPreferences.setMockInitialValues({
      'tessera:first_run_demo_seen': true,
    }),
  );

  testWidgets('top bar exposes how-to, history, leaderboard and settings', (tester) async {
    await tester.pumpWidget(_harness());
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.help_outline), findsOneWidget);
    expect(find.byIcon(Icons.bar_chart), findsOneWidget);
    expect(find.byIcon(Icons.emoji_events_outlined), findsOneWidget);
    expect(find.byIcon(Icons.tune), findsOneWidget);
  });

  testWidgets('unsolved board shows the hints + solution controls and legend', (
    tester,
  ) async {
    await tester.pumpWidget(_harness());
    await tester.pumpAndSettle();
    expect(find.text('Hide hints'), findsOneWidget);
    expect(find.text('Solution'), findsOneWidget);
    // New player (0 solves) still gets the legend key.
    expect(find.byType(Legend), findsNWidgets(3));
  });

  testWidgets('solving swaps in the share + definitions actions', (
    tester,
  ) async {
    await tester.pumpWidget(_harness());
    await tester.pumpAndSettle();
    final container = ProviderScope.containerOf(
      tester.element(find.byType(GameScreen)),
    );
    container.read(boardProvider.notifier).tap(0);
    container.read(boardProvider.notifier).tap(1);
    expect(container.read(boardProvider).isSolved, isTrue);
    // Bounded pumps: the finished screen mounts a 1s countdown timer, so
    // pumpAndSettle would never return. Long enough to drain the solved
    // cascade's staggered Future.delayed timers.
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 300));
    }

    expect(find.text('Challenge a friend →'), findsOneWidget);
    expect(find.text('Definitions'), findsOneWidget);
    expect(find.text('Solution'), findsNothing);
    expect(find.textContaining('Next puzzle in'), findsOneWidget);

    // Unmount so the countdown's periodic timer is cancelled before the
    // framework's pending-timer check.
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('solving while signed in pushes the result to the server', (
    tester,
  ) async {
    final api = _RecordingApi();
    await tester.pumpWidget(
      _harness(
        extra: [
          authBackendProvider.overrideWithValue(_SignedInBackend()),
          accountClientProvider.overrideWithValue(api),
        ],
      ),
    );
    await tester.pumpAndSettle();
    final container = ProviderScope.containerOf(
      tester.element(find.byType(GameScreen)),
    );
    container.read(boardProvider.notifier).tap(0);
    container.read(boardProvider.notifier).tap(1);
    expect(container.read(boardProvider).isSolved, isTrue);
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 300));
    }

    expect(api.submitCalls, 1);
    expect(api.submitted.single.number, _oneFromSolved().num);
    expect(api.submitted.single.revealed, isFalse);
    // The swap-move chain must ride along so the server can replay-verify
    // the solve (without it every mobile solve is silently unverified and
    // never appears on any leaderboard).
    expect(api.submitted.single.history, [
      [0, 1],
    ]);

    await tester.pumpWidget(const SizedBox());
  });
}
