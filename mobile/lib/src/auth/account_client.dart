import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../mode.dart';
import '../streak.dart';
import 'api_client.dart';

/// One result being pushed to the server (`POST /api/v1/results` or the
/// `results` array of `/api/v1/results/import`). Mirrors `SubmitArgs` in
/// app/lib/sync.ts.
class SubmitArgs {
  const SubmitArgs({
    required this.number,
    required this.mode,
    required this.locale,
    required this.moves,
    required this.bonus,
    required this.completedAt,
    this.revealed = false,
    this.history,
    this.timeMs,
  });

  final int number;
  final ModeId mode;
  final String locale;
  final int moves;
  final bool bonus;
  final int completedAt; // epoch ms
  final bool revealed;
  final List<List<int>>? history; // [from, to] swap pairs
  final int? timeMs;

  Map<String, dynamic> toJson() => {
    'num': number,
    'mode': mode.name,
    'locale': locale,
    'moves': moves,
    'bonus': bonus,
    'completedAt': completedAt,
    if (revealed) 'revealed': true,
    if (history != null) 'history': history,
    if (timeMs != null) 'timeMs': timeMs,
  };
}

/// A result row as returned by `GET /api/v1/results`.
class ServerResult {
  const ServerResult({
    required this.number,
    required this.mode,
    required this.moves,
    required this.bonus,
    required this.revealed,
    required this.verified,
    required this.completedAt,
    this.timeMs,
  });

  final int number;
  final ModeId mode;
  final int moves;
  final bool bonus;
  final bool revealed;
  final bool verified;
  final int completedAt;
  final int? timeMs;

  factory ServerResult.fromJson(Map<String, dynamic> j) => ServerResult(
    number: (j['num'] as num).toInt(),
    mode: j['mode'] == 'hard' ? ModeId.hard : ModeId.classic,
    moves: (j['moves'] as num).toInt(),
    bonus: j['bonus'] as bool? ?? false,
    revealed: j['revealed'] as bool? ?? false,
    verified: j['verified'] as bool? ?? false,
    completedAt: (j['completedAt'] as num?)?.toInt() ?? 0,
    timeMs: (j['timeMs'] as num?)?.toInt(),
  );
}

Streak _streak(Map<String, dynamic>? j) => Streak(
  current: (j?['current'] as num?)?.toInt() ?? 0,
  max: (j?['max'] as num?)?.toInt() ?? 0,
  lastWon: (j?['lastWon'] as num?)?.toInt() ?? 0,
);

class GetResultsResponse {
  const GetResultsResponse({
    required this.results,
    required this.classicStreak,
    required this.hardStreak,
    this.adsRemoved = false,
  });

  final List<ServerResult> results;
  final Streak classicStreak;
  final Streak hardStreak;

  /// The account-level half of the ads-removed entitlement (§8.2) — the
  /// RevenueCat webhook is the only writer server-side. A client ORs this
  /// with its own store's cached entitlement.
  final bool adsRemoved;

  Streak streakFor(ModeId m) => m == ModeId.hard ? hardStreak : classicStreak;

  factory GetResultsResponse.fromJson(Map<String, dynamic> j) {
    final streaks = j['streaks'] as Map<String, dynamic>? ?? const {};
    return GetResultsResponse(
      results: [
        for (final r in (j['results'] as List? ?? const []))
          ServerResult.fromJson(r as Map<String, dynamic>),
      ],
      classicStreak: _streak(streaks['classic'] as Map<String, dynamic>?),
      hardStreak: _streak(streaks['hard'] as Map<String, dynamic>?),
      adsRemoved: j['adsRemoved'] as bool? ?? false,
    );
  }
}

class ImportResult {
  const ImportResult({required this.imported, required this.verified});
  final int imported;
  final int verified;
}

class AccountDeleteResult {
  const AccountDeleteResult({
    required this.permanentAt,
    required this.alreadyPending,
  });
  final DateTime permanentAt;
  final bool alreadyPending;
}

class AppConfigResponse {
  const AppConfigResponse({
    required this.minSupportedVersion,
    this.whatsNew,
    this.flags = const {},
  });
  final String minSupportedVersion;
  final ({String id, String title, String body})? whatsNew;
  final Map<String, bool> flags;

