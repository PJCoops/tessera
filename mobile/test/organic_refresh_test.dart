import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/theme/theme.dart';
import 'package:tessera/src/widgets/organic_refresh.dart';

Widget _harness({required Future<void> Function() onRefresh}) => MaterialApp(
  theme: buildTesseraTheme(brightness: Brightness.light),
  home: Scaffold(
    body: OrganicRefresh(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: List.generate(20, (i) => ListTile(title: Text('Row $i'))),
      ),
    ),
  ),
);

void main() {
  testWidgets('a short pull under the trigger threshold does not refresh', (
    tester,
  ) async {
    var calls = 0;
    await tester.pumpWidget(_harness(onRefresh: () async => calls++));

    await tester.fling(find.byType(OrganicRefresh), const Offset(0, 40), 300);
    await tester.pumpAndSettle();

    expect(calls, 0);
  });

  testWidgets('a pull past the trigger threshold calls onRefresh', (
    tester,
  ) async {
    var calls = 0;
    await tester.pumpWidget(_harness(onRefresh: () async => calls++));

    await tester.fling(find.byType(OrganicRefresh), const Offset(0, 300), 800);
    await tester.pumpAndSettle();

    expect(calls, 1);
  });

  testWidgets('settles cleanly (no pending timers/tickers) after a full cycle', (
    tester,
  ) async {
    await tester.pumpWidget(_harness(onRefresh: () async {}));

    await tester.fling(find.byType(OrganicRefresh), const Offset(0, 300), 800);
    await tester.pumpAndSettle();

    // Widget can be safely torn down afterwards — this would throw if the
    // AnimationController were left dangling mid-animation.
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('unmounting mid-idle disposes cleanly (never dragged)', (
    tester,
  ) async {
    await tester.pumpWidget(_harness(onRefresh: () async {}));
    await tester.pump();

    await tester.pumpWidget(const SizedBox());
  });
}
