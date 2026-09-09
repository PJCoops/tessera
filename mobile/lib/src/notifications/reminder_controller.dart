import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../i18n.dart';
import '../i18n/dict.dart';
import '../settings/settings.dart';
import 'reminder_service.dart';

final reminderServiceProvider = Provider<ReminderService>(
  (ref) => ReminderService(),
);

/// Keeps the OS daily-reminder schedule in step with settings. Something
/// high in the tree must `watch` this so it re-runs when the toggle, the
/// time, or the locale changes; the side effect (schedule / cancel) is
/// deliberate here rather than hidden in a widget callback so every entry
/// point — settings toggle, app launch, locale switch — goes through one
/// path.
final reminderSyncProvider = Provider<void>((ref) {
  final enabled = ref.watch(settingsProvider.select((s) => s.reminderEnabled));
  final time = ref.watch(settingsProvider.select((s) => s.reminder));
  // Re-read so the notification copy follows a language change.
  ref.watch(settingsProvider.select((s) => s.locale));
  final dict = ref.watch(dictOrEmptyProvider);
  final service = ref.watch(reminderServiceProvider);

  if (!enabled) {
    service.cancel();
    return;
  }
  // Wait for the dictionary so the notification isn't scheduled with raw
  // key paths; this provider re-runs once it lands.
  if (dict.isEmpty) return;
  service.scheduleDaily(
    time: time,
    title: t(dict, 'push.dailyTitle'),
    body: t(dict, 'push.reminderBody'),
  );
});
