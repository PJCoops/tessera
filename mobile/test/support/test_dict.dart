import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tessera/src/i18n/dict.dart';

/// Overrides [dictProvider] with a locale dictionary read straight off
/// disk. `rootBundle.loadString` is flaky across multiple widget tests in
/// one file (the asset handler is torn down between tests), so widget
/// tests inject the dictionary instead of loading it.
Override dictOverride([String locale = 'en']) {
  final map =
      jsonDecode(File('assets/locales/$locale.json').readAsStringSync())
          as Map<String, dynamic>;
  return dictProvider.overrideWith((ref) async => map);
}
