import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/deep_links/deep_links.dart';

void main() {
  group('parseJoinCode', () {
    test('reads the query shape the web app generates (?join=<code>)', () {
      expect(parseJoinCode(Uri.parse('https://tesserapuzzle.com/?join=ABC12345')), 'ABC12345');
    });

    test('reads the path shape declared in .well-known (/join/<code>)', () {
      expect(parseJoinCode(Uri.parse('https://tesserapuzzle.com/join/ABC12345')), 'ABC12345');
    });

    test('returns null for links with no join code', () {
      expect(parseJoinCode(Uri.parse('https://tesserapuzzle.com/s/abc123')), isNull);
      expect(parseJoinCode(Uri.parse('https://tesserapuzzle.com/')), isNull);
      expect(parseJoinCode(Uri.parse('https://tesserapuzzle.com/?join=')), isNull);
    });
  });

  group('DeepLinkWatcher', () {
    test('emits the cold-start link first, then tapped links', () async {
      final watcher = DeepLinkWatcher(
        Stream.fromIterable([
          Uri.parse('https://tesserapuzzle.com/s/whatever'), // no code, filtered out
          Uri.parse('https://tesserapuzzle.com/?join=SECOND01'),
        ]),
        initialLink: () async => Uri.parse('https://tesserapuzzle.com/join/FIRST001'),
      );
      final codes = await watcher.joinCodes().toList();
      expect(codes, ['FIRST001', 'SECOND01']);
    });

    test('skips a cold-start link with no join code', () async {
      final watcher = DeepLinkWatcher(
        Stream.fromIterable([Uri.parse('https://tesserapuzzle.com/?join=X')]),
        initialLink: () async => Uri.parse('https://tesserapuzzle.com/'),
      );
      expect(await watcher.joinCodes().toList(), ['X']);
    });
  });
}
