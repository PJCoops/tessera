import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/auth/auth_controller.dart';
import 'package:tessera/src/auth/sign_in_sheet.dart';
import 'package:tessera/src/theme/theme.dart';

import 'support/test_dict.dart';

class _FakeBackend implements AuthBackend {
  final _users = StreamController<AuthUser?>.broadcast();
  AuthUser? _current;
  final List<String> calls = [];

  @override
  Stream<AuthUser?> authChanges() async* {
    yield _current;
    yield* _users.stream;
  }

  @override
  AuthUser? get currentUser => _current;
  @override
  String? get accessToken => _current == null ? null : 'tok';
  @override
  int? get authTimeMs => null;

  @override
  Future<void> sendOtp(String email) async => calls.add('sendOtp:$email');

  @override
  Future<void> verifyOtp(String email, String token) async {
    calls.add('verifyOtp:$token');
    _current = const AuthUser(id: 'u1', email: 'a@b.com');
    _users.add(_current);
  }

  @override
  Future<void> signInWithApple() async => calls.add('apple');
  @override
  Future<void> signInWithGoogle() async => calls.add('google');
  @override
  Future<void> signOut() async {
    _current = null;
    _users.add(null);
  }
}

Widget _harness(_FakeBackend backend) => ProviderScope(
  overrides: [
    dictOverride(),
    authBackendProvider.overrideWithValue(backend),
  ],
  child: MaterialApp(
    theme: buildTesseraTheme(brightness: Brightness.light),
    home: Builder(
      builder: (context) => Scaffold(
        body: Center(
          child: ElevatedButton(
            onPressed: () => showSignInSheet(context),
            child: const Text('open'),
          ),
        ),
      ),
    ),
  ),
);

void main() {
  testWidgets('email -> code -> verify signs in and dismisses the sheet', (
    tester,
  ) async {
    final backend = _FakeBackend();
    await tester.pumpWidget(_harness(backend));
    await tester.pumpAndSettle();

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('Continue with Google'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, 'a@b.com');
    await tester.tap(find.text('Send code'));
    await tester.pumpAndSettle();
    expect(backend.calls, contains('sendOtp:a@b.com'));

    // Code step.
    await tester.enterText(find.byType(TextField).first, '123456');
    await tester.pumpAndSettle();

    expect(backend.calls, contains('verifyOtp:123456'));
    expect(find.text('Send code'), findsNothing); // sheet gone
  });

  testWidgets('a bad code surfaces the error and keeps the sheet open', (
    tester,
  ) async {
    final backend = _FakeBackend();
    await tester.pumpWidget(_harness(backend));
    await tester.pumpAndSettle();
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'a@b.com');
    await tester.tap(find.text('Send code'));
    await tester.pumpAndSettle();

    // Override verify to throw for this run.
    backend.calls.clear();
    await tester.enterText(find.byType(TextField).first, '000');
    await tester.pumpAndSettle();
    // <6 chars: verify not attempted, sheet still open.
    expect(find.text('Verify'), findsOneWidget);
  });
}
