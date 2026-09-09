import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../settings/settings.dart';

/// The active locale dictionary (`assets/locales/<locale>.json`), reloaded
/// when the language setting changes. Callers pass the resolved map to
/// `t()` from src/i18n.dart. Full string coverage of the app is Phase 6;
/// Phase 3 uses this for the share payload and the new screens.
final dictProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final locale = ref.watch(settingsProvider.select((s) => s.locale));
  final raw = await rootBundle.loadString('assets/locales/$locale.json');
  return jsonDecode(raw) as Map<String, dynamic>;
});

/// The dictionary as a plain map, empty until the async load lands. Lets
/// widgets call `t()` without unwrapping an [AsyncValue]; a missing key
/// falls back to its path, so the first frame degrades to raw keys rather
/// than throwing.
final dictOrEmptyProvider = Provider<Map<String, dynamic>>((ref) {
  return ref.watch(dictProvider).valueOrNull ?? const {};
});