  factory AppConfigResponse.fromJson(Map<String, dynamic> j) {
    final wn = j['whatsNew'] as Map<String, dynamic>?;
    return AppConfigResponse(
      minSupportedVersion: j['minSupportedVersion'] as String? ?? '1.0.0',
      whatsNew: wn == null
          ? null
          : (
              id: wn['id'] as String? ?? '',
              title: wn['title'] as String? ?? '',
              body: wn['body'] as String? ?? '',
            ),
      flags: {
        for (final e in (j['flags'] as Map<String, dynamic>? ?? const {}).entries)
          e.key: e.value == true,
      },
    );
  }
}

/// A non-2xx or `{ok:false}` response from an account endpoint.
class AccountApiException implements Exception {
  AccountApiException(this.reason, [this.statusCode]);
  final String reason;
  final int? statusCode;
  @override
  String toString() => 'AccountApiException($reason, $statusCode)';
}

/// `DELETE /api/v1/account` rejected because the last real auth is stale —
/// the caller must re-run OTP / OAuth and retry (§6.3).
class ReauthRequired extends AccountApiException {
  ReauthRequired() : super('reauth_required', 401);
}

/// The account/results endpoints the app calls. An interface so the sync
/// engine and its tests can swap in a fake without a live backend.
abstract interface class AccountApi {
  Future<GetResultsResponse> getResults();
  Future<bool> submitResult(SubmitArgs a);
  Future<ImportResult> importResults(
    List<SubmitArgs> results, {
    int classicMax,
    int hardMax,
  });
  Future<AccountDeleteResult> deleteAccount();
  Future<bool> restoreAccount();
  Future<AppConfigResponse> appConfig();
}

final accountClientProvider = Provider<AccountApi>((ref) => AccountClient(ref));

class AccountClient implements AccountApi {
  AccountClient(Ref ref, {Dio? dio}) : _dio = buildAuthedDio(ref, dio: dio);

  final Dio _dio;

  Map<String, dynamic> _ok(Response res) {
    final body = res.data;
    if (body is! Map<String, dynamic> || body['ok'] != true) {
      final reason = body is Map ? (body['reason'] as String?) : null;
      if (reason == 'reauth_required') throw ReauthRequired();
      throw AccountApiException(reason ?? 'request_failed', res.statusCode);
    }
    return body;
  }

  @override
  Future<GetResultsResponse> getResults() async {
    final res = await _dio.get<dynamic>('/api/v1/results');
    return GetResultsResponse.fromJson(_ok(res));
  }

  /// Returns whether the server verified the submitted replay.
  @override
  Future<bool> submitResult(SubmitArgs a) async {
    final res = await _dio.post<dynamic>('/api/v1/results', data: a.toJson());
    return _ok(res)['verified'] as bool? ?? false;
  }

  @override
  Future<ImportResult> importResults(
    List<SubmitArgs> results, {
    int classicMax = 0,
    int hardMax = 0,
  }) async {
    final res = await _dio.post<dynamic>(
      '/api/v1/results/import',
      data: {
        'results': [for (final r in results) r.toJson()],
        'streaks': {
          'classic': {'max': classicMax},
          'hard': {'max': hardMax},
        },
      },
    );
    final body = _ok(res);
    return ImportResult(
      imported: (body['imported'] as num?)?.toInt() ?? 0,
      verified: (body['verified'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  Future<AccountDeleteResult> deleteAccount() async {
    final res = await _dio.delete<dynamic>('/api/v1/account');
    final body = _ok(res);
    return AccountDeleteResult(
      permanentAt:
          DateTime.tryParse(body['permanentAt'] as String? ?? '') ??
          DateTime.now().add(const Duration(hours: 48)),
      alreadyPending: body['alreadyPending'] as bool? ?? false,
    );
  }

  @override
  Future<bool> restoreAccount() async {
    final res = await _dio.post<dynamic>(
      '/api/v1/account',
      data: {'action': 'restore'},
    );
    return _ok(res)['restored'] as bool? ?? false;
  }

  @override
  Future<AppConfigResponse> appConfig() async {
    final res = await _dio.get<dynamic>('/api/v1/app-config');
    final body = res.data;
    if (body is! Map<String, dynamic>) {
      throw AccountApiException('bad_response', res.statusCode);
    }
    return AppConfigResponse.fromJson(body);
  }
}
