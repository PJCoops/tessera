import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/chrome/history_screen.dart';
import 'package:tessera/src/theme/theme.dart';

import 'support/test_dict.dart';

Widget _harness() => ProviderScope(
  overrides: [dictOverride()],
  child: MaterialApp(
    theme: buildTesseraTheme(brightness: Brightness.light),
    home: const HistoryScreen(),
  ),
);

/// pumpAndSettle plus a couple of real-duration pumps so the async
/// dict + results hydration lands regardless of test order.
Future<void> _ready(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('empty state when nothing is solved', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(_harness());
    await _ready(tester);
    expect(
      find.text('No puzzles solved yet. Today’s your day.'),
      findsOneWidget,
    );
    expect(find.text('SOLVED'), findsOneWidget); // stat label (uppercased)
  });

  testWidgets('renders stats, tier bars and a row per result', (tester) async {
    SharedPreferences.setMockInitialValues({
      'tessera:result:10':
          '{"moves":8,"bonus":false,"completedAt":1,"minSwaps":8}',
      'tessera:result:11':
          '{"moves":40,"bonus":false,"completedAt":2,"minSwaps":8}',
      'tessera:result:12':
          '{"moves":30,"bonus":false,"completedAt":3,"revealed":true,"minSwaps":8}',
    });
    await tester.pumpWidget(_harness());
    await _ready(tester);

    expect(find.text('#10 · 2026-05-06'), findsOneWidget);
    expect(find.text('#12 · 2026-05-08'), findsOneWidget);
    expect(find.text('revealed'), findsOneWidget);
    expect(find.text('Legendary'), findsOneWidget);
    expect(find.text('Tenacious'), findsOneWidget);
  });

  testWidgets('mode toggle scopes results to the selected mode', (tester) async {
    SharedPreferences.setMockInitialValues({
      'tessera:result:10':
          '{"moves":8,"bonus":false,"completedAt":1,"minSwaps":8}',
      'tessera:hard:result:20':
          '{"moves":12,"bonus":false,"completedAt":1,"minSwaps":10}',
    });
    await tester.pumpWidget(_harness());
    await _ready(tester);
    expect(find.text('#10 · 2026-05-06'), findsOneWidget);

    await tester.tap(find.text('Hard'));
    await tester.pumpAndSettle();
    expect(find.text('#10 · 2026-05-06'), findsNothing);
    expect(find.text('#20 · 2026-05-16'), findsOneWidget);
  });

  testWidgets('replay tab lists past puzzles', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(_harness());
    await _ready(tester);
    await tester.tap(find.text('Replay'));
    await tester.pumpAndSettle();

    expect(find.text('Not played'), findsWidgets);
    // Scroll to the very first puzzle at the bottom of the list.
    await tester.scrollUntilVisible(
      find.text('#1 · 2026-04-27'),
      400,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('#1 · 2026-04-27'), findsOneWidget);
  });
}
