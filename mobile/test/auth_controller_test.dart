import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/auth/auth_controller.dart';

String _jwt(Map<String, dynamic> payload) {
  String seg(Object o) =>
      base64Url.encode(utf8.encode(jsonEncode(o))).replaceAll('=', '');
  return '${seg({'alg': 'HS256'})}.${seg(payload)}.sig';
}

void main() {
  group('authTimeFromJwt', () {
    test('reads the newest amr timestamp (seconds -> ms)', () {
      final jwt = _jwt({
        'amr': [
          {'method': 'otp', 'timestamp': 1700000000},
          {'method': 'password', 'timestamp': 1700000500},
        ],
        'iat': 1699999000,
      });
      expect(authTimeFromJwt(jwt), 1700000500 * 1000);
    });

    test('falls back to iat when amr is absent', () {
      expect(authTimeFromJwt(_jwt({'iat': 1699999000})), 1699999000 * 1000);
    });

    test('returns null for null / malformed input', () {
      expect(authTimeFromJwt(null), isNull);
      expect(authTimeFromJwt('not-a-jwt'), isNull);
      expect(authTimeFromJwt('a.b.c'), isNull);
    });
  });

  group('NullAuthBackend', () {
    const backend = NullAuthBackend();

    test('is signed out and has no token', () async {
      expect(backend.currentUser, isNull);
      expect(backend.accessToken, isNull);
      expect(backend.authTimeMs, isNull);
      expect(await backend.authChanges().first, isNull);
    });

    test('sign-in operations throw AuthUnavailable', () {
      expect(backend.sendOtp('a@b.com'), throwsA(isA<AuthUnavailable>()));
      expect(backend.verifyOtp('a@b.com', '123456'), throwsA(isA<AuthUnavailable>()));
      expect(backend.signInWithApple(), throwsA(isA<AuthUnavailable>()));
      expect(backend.signInWithGoogle(), throwsA(isA<AuthUnavailable>()));
    });

    test('signOut is a safe no-op', () async {
      await expectLater(backend.signOut(), completes);
    });
  });
}
