import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config.dart';

/// Outcome of an email-signup attempt, mapped from the `reason` field the
/// web `/api/subscribe` route returns (`app/api/subscribe/route.ts`).
enum SubscribeStatus { ok, badEmail, rateLimited, notConfigured, error }

/// Posts an address to the shared `/api/subscribe` endpoint, which forwards
/// it to Loops for the daily-reminder email (spec §10, third channel).
class SubscribeRepository {
  SubscribeRepository({Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: AppConfig.current.apiBaseUrl,
              connectTimeout: const Duration(seconds: 5),
              receiveTimeout: const Duration(seconds: 5),
            ),
          );

  final Dio _dio;

  Future<SubscribeStatus> subscribe({
    required String email,
    required String source,
    required String locale,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/subscribe',
        data: {'email': email, 'source': source, 'locale': locale},
      );
      return res.data?['ok'] == true
          ? SubscribeStatus.ok
          : SubscribeStatus.error;
    } on DioException catch (e) {
      final status = e.response?.statusCode ?? 0;
      final data = e.response?.data;
      final reason = data is Map ? data['reason']?.toString() : null;
      if (status == 429 || reason == 'rate_limited') {
        return SubscribeStatus.rateLimited;
      }
      if (reason == 'bad_email' || reason == 'bad_json') {
        return SubscribeStatus.badEmail;
      }
      if (reason == 'not_configured') return SubscribeStatus.notConfigured;
      return SubscribeStatus.error;
    }
  }
}

final subscribeRepositoryProvider = Provider<SubscribeRepository>(
  (ref) => SubscribeRepository(),
);
