import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'app.dart';
import 'flavors.dart';
import 'src/auth/supabase.dart';

/// Shared entrypoint. `main_dev.dart` / `main_prod.dart` set the flavor and
/// call this. Running `lib/main.dart` directly defaults to the dev flavor.
Future<void> run(Flavor flavor) async {
  F.appFlavor = flavor;
  WidgetsFlutterBinding.ensureInitialized();
  // Portrait only (spec: iPhone-only v1) — the board layout isn't designed
  // for landscape, so lock it here rather than fight a rotated frame.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  await initSupabase(); // no-op without the SUPABASE_* dart-defines
  // Initializing the SDK isn't itself an ad request — only actually
  // showing/requesting ads is gated on consent (spec §8.3), which
  // mobile/lib/src/ads/consent_flow.dart handles separately. Must happen
  // every process launch (this is in-memory SDK state, not a persisted
  // preference) — unlike the one-time consent dialogs, which is why this
  // doesn't live in consent_flow.dart alongside them.
  unawaited(MobileAds.instance.initialize());
  runApp(const ProviderScope(child: TesseraApp()));
}

void main() => run(Flavor.dev);
