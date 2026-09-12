import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config.dart';
import 'auth_controller.dart';

/// Builds (or wraps) a Dio client pointed at [AppConfig.current.apiBaseUrl]
/// with a bearer-auth interceptor reading the current session from
/// [authBackendProvider]. Shared by every v1 API client (account/sync,
/// leaderboard/leagues, …) so the base URL + auth wiring live in one place.
///
/// Passing [dio] (tests inject one with a fake [HttpClientAdapter]) still
/// gets the interceptor attached — only the transport is swapped.
Dio buildAuthedDio(Ref ref, {Dio? dio}) {
  final d =
      dio ??
      Dio(
        BaseOptions(
          baseUrl: AppConfig.current.apiBaseUrl,
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 8),
          // Read every status so callers can map `{ok:false}` bodies.
          validateStatus: (_) => true,
        ),
      );
  d.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = ref.read(authBackendProvider).accessToken;
        if (token != null) {
          options.headers['authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
    ),
  );
  return d;
}

/// The shared authed client for callers that don't need to inject a custom
/// [Dio] (tests override this provider directly instead).
final authedDioProvider = Provider<Dio>((ref) => buildAuthedDio(ref));
