import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/auth/account_client.dart';
import 'package:tessera/src/auth/auth_controller.dart';
import 'package:tessera/src/auth/delete_account_flow.dart';
import 'package:tessera/src/theme/theme.dart';

import 'support/test_dict.dart';

class _Backend implements AuthBackend {
  final List<String> calls = [];
  @override
  Stream<AuthUser?> authChanges() =>
      Stream.value(const AuthUser(id: 'u1', email: 'a@b.com'));
  @override
  AuthUser? get currentUser => const AuthUser(id: 'u1', email: 'a@b.com');
  @override
  String? get accessToken => 'tok';
  @override
  int? get authTimeMs => DateTime.now().millisecondsSinceEpoch;
  @override
  Future<void> sendOtp(String email) async => calls.add('send');
  @override
  Future<void> verifyOtp(String email, String token) async =>
      calls.add('verify:$token');
  @override
  Future<void> signInWithApple() async {}
  @override
  Future<void> signInWithGoogle() async {}
  @override
  Future<void> signOut() async => calls.add('signOut');
}

class _Api implements AccountApi {
  bool deleteFailsReauth = false;
  int deleteCalls = 0;
  int restoreCalls = 0;

  @override
  Future<AccountDeleteResult> deleteAccount() async {
    deleteCalls++;
    if (deleteFailsReauth) throw ReauthRequired();
    return AccountDeleteResult(
      permanentAt: DateTime.utc(2026, 9, 13),
      alreadyPending: false,
    );
  }

  @override
  Future<bool> restoreAccount() async {
    restoreCalls++;
    return true;
  }

  @override
  Future<GetResultsResponse> getResults() => throw UnimplementedError();
  @override
  Future<bool> submitResult(SubmitArgs a) => throw UnimplementedError();
  @override
  Future<ImportResult> importResults(
    List<SubmitArgs> results, {
    int classicMax = 0,
    int hardMax = 0,
  }) => throw UnimplementedError();
  @override
  Future<AppConfigResponse> appConfig() => throw UnimplementedError();
  @override
  Future<void> registerDeviceToken({
    required String platform,
    required String token,
    required int tzOffsetMinutes,
  }) => throw UnimplementedError();
  @override
  Future<void> deregisterDeviceToken(String token) =>
      throw UnimplementedError();
}

Widget _harness(_Backend b, _Api api) => ProviderScope(
  overrides: [
    dictOverride(),
    authBackendProvider.overrideWithValue(b),
    accountClientProvider.overrideWithValue(api),
  ],
  child: MaterialApp(
    theme: buildTesseraTheme(brightness: Brightness.light),
    home: Builder(
      builder: (context) => Scaffold(
        body: Center(
          child: ElevatedButton(
            onPressed: () => showDeleteAccountFlow(context),
            child: const Text('go'),
          ),
        ),
      ),
    ),
  ),
);

Future<void> _open(WidgetTester tester) async {
  await tester.pumpWidget(_harness(_backend, _api));
  await tester.pumpAndSettle();
  await tester.tap(find.text('go'));
  await tester.pumpAndSettle();
}

late _Backend _backend;
late _Api _api;

void main() {
  setUp(() {
    _backend = _Backend();
    _api = _Api();
  });

  testWidgets('confirm -> re-auth -> delete -> grace state -> restore', (
    tester,
  ) async {
    await _open(tester);
    expect(find.text('Delete your account?'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await tester.pumpAndSettle();
    expect(_backend.calls, contains('send'));
    expect(find.text('Confirm it’s you'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '123456');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await tester.pumpAndSettle();

    expect(_backend.calls, contains('verify:123456'));
    expect(_api.deleteCalls, 1);
    expect(find.text('Deletion scheduled'), findsOneWidget);
    expect(find.textContaining('2026-09-13'), findsOneWidget);

    await tester.tap(find.text('Restore account'));
    await tester.pumpAndSettle();
    expect(_api.restoreCalls, 1);
  });

  testWidgets('a stale token keeps the flow on the re-auth step', (
    tester,
  ) async {
    _api.deleteFailsReauth = true;
    await _open(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '123456');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await tester.pumpAndSettle();

    expect(_api.deleteCalls, 1);
    expect(find.text('Deletion scheduled'), findsNothing);
    expect(find.text('Confirm it’s you'), findsOneWidget);
  });
}
