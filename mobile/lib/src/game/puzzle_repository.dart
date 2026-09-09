import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../clock.dart';
import '../config.dart';
import 'puzzle.dart';

/// Fetches the daily puzzle from GET /api/v1/puzzle and caches it per day
/// in shared_preferences, so a reload is offline-friendly once a day has
/// been played (spec §7). One retry with jittered backoff on a network
/// failure; a 4xx is not retried.
class PuzzleRepository {
  PuzzleRepository({
    Dio? dio,
    SharedPreferences? prefs,
    this.devFallback = false,
  }) : _dio =
           dio ??
           Dio(
             BaseOptions(
               baseUrl: AppConfig.current.apiBaseUrl,
               connectTimeout: const Duration(seconds: 5),
               receiveTimeout: const Duration(seconds: 5),
             ),
           ),
       _prefs = prefs;

  final Dio _dio;
  SharedPreferences? _prefs;

  /// When true, a failed fetch with no cache falls back to [Puzzle.sample]
  /// instead of throwing — so dev builds are playable without a backend.
  final bool devFallback;

  Future<SharedPreferences> get _store async =>
      _prefs ??= await SharedPreferences.getInstance();

  String _key(String date, String locale, String mode) =>
      'puzzle:$locale:$mode:$date';

  /// Today's puzzle. Serves the cache immediately if present, otherwise
  /// fetches and caches. Throws [PuzzleUnavailable] when there's no cache
  /// and the network can't be reached.
  Future<Puzzle> daily({
    String locale = 'en',
    String mode = 'classic',
    DateTime? now,
  }) async {
    final date = todayUtcDate(now);
    final key = _key(date, locale, mode);
    final store = await _store;

    final cached = store.getString(key);
    if (cached != null) {
      return Puzzle.fromJson(jsonDecode(cached) as Map<String, dynamic>);
    }

    try {
      final body = await _fetch(date: date, locale: locale, mode: mode);
      await store.setString(key, jsonEncode(body));
      return Puzzle.fromJson(body);
    } on PuzzleUnavailable {
      // Dev builds run without a guaranteed backend — fall back to the
      // bundled sample so the app is always playable. Prod surfaces the
      // real "connect to load today's puzzle" state (spec §7, §16.2).
      if (devFallback) return Puzzle.sample();
      rethrow;
    }
  }

  /// A specific past date's puzzle (the history "Replay" list). Same
  /// per-day cache as [daily]; no dev fallback — a replay that can't be
  /// fetched surfaces the error state.
  Future<Puzzle> forDate(
    String date, {
    String locale = 'en',
    String mode = 'classic',
  }) async {
    final key = _key(date, locale, mode);
    final store = await _store;
    final cached = store.getString(key);
    if (cached != null) {
      return Puzzle.fromJson(jsonDecode(cached) as Map<String, dynamic>);
    }
    final body = await _fetch(date: date, locale: locale, mode: mode);
    await store.setString(key, jsonEncode(body));
    return Puzzle.fromJson(body);
  }

  Future<Map<String, dynamic>> _fetch({
    required String date,
    required String locale,
    required String mode,
  }) async {
    Object? lastError;
    for (var attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        await Future.delayed(
          Duration(
            milliseconds: 400 * attempt + (DateTime.now().microsecond % 200),
          ),
        );
      }
      try {
        final res = await _dio.get<Map<String, dynamic>>(
          '/api/v1/puzzle',
          queryParameters: {'date': date, 'locale': locale, 'mode': mode},
        );
        final data = res.data;
        if (data != null) return data;
        lastError = StateError('empty puzzle response');
      } on DioException catch (e) {
        final status = e.response?.statusCode ?? 0;
        if (status >= 400 && status < 500) {
          throw PuzzleUnavailable('puzzle $date rejected ($status)');
        }
        lastError = e;
      }
    }
    throw PuzzleUnavailable('could not load puzzle $date', lastError);
  }
}

class PuzzleUnavailable implements Exception {
  PuzzleUnavailable(this.message, [this.cause]);
  final String message;
  final Object? cause;
  @override
  String toString() => 'PuzzleUnavailable: $message';
}
