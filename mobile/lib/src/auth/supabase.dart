import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Supabase URL + anon key come from `--dart-define` so no secret is
/// committed. A build without them runs signed-out only (accounts UI is
/// hidden / disabled) — see mobile/README.md.
const _url = String.fromEnvironment('SUPABASE_URL');
const _anonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

/// True once [initSupabase] has run against a configured project.
bool get isSupabaseConfigured => _configured;
bool _configured = false;

/// The initialized client. Only touch this when [isSupabaseConfigured].
SupabaseClient get supabaseClient => Supabase.instance.client;

/// Call once from `main` before `runApp`. No-op when the dart-defines are
/// absent.
Future<void> initSupabase() async {
  if (_url.isEmpty || _anonKey.isEmpty) return;
  await Supabase.initialize(
    url: _url,
    // The Supabase "anon" key is a publishable key; the dart-define name
    // mirrors the web's NEXT_PUBLIC_SUPABASE_ANON_KEY.
    publishableKey: _anonKey,
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
      localStorage: _SecureSessionStorage(),
    ),
  );
  _configured = true;
}

/// Persists the Supabase session in the platform keychain / keystore
/// (spec §4.1 — "holds the JWT in secure storage") instead of
/// shared_preferences.
class _SecureSessionStorage extends LocalStorage {
  const _SecureSessionStorage();

  static const _key = 'tessera:supabase-session';
  static const _store = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> hasAccessToken() => _store.containsKey(key: _key);

  @override
  Future<String?> accessToken() => _store.read(key: _key);

  @override
  Future<void> removePersistedSession() => _store.delete(key: _key);

  @override
  Future<void> persistSession(String persistSessionString) =>
      _store.write(key: _key, value: persistSessionString);
}
