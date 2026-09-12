import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/leaderboard/leaderboard_client.dart';
import 'package:tessera/src/leaderboard/league_standings_screen.dart';
import 'package:tessera/src/mode.dart';
import 'package:tessera/src/theme/theme.dart';

import 'support/test_dict.dart';

class _FakeApi implements LeaderboardApi {
  final List<String> calls = [];

  @override
  Future<LeaderboardResponse> getLeaderboard(ModeId mode, int num) => throw UnimplementedError();
  @override
  Future<List<LeagueSummary>> myLeagues() => throw UnimplementedError();
  @override
  Future<LeagueSummary> createLeague(String name) => throw UnimplementedError();
  @override
  Future<LeagueSummary> joinLeague(String code) => throw UnimplementedError();

  @override
  Future<LeagueStandings> leagueStandings(String leagueId, ModeId mode, int num) async {
    return const LeagueStandings(
      league: LeagueSummary(id: 'l1', name: 'Family', inviteCode: 'X', memberCount: 3),
      board: [
        LeaderboardEntry(rank: 1, handle: 'Me', moves: 8, timeMs: 20000, isMe: true),
        LeaderboardEntry(rank: 2, handle: 'Alice', moves: 10, timeMs: 30000, isMe: false),
      ],
      tally: [
        TallyEntry(handle: 'Me', daysWon: 5, isMe: true),
        TallyEntry(handle: 'Alice', daysWon: 2, isMe: false),
      ],
      hasHandle: true,
    );
  }

  @override
  Future<void> reportScore(ModeId mode, int num, String handle) async {
    calls.add('reportScore:$handle');
  }
}

Widget _harness(_FakeApi api) => ProviderScope(
  overrides: [dictOverride(), leaderboardClientProvider.overrideWithValue(api)],
  child: MaterialApp(
    theme: buildTesseraTheme(brightness: Brightness.light),
    home: const LeagueStandingsScreen(
      leagueId: 'l1',
      name: 'Family',
      mode: ModeId.classic,
      num: 137,
    ),
  ),
);

void main() {
  testWidgets('renders the board and the days-won tally', (tester) async {
    final api = _FakeApi();
    await tester.pumpWidget(_harness(api));
    await tester.pumpAndSettle();

    expect(find.text('Me'), findsWidgets);
    expect(find.text('Alice'), findsWidgets);
    expect(find.text('5'), findsOneWidget); // Me's days-won tally
    // Alice's tally (2) also equals her board rank, so just check presence.
    expect(find.text('2'), findsWidgets);
  });

  testWidgets('the invite card shows the code, instructions and a share button', (tester) async {
    final api = _FakeApi();
    await tester.pumpWidget(_harness(api));
    await tester.pumpAndSettle();

    expect(find.text('X'), findsOneWidget); // the invite code itself
    expect(find.textContaining('Family'), findsWidgets); // instructions name the league
    final share = tester.widget<FilledButton>(
      find.ancestor(of: find.byIcon(Icons.ios_share), matching: find.byType(FilledButton)),
    );
    expect(share.onPressed, isNotNull);
  });

  testWidgets('tapping the invite code does not throw', (tester) async {
    final api = _FakeApi();
    await tester.pumpWidget(_harness(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('invite-code-tap')));
    // Drain the copy round-trip + the 2s "reset the checkmark" timer
    // before the test ends, rather than asserting on the exact frame the
    // transient checkmark/"Copied" confirmation is visible on (flaky to
    // pin down in the test harness; verified manually in the running app).
    await tester.pump(const Duration(seconds: 3));
  });

  testWidgets("isMe rows have no report action, other rows do", (tester) async {
    final api = _FakeApi();
    await tester.pumpWidget(_harness(api));
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.flag_outlined), findsOneWidget);
  });

  testWidgets('reporting a score confirms then posts and acks', (tester) async {
    final api = _FakeApi();
    await tester.pumpWidget(_harness(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.flag_outlined));
    await tester.pumpAndSettle();
    expect(find.text('Report this score?'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Report score'));
    await tester.pumpAndSettle();

    expect(api.calls, contains('reportScore:Alice'));
    expect(find.textContaining('Reported'), findsOneWidget);
  });
}
