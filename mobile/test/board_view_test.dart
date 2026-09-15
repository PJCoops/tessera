import 'package:flutter_test/flutter_test.dart';
import 'package:tessera/src/game/board_view.dart';

void main() {
  group('cascadeSettleDuration', () {
    test('scales with board size under normal motion', () {
      // 4x4: 15 staggered tiles * 70ms + the last tile's own 180ms pop.
      expect(
        cascadeSettleDuration(4, reduceMotion: false),
        const Duration(milliseconds: 15 * 70 + 180),
      );
      // 5x5 (hard mode) takes longer to settle than 4x4.
      final classic = cascadeSettleDuration(4, reduceMotion: false);
      final hard = cascadeSettleDuration(5, reduceMotion: false);
      expect(hard, greaterThan(classic));
    });

    test('is short and board-size-independent under reduce motion', () {
      // The cascade is skipped entirely under reduce motion (spec §17.3),
      // so settle time shouldn't scale with n.
      expect(
        cascadeSettleDuration(4, reduceMotion: true),
        cascadeSettleDuration(5, reduceMotion: true),
      );
      expect(
        cascadeSettleDuration(4, reduceMotion: true) <
            cascadeSettleDuration(4, reduceMotion: false),
        isTrue,
      );
    });
  });
}
