import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/auth/auth_controller.dart';
import 'package:tessera/src/i18n/dict.dart';
import 'package:tessera/src/leaderboard/leaderboard_client.dart';
import 'package:tessera/src/leaderboard/leaderboard_screen.dart';
import 'package:tessera/src/mode.dart';
import 'package:tessera/src/theme/theme.dart';

import 'support/test_dict.dart';

class _SignedOutBackend implements AuthBackend {
  const _SignedOutBackend();
  @override
  Stream<AuthUser?> authChanges() => Stream.value(null);
  @override
  AuthUser? get currentUser => null;
  @override
  String? get accessToken => null;
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

class _SignedInBackend implements AuthBackend {
  const _SignedInBackend();
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

class _FakeApi implements LeaderboardApi {
  final List<String> calls = [];

  @override
  Future<LeaderboardResponse> getLeaderboard(ModeId mode, int num) => throw UnimplementedError();
  @override
  Future<List<LeagueSummary>> myLeagues() async => [];
  @override
  Future<LeagueSummary> createLeague(String name) => throw UnimplementedError();

  @override
  Future<LeagueSummary> joinLeague(String code) async {
    calls.add('joinLeague:$code');
    return LeagueSummary(id: 'l1', name: 'Family', inviteCode: code, memberCount: 4);
  }

  @override
  Future<LeagueStandings> leagueStandings(String leagueId, ModeId mode, int num) async {
    calls.add('leagueStandings:$leagueId');
    return const LeagueStandings(
      league: LeagueSummary(id: 'l1', name: 'Family', inviteCode: 'X', memberCount: 4),
      board: [],
      tally: [],
      hasHandle: true,
    );
  }

  @override
  Future<void> reportScore(ModeId mode, int num, String handle) => throw UnimplementedError();
}

Widget _harness(_FakeApi api, {required bool signedIn}) => ProviderScope(
  overrides: [
    dictOverride(),
    leaderboardClientProvider.overrideWithValue(api),
    authBackendProvider.overrideWithValue(
      signedIn ? const _SignedInBackend() : const _SignedOutBackend(),
    ),
  ],
  child: MaterialApp(
    theme: buildTesseraTheme(brightness: Brightness.light),
    home: Builder(
      builder: (context) => Scaffold(
        body: Consumer(
          builder: (context, ref, _) {
            // Force authUserProvider + the dict to subscribe/resolve
            // before the button is ever tapped, matching how they're
            // already watched in game_screen.dart's build by the time a
            // deep link could arrive in the real app (it never shows
            // interactive UI, so never calls this, before both resolve).
            ref.watch(authUserProvider);
            ref.watch(dictOrEmptyProvider);
            return ElevatedButton(
              onPressed: () => handleJoinLinkCode(context, ref, 'ABC12345'),
              child: const Text('trigger'),
            );
          },
        ),
      ),
    ),
  ),
);

void main() {
  testWidgets('signed in: confirms then joins and opens standings', (tester) async {
    final api = _FakeApi();
    await tester.pumpWidget(_harness(api, signedIn: true));
    await tester.pumpAndSettle(); // let authProvider's stream emit its first value
    await tester.tap(find.text('trigger'));
    await tester.pumpAndSettle();

    // Confirmation dialog first — not a silent auto-join (§12.2).
    expect(api.calls, isEmpty);
    expect(find.byType(AlertDialog), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Join a league'));
    await tester.pumpAndSettle();

    expect(api.calls, contains('joinLeague:ABC12345'));
    expect(api.calls, contains('leagueStandings:l1'));
    expect(find.textContaining('Joined'), findsOneWidget);
  });

  testWidgets('signed out: opens the sign-in sheet instead of joining', (tester) async {
    final api = _FakeApi();
    await tester.pumpWidget(_harness(api, signedIn: false));
    await tester.tap(find.text('trigger'));
    await tester.pumpAndSettle();

    expect(find.text('Sign in or create account'), findsOneWidget);
    expect(api.calls, isEmpty);
    expect(find.byType(AlertDialog), findsNothing);
  });
}
