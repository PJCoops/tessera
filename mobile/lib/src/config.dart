import '../flavors.dart';

/// Per-flavor configuration. The prod API base is baked into release
/// builds — no runtime override outside debug (spec §12.1). Dev points at
/// the preview/test deployment by default, or at whatever
/// `--dart-define=API_BASE_URL=...` sets (e.g. `http://localhost:3000`
/// when running the Next.js app locally — see mobile/README.md).
class AppConfig {
  const AppConfig._(this.apiBaseUrl);

  final String apiBaseUrl;

  static const _devApiBase = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://dev.tesserapuzzle.com',
  );

  static const _dev = AppConfig._(_devApiBase);
  static const _prod = AppConfig._('https://tesserapuzzle.com');

  static AppConfig get current => F.appFlavor == Flavor.prod ? _prod : _dev;
}
