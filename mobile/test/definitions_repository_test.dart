import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tessera/src/chrome/definitions_repository.dart';

/// Fake adapter: 200 with an entry for any word in [known], 404 otherwise.
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.known);
  final Set<String> known;
  final List<String> requested = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final word = Uri.decodeComponent(options.path);
    requested.add(word);
    if (known.contains(word)) {
      return ResponseBody.fromString(
        jsonEncode([
          {
            'word': word,
            'meanings': [
              {
                'partOfSpeech': 'noun',
                'definitions': [
                  {'definition': 'The meaning of $word.'},
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
    return ResponseBody.fromString('{}', 404);
  }

  @override
  void close({bool force = false}) {}
}

DefinitionsRepository _repo(_FakeAdapter adapter, {Map<String, String>? staticEn}) {
  final dio = Dio(BaseOptions(baseUrl: 'https://x.test/'))
    ..httpClientAdapter = adapter;
  return DefinitionsRepository(dio: dio, staticEn: staticEn ?? const {});
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('resolves the word directly', () async {
    final a = _FakeAdapter({'turf'});
    final d = await _repo(a).lookup('turf');
    expect(d.definition, 'The meaning of turf.');
    expect(d.partOfSpeech, 'noun');
    expect(d.resolvedFrom, isNull);
  });

  test('falls back to a singular lemma', () async {
    final a = _FakeAdapter({'spy'});
    final d = await _repo(a).lookup('spies');
    expect(d.definition, 'The meaning of spy.');
    expect(d.resolvedFrom, 'spy');
  });

  test('falls back to the bundled static map', () async {
    final a = _FakeAdapter({});
    final d = await _repo(
      a,
      staticEn: {'alif': 'The first letter of the Arabic alphabet.'},
    ).lookup('alif');
    expect(d.definition, 'The first letter of the Arabic alphabet.');
    expect(d.resolvedFrom, isNull);
  });

  test('returns an empty definition when nothing resolves', () async {
    final a = _FakeAdapter({});
    final d = await _repo(a).lookup('zzzzz');
    expect(d.isEmpty, isTrue);
  });

  test('a resolved definition is served from cache on the next lookup', () async {
    final a = _FakeAdapter({'turf'});
    final repo = _repo(a);
    await repo.lookup('turf');
    a.requested.clear();
    final again = await repo.lookup('turf');
    expect(again.definition, 'The meaning of turf.');
    expect(a.requested, isEmpty, reason: 'no network on a cache hit');
  });
}
