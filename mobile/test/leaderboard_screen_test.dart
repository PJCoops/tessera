import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/leaderboard/leaderboard_client.dart';
import 'package:tessera/src/leaderboard/leaderboard_screen.dart';
import 'package:tessera/src/mode.dart';
import 'package:tessera/src/theme/theme.dart';

import 'support/test_dict.dart';

class _FakeApi implements LeaderboardApi {
  _FakeApi({List<LeagueSummary>? leagues}) : leagues = leagues ?? [];

  List<LeagueSummary> leagues;
  final List<String> calls = [];
  String? joinFails;

  @override
  Future<LeaderboardResponse> getLeaderboard(ModeId mode, int num) async {
    calls.add('getLeaderboard:${mode.name}:$num');
    return LeaderboardResponse(
      global: const [
        LeaderboardEntry(rank: 1, handle: 'Jem', moves: 9, timeMs: 22896, isMe: false),
        LeaderboardEntry(rank: 2, handle: 'Me', moves: 10, timeMs: 30000, isMe: true),
      ],
      country: const CountryBoard(code: 'GB', entries: []),
      meGlobal: null,
      meCountry: null,
      hasHandle: true,
      signedIn: true,
    );
  }

  @override
  Future<List<LeagueSummary>> myLeagues() async {
    calls.add('myLeagues');
    return leagues;
  }

  @override
  Future<LeagueSummary> createLeague(String name) async {
    calls.add('createLeague:$name');
    final l = LeagueSummary(id: 'l-new', name: name, inviteCode: 'NEWCODE1', memberCount: 1);
    leagues = [...leagues, l];
    return l;
  }

  @override
  Future<LeagueSummary> joinLeague(String code) async {
    calls.add('joinLeague:$code');
    if (joinFails != null) throw Exception(joinFails);
    final l = LeagueSummary(id: 'l-joined', name: 'Family', inviteCode: code, memberCount: 4);
    leagues = [...leagues, l];
    return l;
  }

  @override
  Future<LeagueStandings> leagueStandings(String leagueId, ModeId mode, int num) async {
    calls.add('leagueStandings:$leagueId');
    return const LeagueStandings(
      league: LeagueSummary(id: 'l1', name: 'Family', inviteCode: 'X', memberCount: 2),
      board: [],
      tally: [],
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
    home: const LeaderboardScreen(),
  ),
);

void main() {
  testWidgets('global tab renders ranked rows with a verified mark', (tester) async {
    final api = _FakeApi();
    await tester.pumpWidget(_harness(api));
    await tester.pumpAndSettle();

    expect(find.text('Jem'), findsOneWidget);
    expect(find.text('Me'), findsOneWidget);
    expect(find.byIcon(Icons.verified), findsWidgets);
  });

  testWidgets('leagues tab shows an empty state when the player has none', (tester) async {
    final api = _FakeApi();
    await tester.pumpWidget(_harness(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Leagues'));
    await tester.pumpAndSettle();

    expect(find.textContaining('not in any leagues'), findsOneWidget);
  });

  testWidgets('leagues tab lists an existing league and opens standings on tap', (tester) async {
    final api = _FakeApi(
      leagues: [const LeagueSummary(id: 'l1', name: 'Family', inviteCode: 'X', memberCount: 2)],
    );
    await tester.pumpWidget(_harness(api));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Leagues'));
    await tester.pumpAndSettle();

    expect(find.text('Family'), findsOneWidget);
    await tester.tap(find.text('Family'));
    await tester.pumpAndSettle();

    expect(api.calls, contains('leagueStandings:l1'));
    // Standings screen's AppBar shows the league name too.
    expect(find.text('Family'), findsWidgets);
  });

  testWidgets('joining a league by code calls the API and shows a toast', (tester) async {
    final api = _FakeApi();
    await tester.pumpWidget(_harness(api));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Leagues'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Join a league'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'ABC12345');
    // Two "Join" buttons could now be on screen; tap the dialog's.
    await tester.tap(find.widgetWithText(FilledButton, 'Join a league'));
    await tester.pumpAndSettle();

    expect(api.calls, contains('joinLeague:ABC12345'));
    expect(find.textContaining('Joined'), findsOneWidget);
  });

  testWidgets('creating a league calls the API', (tester) async {
    final api = _FakeApi();
    await tester.pumpWidget(_harness(api));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Leagues'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Create a league'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Family');
    await tester.tap(find.widgetWithText(FilledButton, 'Create'));
    await tester.pumpAndSettle();

    expect(api.calls, contains('createLeague:Family'));
  });
}
