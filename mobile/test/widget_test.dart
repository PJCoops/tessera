import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/app.dart';
import 'package:tessera/flavors.dart';

void main() {
  testWidgets('app boots and shows the flavor', (tester) async {
    F.appFlavor = Flavor.dev;
    await tester.pumpWidget(const TesseraApp());
    expect(find.text('Tessera'), findsOneWidget);
    expect(find.text('flavor: dev'), findsOneWidget);
  });
}
