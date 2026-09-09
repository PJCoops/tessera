import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/chrome/email_signup.dart';
import 'package:tessera/src/email/subscribe_repository.dart';
import 'package:tessera/src/theme/theme.dart';

import 'support/test_dict.dart';

class _FakeRepo extends SubscribeRepository {
  // Pass a throwaway Dio so the real constructor doesn't touch AppConfig
  // (which needs a flavor that tests don't set).
  _FakeRepo(this.result) : super(dio: Dio());
  final SubscribeStatus result;
  String? sawEmail;

  @override
  Future<SubscribeStatus> subscribe({
    required String email,
    required String source,
    required String locale,
  }) async {
    sawEmail = email;
    return result;
  }
}

Widget _harness(_FakeRepo repo) => ProviderScope(
  overrides: [
    dictOverride(),
    subscribeRepositoryProvider.overrideWithValue(repo),
  ],
  child: MaterialApp(
    theme: buildTesseraTheme(brightness: Brightness.light),
    home: const Scaffold(body: SingleChildScrollView(child: EmailSignup())),
  ),
);

Future<void> _ready(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('rejects a malformed address without calling the API', (
    tester,
  ) async {
    final repo = _FakeRepo(SubscribeStatus.ok);
    await tester.pumpWidget(_harness(repo));
    await _ready(tester);

    await tester.enterText(find.byType(TextField), 'not-an-email');
    await tester.tap(find.text('Remind me'));
    await tester.pump();

    expect(repo.sawEmail, isNull);
    expect(
      find.text('Something went wrong. Check the address and try again.'),
      findsOneWidget,
    );
  });

  testWidgets('submits a valid address and shows the success line', (
    tester,
  ) async {
    final repo = _FakeRepo(SubscribeStatus.ok);
    await tester.pumpWidget(_harness(repo));
    await _ready(tester);

    await tester.enterText(find.byType(TextField), 'player@example.com');
    await tester.tap(find.text('Remind me'));
    await tester.pumpAndSettle();

    expect(repo.sawEmail, 'player@example.com');
    expect(
      find.text('Subscribed. We’ll send tomorrow’s grid at 09:00 UTC.'),
      findsOneWidget,
    );
  });

  testWidgets('surfaces the not-configured state', (tester) async {
    final repo = _FakeRepo(SubscribeStatus.notConfigured);
    await tester.pumpWidget(_harness(repo));
    await _ready(tester);

    await tester.enterText(find.byType(TextField), 'player@example.com');
    await tester.tap(find.text('Remind me'));
    await tester.pumpAndSettle();

    expect(find.text('Reminders aren’t live yet. Come back soon.'), findsOneWidget);
  });
}
