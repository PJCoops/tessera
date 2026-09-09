import 'dart:ui' show Locale;

/// UI languages the app ships. `en` is the fallback and the source of
/// truth for keys (`assets/locales/en.json`). Order is preference order.
const kSupportedLocales = ['en', 'es'];

/// The locale to use when the user has never chosen one. Honours the
/// device's ordered language preferences and falls back to `en` — the
/// mobile equivalent of the web reading `Accept-Language` on first visit
/// (`app/lib/i18n.ts`).
///
/// [stored] is the persisted `tessera:locale` value (null on first launch);
/// a valid stored value always wins. [systemLocales] is normally
/// `PlatformDispatcher.instance.locales`.
String resolveInitialLocale(String? stored, Iterable<Locale> systemLocales) {
  if (stored != null && kSupportedLocales.contains(stored)) return stored;
  for (final locale in systemLocales) {
    if (kSupportedLocales.contains(locale.languageCode)) {
      return locale.languageCode;
    }
  }
  return 'en';
}
