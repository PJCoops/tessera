import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import 'sync_engine.dart';

enum SyncStatus { idle, syncing, done, failed }

final syncEngineProvider = Provider<SyncEngine>((ref) => SyncEngine(ref));

/// Populated by [accountSyncProvider] when a sign-in merge lowers the
/// visible streak; the root widget shows the explanation screen and
/// clears it.
final streakDecreaseProvider = StateProvider<StreakDecrease?>((ref) => null);

final syncStatusProvider = StateProvider<SyncStatus>((ref) => SyncStatus.idle);

/// Watched high in the tree (see app.dart). When a user is signed in it
/// runs the first-sign-in reconciliation once per user per launch, and
/// otherwise just drains the offline submit queue. Also resets the guard
/// on sign-out so a re-sign-in re-syncs.
final accountSyncProvider = Provider<void>((ref) {
  final user = ref.watch(authUserProvider);
  final engine = ref.watch(syncEngineProvider);

  if (user == null) return;

  // Defer: providers can't be mutated during build.
  Future(() async {
    if (await engine.alreadySynced(user.id)) {
      await engine.flushQueue();
      return;
    }
    ref.read(syncStatusProvider.notifier).state = SyncStatus.syncing;
    try {
      final out = await engine.syncOnSignIn(user.id);
      await engine.flushQueue();
      if (out.streakDecrease != null) {
        ref.read(streakDecreaseProvider.notifier).state = out.streakDecrease;
      }
      ref.read(syncStatusProvider.notifier).state = SyncStatus.done;
    } catch (_) {
      ref.read(syncStatusProvider.notifier).state = SyncStatus.failed;
    }
  });
});
