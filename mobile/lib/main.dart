import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'flavors.dart';

/// Shared entrypoint. `main_dev.dart` / `main_prod.dart` set the flavor and
/// call this. Running `lib/main.dart` directly defaults to the dev flavor.
void run(Flavor flavor) {
  F.appFlavor = flavor;
  runApp(const ProviderScope(child: TesseraApp()));
}

void main() => run(Flavor.dev);
