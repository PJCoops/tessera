import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../mode.dart';
import 'leaderboard_client.dart';

/// The daily board for (mode, puzzle number). A family so each screen visit
/// with a different mode/number gets its own cached fetch.
final leaderboardProvider =
    FutureProvider.family<LeaderboardResponse, ({ModeId mode, int num})>((
      ref,
      args,
    ) {
      return ref.read(leaderboardClientProvider).getLeaderboard(args.mode, args.num);
    });

/// Leagues the signed-in user belongs to.
final myLeaguesProvider = FutureProvider<List<LeagueSummary>>((ref) {
  return ref.read(leaderboardClientProvider).myLeagues();
});

/// Standings (board + all-time tally) for one league.
final leagueStandingsProvider =
    FutureProvider.family<LeagueStandings, ({String leagueId, ModeId mode, int num})>((
      ref,
      args,
    ) {
      return ref
          .read(leaderboardClientProvider)
          .leagueStandings(args.leagueId, args.mode, args.num);
    });
