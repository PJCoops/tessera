import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/account_client.dart' show AccountApiException;
import '../auth/api_client.dart';
import '../mode.dart';

/// One ranked board row (`GET /api/v1/leaderboard`, `GET /api/v1/leagues/:id`).
/// Every row returned by the server is already filtered to a verified,
/// non-revealed replay — the "verified" badge in the UI is a static mark on
/// every row, not a per-row field.
class LeaderboardEntry {
  const LeaderboardEntry({
    required this.rank,
    required this.handle,
    required this.moves,
    required this.isMe,
    this.timeMs,
  });

  final int rank;
  final String handle;
  final int moves;
  final int? timeMs;
  final bool isMe;

  factory LeaderboardEntry.fromJson(Map<String, dynamic> j) => LeaderboardEntry(
    rank: (j['rank'] as num).toInt(),
    handle: j['handle'] as String? ?? '',
    moves: (j['moves'] as num).toInt(),
    timeMs: (j['timeMs'] as num?)?.toInt(),
    isMe: j['isMe'] as bool? ?? false,
  );
}

class CountryBoard {
  const CountryBoard({required this.code, required this.entries});
  final String? code;
  final List<LeaderboardEntry> entries;
}

class LeaderboardResponse {
  const LeaderboardResponse({
    required this.global,
    required this.country,
    required this.meGlobal,
    required this.meCountry,
    required this.hasHandle,
    required this.signedIn,
  });

  final List<LeaderboardEntry> global;
  final CountryBoard country;
  final LeaderboardEntry? meGlobal;
  final LeaderboardEntry? meCountry;
  final bool hasHandle;
  final bool signedIn;

  factory LeaderboardResponse.fromJson(Map<String, dynamic> j) {
    final countryJson = j['country'] as Map<String, dynamic>? ?? const {};
    final meJson = j['me'] as Map<String, dynamic>? ?? const {};
    LeaderboardEntry? entryOrNull(dynamic v) =>
        v is Map<String, dynamic> ? LeaderboardEntry.fromJson(v) : null;
    return LeaderboardResponse(
      global: [
        for (final r in (j['global'] as List? ?? const []))
          LeaderboardEntry.fromJson(r as Map<String, dynamic>),
      ],
      country: CountryBoard(
        code: countryJson['code'] as String?,
        entries: [
          for (final r in (countryJson['entries'] as List? ?? const []))
            LeaderboardEntry.fromJson(r as Map<String, dynamic>),
        ],
      ),
      meGlobal: entryOrNull(meJson['global']),
      meCountry: entryOrNull(meJson['country']),
      hasHandle: j['hasHandle'] as bool? ?? false,
      signedIn: j['signedIn'] as bool? ?? false,
    );
  }
}

class LeagueSummary {
  const LeagueSummary({
    required this.id,
    required this.name,
    required this.inviteCode,
    required this.memberCount,
  });
  final String id;
  final String name;
  final String inviteCode;
  final int memberCount;

  factory LeagueSummary.fromJson(Map<String, dynamic> j) => LeagueSummary(
    id: j['id'] as String? ?? '',
    name: j['name'] as String? ?? '',
    inviteCode: j['inviteCode'] as String? ?? '',
    memberCount: (j['memberCount'] as num?)?.toInt() ?? 0,
  );
}

class TallyEntry {
  const TallyEntry({required this.handle, required this.daysWon, required this.isMe});
  final String handle;
  final int daysWon;
  final bool isMe;

  factory TallyEntry.fromJson(Map<String, dynamic> j) => TallyEntry(
    handle: j['handle'] as String? ?? '',
    daysWon: (j['daysWon'] as num?)?.toInt() ?? 0,
    isMe: j['isMe'] as bool? ?? false,
  );
}

class LeagueStandings {
  const LeagueStandings({
    required this.league,
    required this.board,
    required this.tally,
    required this.hasHandle,
  });

  final LeagueSummary league;
  final List<LeaderboardEntry> board;
  final List<TallyEntry> tally;
  final bool hasHandle;

