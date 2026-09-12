import 'dart:async';
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

const _dictionaryApiBase = 'https://api.dictionaryapi.dev/api/v2/entries/en_GB/';
const _wiktionaryBase = 'https://en.wiktionary.org/api/rest_v1/page/definition/';

const _lookupTimeout = Duration(milliseconds: 4000);
const _lookupMaxAttempts = 2;
const _lookupRetryDelay = Duration(milliseconds: 300);

/// English word definitions for the "Today's words" screen: a 30-day
/// shared_preferences cache in front of two independent sources —
/// dictionaryapi.dev (en_GB) and Wiktionary, queried in parallel — with
/// singular/plural lemma fallbacks on each and a last-resort bundled map
/// for niche words neither API covers. Port of the lookup logic in
/// app/HowToPlay.tsx (originally single-source with no retry; dev found
/// dictionaryapi.dev — a single-maintainer hobby project with no SLA —
/// was failing intermittently in prod, hence the second source + retry).
/// Every failure path resolves to an empty [Definition] — the screen is
/// non-blocking (spec §16.2, §9).
class DefinitionsRepository {
  DefinitionsRepository({Dio? dio, Map<String, String>? staticEn})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              connectTimeout: _lookupTimeout,
              receiveTimeout: _lookupTimeout,
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

  /// Queries both sources at once — running Wiktionary only after
  /// dictionaryapi.dev's full retry+lemma chain exhausts would double the
  /// worst-case wait on a word neither provider is happy with right now;
  /// in parallel it's bounded by the slower of the two, not their sum.
  Future<Definition> _fetch(String word) async {
    final results = await Future.wait([
      _fetchFromProvider(word, _lookupDictionaryApi),
      _fetchFromProvider(word, _lookupWiktionary),
    ]);
    final chosen = results[0].definition != null ? results[0] : results[1];
    if (chosen.definition != null) return chosen;

    final staticDef = (await _static)[word.toLowerCase()];
    if (staticDef != null) return Definition(definition: staticDef);
    return const Definition();
  }

  Future<Definition> _fetchFromProvider(
    String word,
    Future<Definition> Function(String) lookup,
  ) async {
    final primary = await lookup(word);
    if (primary.definition != null) return primary;
    for (final cand in _lemmaCandidates(word)) {
      final r = await lookup(cand);
      if (r.definition != null) {
        return Definition(
          definition: r.definition,
          partOfSpeech: r.partOfSpeech,
          resolvedFrom: cand,
        );
      }
    }
    return const Definition();
  }

  Future<Definition> _lookupDictionaryApi(String word) async {
    final data = await _fetchJsonWithRetry(
      '$_dictionaryApiBase${Uri.encodeComponent(word)}',
    );
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
  }

  /// Second, independent source (Wikimedia infrastructure — no API key,
  /// and far more reliable than the single-maintainer dictionaryapi.dev).
  Future<Definition> _lookupWiktionary(String word) async {
    final data = await _fetchJsonWithRetry(
      '$_wiktionaryBase${Uri.encodeComponent(word)}',
    );
    if (data is! Map) return const Definition();
    final en = data['en'];
    if (en is! List || en.isEmpty) return const Definition();
    final entry = en[0] as Map<String, dynamic>;
    final defs = entry['definitions'];
    final rawDef = (defs is List && defs.isNotEmpty)
        ? defs[0]['definition'] as String?
        : null;
    if (rawDef == null) return const Definition();
    final partOfSpeech = entry['partOfSpeech'] as String?;
    return Definition(
      definition: _stripHtml(rawDef),
      partOfSpeech: partOfSpeech?.toLowerCase(),
    );
  }

  static String _stripHtml(String html) => html
      .replaceAll(RegExp('<[^>]+>'), '')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .trim();

  /// Fetches JSON with a timeout + retry on anything that looks
  /// transient (network error, timeout, non-404 failure response). A 404
  /// is treated as a genuine "no entry for this word" and returned
  /// immediately, unretried.
  Future<dynamic> _fetchJsonWithRetry(String url) async {
    for (var attempt = 0; attempt < _lookupMaxAttempts; attempt++) {
      try {
        final res = await _dio.get<dynamic>(url);
        if (res.statusCode == 404) return null;
        if (res.statusCode != null && res.statusCode! >= 200 && res.statusCode! < 300) {
          return res.data;
        }
        if (attempt < _lookupMaxAttempts - 1) {
          await Future<void>.delayed(_lookupRetryDelay * (attempt + 1));
          continue;
        }
        return null;
      } on DioException catch (e) {
        if (e.response?.statusCode == 404) return null;
        if (attempt < _lookupMaxAttempts - 1) {
          await Future<void>.delayed(_lookupRetryDelay * (attempt + 1));
          continue;
        }
        return null;
      } catch (_) {
        return null;
      }
    }
    return null;
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
