import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/auth/streak_decrease_screen.dart';
import 'package:tessera/src/mode.dart';
import 'package:tessera/src/sync/sync_engine.dart';
import 'package:tessera/src/sync/sync_providers.dart';
import 'package:tessera/src/theme/theme.dart';

import 'support/test_dict.dart';

const _info = StreakDecrease(
  mode: ModeId.classic,
  previous: 7,
  current: 3,
  best: 12,
  pushed: 4,
  pulled: 9,
);

void main() {
  testWidgets('shows the was/now numbers, best and transfer counts', (
    tester,
  ) async {
    late ProviderContainer container;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dictOverride(),
          streakDecreaseProvider.overrideWith((ref) => _info),
        ],
        child: Consumer(
          builder: (context, ref, _) {
            container = ProviderScope.containerOf(context);
            return MaterialApp(
              theme: buildTesseraTheme(brightness: Brightness.light),
              home: const StreakDecreaseScreen(info: _info),
            );
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('now 3'), findsOneWidget);
    expect(find.textContaining('was 7'), findsOneWidget);
    expect(find.textContaining('12'), findsOneWidget); // best kept
    expect(find.textContaining('Sent 4'), findsOneWidget);

    await tester.tap(find.text('Got it'));
    await tester.pumpAndSettle();
    expect(container.read(streakDecreaseProvider), isNull);
  });
}
