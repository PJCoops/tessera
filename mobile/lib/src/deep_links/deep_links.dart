import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// This app only handles league invites so far (out of the shapes the
/// server declares in .well-known/apple-app-site-association — `/s/*`
/// shared-result recreation isn't wired yet, that's a follow-up).
///
/// A join link arrives as either `/join/<code>` (path, matches the AASA /
/// assetlinks declaration) or `?join=<code>` (query, what the web app
/// actually generates — app/TesseraGame.tsx). Handle both.
String? parseJoinCode(Uri uri) {
  final fromQuery = uri.queryParameters['join'];
  if (fromQuery != null && fromQuery.isNotEmpty) return fromQuery;

  final segments = uri.pathSegments;
  final i = segments.indexOf('join');
  if (i != -1 && i + 1 < segments.length && segments[i + 1].isNotEmpty) {
    return segments[i + 1];
  }
  return null;
}

/// Wraps [AppLinks] behind a stream of join codes: the cold-start link (if
/// the app was launched by tapping one) followed by any tapped while
/// running. A plain class, not a provider itself, so tests can construct
/// one over a fake stream instead of the real platform channel.
class DeepLinkWatcher {
  DeepLinkWatcher(Stream<Uri> uriStream, {Future<Uri?> Function()? initialLink})
    : _uriStream = uriStream,
      _initialLink = initialLink;

  factory DeepLinkWatcher.platform() {
    final links = AppLinks();
    return DeepLinkWatcher(links.uriLinkStream, initialLink: links.getInitialLink);
  }

  final Stream<Uri> _uriStream;
  final Future<Uri?> Function()? _initialLink;

  Stream<String> joinCodes() async* {
    final initial = await _initialLink?.call();
    if (initial != null) {
      final code = parseJoinCode(initial);
      if (code != null) yield code;
    }
    yield* _uriStream
        .map(parseJoinCode)
        .where((c) => c != null)
        .cast<String>();
  }
}

final deepLinkWatcherProvider = Provider<DeepLinkWatcher>(
  (ref) => DeepLinkWatcher.platform(),
);

/// A join code from a tapped/cold-start link, once per link. Read via
/// `ref.listen` (see game_screen.dart) rather than watched for a value —
/// there's nothing to render from this on its own.
final joinLinkProvider = StreamProvider<String>(
  (ref) => ref.watch(deepLinkWatcherProvider).joinCodes(),
);
