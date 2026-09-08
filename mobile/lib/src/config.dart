import '../flavors.dart';

/// Per-flavor configuration. The prod API base is baked into release
/// builds — no runtime override outside debug (spec §12.1). Dev points at
/// the preview/test deployment.
class AppConfig {
  const AppConfig._(this.apiBaseUrl);

  final String apiBaseUrl;

  static const _dev = AppConfig._('https://dev.tesserapuzzle.com');
  static const _prod = AppConfig._('https://tesserapuzzle.com');

  static AppConfig get current => F.appFlavor == Flavor.prod ? _prod : _dev;
}
