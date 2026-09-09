import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// One word's definition, as shown on the "Today's words" screen.
class Definition {
  const Definition({this.definition, this.partOfSpeech, this.resolvedFrom});

  final String? definition;
  final String? partOfSpeech;

  /// The lemma the definition was actually found under (e.g. "spies" ->
  /// "spy"), or null when the word itself resolved.
  final String? resolvedFrom;

  bool get isEmpty => definition == null;
}

const _cachePrefix = 'tessera:def:';
const _cacheTtl = Duration(days: 30);

/// English word definitions for the "Today's words" screen: a 30-day
/// shared_preferences cache in front of dictionaryapi.dev (en_GB), with
/// singular/plural lemma fallbacks and a last-resort bundled map for
/// niche words the API doesn't cover. Port of the lookup logic in
/// app/HowToPlay.tsx. Every failure path resolves to an empty
/// [Definition] — the screen is non-blocking (spec §16.2, §9).
class DefinitionsRepository {
  DefinitionsRepository({Dio? dio, Map<String, String>? staticEn})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: 'https://api.dictionaryapi.dev/api/v2/entries/en_GB/',
              connectTimeout: const Duration(seconds: 4),
              receiveTimeout: const Duration(seconds: 4),
            ),
          ),
      _staticEn = staticEn;

  final Dio _dio;
  Map<String, String>? _staticEn;

  Future<Map<String, String>> get _static async {
    if (_staticEn != null) return _staticEn!;
    try {
      final raw = await rootBundle.loadString(
        'assets/locales/definitions-en.json',
      );
      _staticEn = (jsonDecode(raw) as Map<String, dynamic>).map(
        (k, v) => MapEntry(k, v as String),
      );
    } catch (_) {
      _staticEn = const {};
    }
    return _staticEn!;
  }

  Future<Definition> lookup(String word) async {
    final cached = await _readCache(word);
    if (cached != null) return cached;
    final found = await _fetch(word);
    await _writeCache(word, found);
    return found;
  }

  Future<Definition> _fetch(String word) async {
    final primary = await _lookupOne(word);
    if (primary.definition != null) return primary;
    for (final cand in _lemmaCandidates(word)) {
      final r = await _lookupOne(cand);
      if (r.definition != null) {
        return Definition(
          definition: r.definition,
          partOfSpeech: r.partOfSpeech,
          resolvedFrom: cand,
        );
      }
    }
    final staticDef = (await _static)[word.toLowerCase()];
    if (staticDef != null) return Definition(definition: staticDef);
    return const Definition();
  }

  Future<Definition> _lookupOne(String word) async {
    try {
      final res = await _dio.get<dynamic>(Uri.encodeComponent(word));
      final data = res.data;
      if (data is! List || data.isEmpty) return const Definition();
      final meanings = data[0]['meanings'];
      if (meanings is! List || meanings.isEmpty) return const Definition();
      final meaning = meanings[0] as Map<String, dynamic>;
      final defs = meaning['definitions'];
      return Definition(
        definition: (defs is List && defs.isNotEmpty)
            ? defs[0]['definition'] as String?
            : null,
        partOfSpeech: meaning['partOfSpeech'] as String?,
      );
    } catch (_) {
      return const Definition();
    }
  }

  static List<String> _lemmaCandidates(String word) {
    final out = <String>{};
    if (word.endsWith('ies') && word.length > 3) {
      out.add('${word.substring(0, word.length - 3)}y');
    }
    if (word.endsWith('es') && word.length > 2) {
      out.add(word.substring(0, word.length - 2));
    }
    if (word.endsWith('s') && word.length > 1) {
      out.add(word.substring(0, word.length - 1));
    }
    if (word.endsWith('ed') && word.length > 2) {
      out.add(word.substring(0, word.length - 1));
      out.add(word.substring(0, word.length - 2));
    }
    return out.toList();
  }

  Future<Definition?> _readCache(String word) async {
    final p = await SharedPreferences.getInstance();
    final raw = p.getString('$_cachePrefix$word');
    if (raw == null) return null;
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      final ts = (j['ts'] as num?)?.toInt() ?? 0;
      if (DateTime.now().millisecondsSinceEpoch - ts > _cacheTtl.inMilliseconds) {
        return null;
      }
      if (j['definition'] == null) return null; // don't cache misses as hits
      return Definition(
        definition: j['definition'] as String?,
        partOfSpeech: j['partOfSpeech'] as String?,
        resolvedFrom: j['resolvedFrom'] as String?,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _writeCache(String word, Definition d) async {
    if (d.definition == null) return;
    final p = await SharedPreferences.getInstance();
    await p.setString(
      '$_cachePrefix$word',
      jsonEncode({
        'definition': d.definition,
        'partOfSpeech': d.partOfSpeech,
        'resolvedFrom': d.resolvedFrom,
        'ts': DateTime.now().millisecondsSinceEpoch,
      }),
    );
  }
}

final definitionsRepositoryProvider = Provider(
  (ref) => DefinitionsRepository(),
);

/// One word's definition (English only). Failures resolve to an empty
/// [Definition]; the screen renders regardless.
final definitionProvider = FutureProvider.family<Definition, String>((
  ref,
  word,
) {
  return ref.watch(definitionsRepositoryProvider).lookup(word);
});
