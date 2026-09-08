import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Runs once before the whole test suite. Loads the vendored fonts so
/// golden images render real Fraunces/Inter glyphs instead of the test
/// fallback boxes.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<void> load(String family, List<String> paths) async {
    final loader = FontLoader(family);
    for (final p in paths) {
      loader.addFont(File(p).readAsBytes().then((b) => b.buffer.asByteData()));
    }
    await loader.load();
  }

  await load('Fraunces', [
    'assets/fonts/Fraunces-Light.ttf',
    'assets/fonts/Fraunces-Bold.ttf',
  ]);
  await load('Inter', ['assets/fonts/Inter-SemiBold.ttf']);

  await testMain();
}
