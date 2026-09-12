import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/chrome/definitions_repository.dart';

/// Fake adapter routing by host: dictionaryapi.dev and Wiktionary are
/// queried in parallel by the repository, so tests control each
/// independently. [dictKnown] / [wiktionaryKnown] map a word to its
/// definition text; a word not in the map 404s. [failFirstAttempts]
/// makes the next N requests to a given URL fail with a 500 before
/// succeeding, to exercise the retry path.
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter({this.dictKnown = const {}, this.wiktionaryKnown = const {}});
  final Map<String, String> dictKnown;
  final Map<String, String> wiktionaryKnown;
  final List<String> requested = [];
  final Map<String, int> failFirstAttempts = {};

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final uri = options.uri;
    requested.add(uri.toString());
    final word = Uri.decodeComponent(uri.pathSegments.last);

    final remainingFailures = failFirstAttempts[uri.toString()] ?? 0;
    if (remainingFailures > 0) {
      failFirstAttempts[uri.toString()] = remainingFailures - 1;
      return ResponseBody.fromString('{}', 500);
    }

    if (uri.host.contains('dictionaryapi')) {
      final def = dictKnown[word];
      if (def == null) return ResponseBody.fromString('{}', 404);
      return ResponseBody.fromString(
        jsonEncode([
          {
            'word': word,
            'meanings': [
              {
                'partOfSpeech': 'noun',
                'definitions': [
                  {'definition': def},
                ],
              },
            ],
          },
        ]),
        200,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );
    }

    // Wiktionary.
    final def = wiktionaryKnown[word];
    if (def == null) return ResponseBody.fromString('{}', 404);
    return ResponseBody.fromString(
      jsonEncode({
        'en': [
          {
            'partOfSpeech': 'Noun',
            'definitions': [
              {'definition': '<span>$def</span>'},
            ],
          },
        ],
      }),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

DefinitionsRepository _repo(_FakeAdapter adapter, {Map<String, String>? staticEn}) {
  final dio = Dio()..httpClientAdapter = adapter;
  return DefinitionsRepository(dio: dio, staticEn: staticEn ?? const {});
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('resolves the word directly from dictionaryapi.dev', () async {
    final a = _FakeAdapter(dictKnown: {'turf': 'The meaning of turf.'});
    final d = await _repo(a).lookup('turf');
    expect(d.definition, 'The meaning of turf.');
    expect(d.partOfSpeech, 'noun');
    expect(d.resolvedFrom, isNull);
  });

  test('falls back to a singular lemma', () async {
    final a = _FakeAdapter(dictKnown: {'spy': 'The meaning of spy.'});
    final d = await _repo(a).lookup('spies');
    expect(d.definition, 'The meaning of spy.');
    expect(d.resolvedFrom, 'spy');
  });

  test('falls back to Wiktionary when dictionaryapi.dev has nothing', () async {
    final a = _FakeAdapter(wiktionaryKnown: {'turf': 'Grass and its roots.'});
    final d = await _repo(a).lookup('turf');
    expect(d.definition, 'Grass and its roots.');
    expect(d.partOfSpeech, 'noun'); // lowercased from Wiktionary's "Noun"
  });

  test('strips HTML markup from a Wiktionary definition', () async {
    // The fake adapter wraps every Wiktionary def in <span>...</span>.
    final a = _FakeAdapter(wiktionaryKnown: {'plot': 'A small area of land.'});
    final d = await _repo(a).lookup('plot');
    expect(d.definition, 'A small area of land.');
  });

  test('prefers dictionaryapi.dev when both sources have an entry', () async {
    final a = _FakeAdapter(
      dictKnown: {'turf': 'dict definition'},
      wiktionaryKnown: {'turf': 'wiktionary definition'},
    );
    final d = await _repo(a).lookup('turf');
    expect(d.definition, 'dict definition');
  });

  test('retries a transient failure before succeeding', () async {
    final a = _FakeAdapter(dictKnown: {'turf': 'The meaning of turf.'});
    a.failFirstAttempts['https://api.dictionaryapi.dev/api/v2/entries/en_GB/turf'] = 1;
    final d = await _repo(a).lookup('turf');
    expect(d.definition, 'The meaning of turf.');
  });

  test('falls back to the bundled static map', () async {
    final a = _FakeAdapter();
    final d = await _repo(
      a,
      staticEn: {'alif': 'The first letter of the Arabic alphabet.'},
    ).lookup('alif');
    expect(d.definition, 'The first letter of the Arabic alphabet.');
    expect(d.resolvedFrom, isNull);
  });

  test('returns an empty definition when nothing resolves', () async {
    final a = _FakeAdapter();
    final d = await _repo(a).lookup('zzzzz');
    expect(d.isEmpty, isTrue);
  });

  test('a resolved definition is served from cache on the next lookup', () async {
    final a = _FakeAdapter(dictKnown: {'turf': 'The meaning of turf.'});
    final repo = _repo(a);
    await repo.lookup('turf');
    a.requested.clear();
    final again = await repo.lookup('turf');
    expect(again.definition, 'The meaning of turf.');
    expect(a.requested, isEmpty, reason: 'no network on a cache hit');
  });
}