  factory LeagueStandings.fromJson(Map<String, dynamic> j) {
    final leagueJson = j['league'] as Map<String, dynamic>? ?? const {};
    return LeagueStandings(
      league: LeagueSummary(
        id: leagueJson['id'] as String? ?? '',
        name: leagueJson['name'] as String? ?? '',
        inviteCode: leagueJson['inviteCode'] as String? ?? '',
        memberCount: 0,
      ),
      board: [
        for (final r in (j['board'] as List? ?? const []))
          LeaderboardEntry.fromJson(r as Map<String, dynamic>),
      ],
      tally: [
        for (final r in (j['tally'] as List? ?? const []))
          TallyEntry.fromJson(r as Map<String, dynamic>),
      ],
      hasHandle: j['hasHandle'] as bool? ?? false,
    );
  }
}

/// The leaderboard/leagues endpoints the app calls. An interface so screens
/// and their tests can swap in a fake without a live backend.
abstract interface class LeaderboardApi {
  Future<LeaderboardResponse> getLeaderboard(ModeId mode, int num);
  Future<List<LeagueSummary>> myLeagues();
  Future<LeagueSummary> createLeague(String name);
  Future<LeagueSummary> joinLeague(String code);
  Future<LeagueStandings> leagueStandings(String leagueId, ModeId mode, int num);
  Future<void> reportScore(ModeId mode, int num, String handle);
}

final leaderboardClientProvider = Provider<LeaderboardApi>(
  (ref) => LeaderboardClient(ref),
);

class LeaderboardClient implements LeaderboardApi {
  LeaderboardClient(Ref ref, {Dio? dio}) : _dio = buildAuthedDio(ref, dio: dio);

  final Dio _dio;

  Map<String, dynamic> _ok(Response res) {
    final body = res.data;
    if (body is! Map<String, dynamic> || body['ok'] != true) {
      final reason = body is Map ? (body['reason'] as String?) : null;
      throw AccountApiException(reason ?? 'request_failed', res.statusCode);
    }
    return body;
  }

  @override
  Future<LeaderboardResponse> getLeaderboard(ModeId mode, int num) async {
    final res = await _dio.get<dynamic>(
      '/api/v1/leaderboard',
      queryParameters: {'mode': mode.name, 'num': num},
    );
    return LeaderboardResponse.fromJson(_ok(res));
  }

  @override
  Future<List<LeagueSummary>> myLeagues() async {
    final res = await _dio.get<dynamic>('/api/v1/leagues');
    final body = _ok(res);
    return [
      for (final l in (body['leagues'] as List? ?? const []))
        LeagueSummary.fromJson(l as Map<String, dynamic>),
    ];
  }

  @override
  Future<LeagueSummary> createLeague(String name) async {
    final res = await _dio.post<dynamic>('/api/v1/leagues', data: {'name': name});
    final body = _ok(res);
    final league = body['league'] as Map<String, dynamic>? ?? const {};
    return LeagueSummary(
      id: league['id'] as String? ?? '',
      name: league['name'] as String? ?? '',
      inviteCode: league['inviteCode'] as String? ?? '',
      memberCount: 1,
    );
  }

  @override
  Future<LeagueSummary> joinLeague(String code) async {
    final res = await _dio.post<dynamic>(
      '/api/v1/leagues/join',
      data: {'code': code},
    );
    final body = _ok(res);
    final league = body['league'] as Map<String, dynamic>? ?? const {};
    return LeagueSummary(
      id: league['id'] as String? ?? '',
      name: league['name'] as String? ?? '',
      inviteCode: '',
      memberCount: 0,
    );
  }

  @override
  Future<LeagueStandings> leagueStandings(String leagueId, ModeId mode, int num) async {
    final res = await _dio.get<dynamic>(
      '/api/v1/leagues/$leagueId',
      queryParameters: {'mode': mode.name, 'num': num},
    );
    return LeagueStandings.fromJson(_ok(res));
  }

  @override
  Future<void> reportScore(ModeId mode, int num, String handle) async {
    final res = await _dio.post<dynamic>(
      '/api/v1/leaderboard/report',
      data: {'mode': mode.name, 'num': num, 'handle': handle},
    );
    _ok(res);
  }
}
