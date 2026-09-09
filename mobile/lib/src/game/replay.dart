import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../mode.dart';
import 'board_controller.dart';
import 'puzzle.dart';

/// Identifies a past puzzle to replay: a UTC date + mode + locale.
class ReplayArgs {
  const ReplayArgs({
    required this.date,
    required this.modeId,
    required this.locale,
  });

  final String date;
  final ModeId modeId;
  final String locale;

  @override
  bool operator ==(Object other) =>
      other is ReplayArgs &&
      other.date == date &&
      other.modeId == modeId &&
      other.locale == locale;

  @override
  int get hashCode => Object.hash(date, modeId, locale);
}

/// A past puzzle for the isolated replay board. Uses the same per-day
/// cache as the daily fetch.
final replayPuzzleProvider = FutureProvider.family<Puzzle, ReplayArgs>((
  ref,
  args,
) {
  return ref
      .watch(puzzleRepositoryProvider)
      .forDate(
        args.date,
        locale: args.locale,
        mode: modeById(args.modeId).apiValue,
      );
});
