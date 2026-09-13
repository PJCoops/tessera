import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/account_client.dart';
import '../auth/auth_controller.dart';
import '../settings/settings.dart';
import 'sync_engine.dart';

enum SyncStatus { idle, syncing, done, failed }

final syncEngineProvider = Provider<SyncEngine>((ref) => SyncEngine(ref));

/// Populated by [accountSyncProvider] when a sign-in merge lowers the
/// visible streak; the root widget shows the explanation screen and
/// clears it.
final streakDecreaseProvider = StateProvider<StreakDecrease?>((ref) => null);

final syncStatusProvider = StateProvider<SyncStatus>((ref) => SyncStatus.idle);

/// The account-level half of the ads-removed entitlement (§8.2), refreshed
/// whenever [SyncEngine.syncOnSignIn] pulls results. Combine with the
/// store's own cached entitlement (once RevenueCat is wired) via
/// `storeEntitlement || adsRemovedProvider` — either side can grant it.
final adsRemovedProvider = StateProvider<bool>((ref) => false);

/// Remembers the last signed-in user so [accountSyncProvider] can clear
/// that user's sync guard + queue when they sign out.
final _lastSyncedUserProvider = StateProvider<String?>((ref) => null);

/// Watched high in the tree (see app.dart). On sign-in it runs the
/// first-sign-in reconciliation once per user (guard in prefs), otherwise
/// just drains the offline submit queue. On sign-out it resets that guard
/// so the next sign-in reconciles again.
final accountSyncProvider = Provider<void>((ref) {
  final user = ref.watch(authUserProvider);
  final engine = ref.watch(syncEngineProvider);

  // Defer: providers can't be mutated during build.
  Future(() async {
    final last = ref.read(_lastSyncedUserProvider);

    if (user == null) {
      if (last != null) {
        await engine.reset(last);
        ref.read(_lastSyncedUserProvider.notifier).state = null;
        ref.read(adsRemovedProvider.notifier).state = false;
      }
      return;
    }

    ref.read(_lastSyncedUserProvider.notifier).state = user.id;

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
      ref.read(adsRemovedProvider.notifier).state = out.adsRemoved;
      // First sign-in only (this whole block is guarded by alreadySynced
      // above): the account's colour-blind preference wins over whatever
      // this fresh install/device happened to default to.
      if (out.colourBlind != ref.read(settingsProvider).colourBlind) {
        ref.read(settingsProvider.notifier).setColourBlind(out.colourBlind);
      }
      ref.read(syncStatusProvider.notifier).state = SyncStatus.done;
    } catch (_) {
      ref.read(syncStatusProvider.notifier).state = SyncStatus.failed;
    }
  });
});

/// Keeps the account's colour-blind preference (§17.2) in step with the
/// local settings toggle whenever signed in — mirrors [reminderSyncProvider]'s
/// shape (watched high in the tree, side effect on change). Fires once
/// per rebuild of either dependency, including the sign-in pull above
/// re-applying the same value back to the server; that round-trip is a
/// harmless no-op, not worth guarding against.
final colourBlindSyncProvider = Provider<void>((ref) {
  final user = ref.watch(authUserProvider);
  final colourBlind = ref.watch(settingsProvider.select((s) => s.colourBlind));
  if (user == null) return;
  unawaited(
    ref
        .read(accountClientProvider)
        .setColourBlindRemote(colourBlind)
        .catchError((_) {}),
  );
});
