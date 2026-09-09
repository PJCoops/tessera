import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/email/subscribe_repository.dart';

/// Canned adapter: replies with a fixed [status] / JSON [body].
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.status, this.body);
  final int status;
  final Object body;
  RequestOptions? lastRequest;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? _,
    Future<void>? _,
  ) async {
    lastRequest = options;
    return ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

SubscribeRepository _repo(_FakeAdapter adapter) {
  // Default validateStatus: non-2xx throws DioException, which is the path
  // subscribe() maps by `reason`.
  final dio = Dio()..httpClientAdapter = adapter;
  return SubscribeRepository(dio: dio);
}

void main() {
  test('ok on {ok: true}', () async {
    final adapter = _FakeAdapter(200, {'ok': true});
    final r = await _repo(adapter).subscribe(
      email: 'a@b.com',
      source: 'mobile-settings',
      locale: 'es',
    );
    expect(r, SubscribeStatus.ok);
    expect(adapter.lastRequest!.data, {
      'email': 'a@b.com',
      'source': 'mobile-settings',
      'locale': 'es',
    });
  });

  test('maps reason: bad_email', () async {
    final r = await _repo(_FakeAdapter(400, {'ok': false, 'reason': 'bad_email'}))
        .subscribe(email: 'x', source: 's', locale: 'en');
    expect(r, SubscribeStatus.badEmail);
  });

  test('maps 429 to rateLimited', () async {
    final r = await _repo(_FakeAdapter(429, {'ok': false, 'reason': 'rate_limited'}))
        .subscribe(email: 'a@b.com', source: 's', locale: 'en');
    expect(r, SubscribeStatus.rateLimited);
  });

  test('maps reason: not_configured', () async {
    final r = await _repo(
      _FakeAdapter(503, {'ok': false, 'reason': 'not_configured'}),
    ).subscribe(email: 'a@b.com', source: 's', locale: 'en');
    expect(r, SubscribeStatus.notConfigured);
  });

  test('anything else is a generic error', () async {
    final r = await _repo(_FakeAdapter(502, {'ok': false, 'reason': 'upstream'}))
        .subscribe(email: 'a@b.com', source: 's', locale: 'en');
    expect(r, SubscribeStatus.error);
  });
}
