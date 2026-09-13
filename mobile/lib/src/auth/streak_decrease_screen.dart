import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../i18n.dart';
import '../i18n/dict.dart';
import '../theme/tokens.dart';
import '../sync/sync_engine.dart';
import '../sync/sync_providers.dart';

/// Shown once after a sign-in merge lowers the visible streak (spec §6.2 —
/// "never let the number drop without that explanation"). Explains what
/// synced, the verified streak, and the preserved historical best.
class StreakDecreaseScreen extends ConsumerWidget {
  const StreakDecreaseScreen({super.key, required this.info});

  final StreakDecrease info;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    String tr(String k, [Map<String, Object>? v]) => t(dict, k, v);

    return Scaffold(
      backgroundColor: c.paper,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('🔥', style: const TextStyle(fontSize: 40)),
              const SizedBox(height: 16),
              Text(
                tr('streakSync.title'),
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 26,
                  fontWeight: FontWeight.w300,
                  color: c.ink,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                tr('streakSync.wasNow', {
                  'current': info.current,
                  'previous': info.previous,
                }),
                style: TextStyle(fontSize: 15, color: c.inkSoft, height: 1.4),
              ),
              const SizedBox(height: 8),
              Text(
                tr('streakSync.best', {'best': info.best}),
                style: TextStyle(fontSize: 14, color: c.muted),
              ),
              const SizedBox(height: 4),
              Text(
                tr('streakSync.transfer', {
                  'pushed': info.pushed,
                  'pulled': info.pulled,
                }),
                style: TextStyle(fontSize: 13, color: c.muted),
              ),
              const SizedBox(height: 16),
              Text(
                tr('streakSync.why'),
                style: TextStyle(fontSize: 13, color: c.muted, height: 1.4),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: c.ink,
                    foregroundColor: c.paper,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: () {
                    ref.read(streakDecreaseProvider.notifier).state = null;
                    Navigator.of(context).pop();
                  },
                  child: Text(tr('streakSync.dismiss')),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
