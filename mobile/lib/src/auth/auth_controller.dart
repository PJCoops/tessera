import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'supabase.dart';

/// The signed-in user, or null. Minimal projection of the Supabase user.
class AuthUser {
  const AuthUser({required this.id, this.email});
  final String id;
  final String? email;
}

class AuthUnavailable implements Exception {
  const AuthUnavailable();
  @override
  String toString() => 'AuthUnavailable: Supabase is not configured';
}

/// The auth operations the app needs, behind an interface so tests can
/// swap in a fake without a live Supabase project.
abstract class AuthBackend {
  Stream<AuthUser?> authChanges();
  AuthUser? get currentUser;

  /// Current access token (JWT), or null when signed out.
  String? get accessToken;

  /// ms since epoch of the most recent real authentication (from the JWT
  /// `amr` claim, `iat` fallback) — the freshness signal for account
  /// deletion (§6.3). Null when signed out.
  int? get authTimeMs;

  Future<void> sendOtp(String email);
  Future<void> verifyOtp(String email, String token);
  Future<void> signInWithApple();
  Future<void> signInWithGoogle();
  Future<void> signOut();
}

final authBackendProvider = Provider<AuthBackend>(
  (ref) => isSupabaseConfigured ? SupabaseAuthBackend() : const NullAuthBackend(),
);

/// The current user as an [AsyncValue]; `null` data means signed out.
final authProvider = StreamProvider<AuthUser?>(
  (ref) => ref.watch(authBackendProvider).authChanges(),
);

/// Convenience: the resolved user or null (no loading state).
final authUserProvider = Provider<AuthUser?>(
  (ref) => ref.watch(authProvider).valueOrNull,
);

final authControllerProvider = Provider<AuthController>(
  (ref) => AuthController(ref),
);

/// Thin facade over [AuthBackend] used by the sign-in / delete / settings
/// UI, plus the once-only "add a second method" prompt flag.
class AuthController {
  AuthController(this._ref);
  final Ref _ref;

  AuthBackend get _b => _ref.read(authBackendProvider);

  AuthUser? get user => _ref.read(authUserProvider);
  String? get accessToken => _b.accessToken;
  int? get authTimeMs => _b.authTimeMs;

  Future<void> sendOtp(String email) => _b.sendOtp(email);
  Future<void> verifyOtp(String email, String token) =>
      _b.verifyOtp(email, token);
  Future<void> signInWithApple() => _b.signInWithApple();
  Future<void> signInWithGoogle() => _b.signInWithGoogle();
  Future<void> signOut() => _b.signOut();
}

// ── Real backend ─────────────────────────────────────────────────────

class SupabaseAuthBackend implements AuthBackend {
  GoTrueClient get _auth => supabaseClient.auth;

  AuthUser? _map(User? u) => u == null ? null : AuthUser(id: u.id, email: u.email);

  @override
  Stream<AuthUser?> authChanges() async* {
    yield _map(_auth.currentUser);
    yield* _auth.onAuthStateChange.map((s) => _map(s.session?.user));
  }

  @override
  AuthUser? get currentUser => _map(_auth.currentUser);

  @override
  String? get accessToken => _auth.currentSession?.accessToken;

  @override
  int? get authTimeMs => authTimeFromJwt(accessToken);

  @override
  Future<void> sendOtp(String email) => _auth.signInWithOtp(
    email: email.trim().toLowerCase(),
    shouldCreateUser: true,
  );

  @override
  Future<void> verifyOtp(String email, String token) async {
    final e = email.trim().toLowerCase();
    final t = token.trim();
    try {
      await _auth.verifyOTP(email: e, token: t, type: OtpType.email);
    } on AuthException {
      // New, unconfirmed users need the `signup` type when "Confirm email"
      // is on. Mirrors the web (app/components/AccountModal.tsx).
      await _auth.verifyOTP(email: e, token: t, type: OtpType.signup);
    }
  }

  @override
  Future<void> signInWithApple() async {
    final rawNonce = _nonce();
    final hashedNonce = sha256.convert(utf8.encode(rawNonce)).toString();
    final cred = await SignInWithApple.getAppleIDCredential(
      scopes: [AppleIDAuthorizationScopes.email],
      nonce: hashedNonce,
    );
    final idToken = cred.identityToken;
    if (idToken == null) {
      throw const AuthException('No identity token from Apple');
    }
    await _auth.signInWithIdToken(
      provider: OAuthProvider.apple,
      idToken: idToken,
      nonce: rawNonce,
    );
  }

  @override
  Future<void> signInWithGoogle() async {
    // serverClientId is the *web* OAuth client (--dart-define); the iOS
    // client id is read from Info.plist's GIDClientID (set per flavor in
    // the xcconfigs). A missing config surfaces as a PlatformException
    // the sheet reports.
    const serverClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
    final google = GoogleSignIn(
      serverClientId: serverClientId.isEmpty ? null : serverClientId,
    );
    final account = await google.signIn();
    if (account == null) throw const AuthException('Google sign-in cancelled');
    final auth = await account.authentication;
    final idToken = auth.idToken;
    if (idToken == null) {
      throw const AuthException('No identity token from Google');
    }
    await _auth.signInWithIdToken(
      provider: OAuthProvider.google,
      idToken: idToken,
      accessToken: auth.accessToken,
    );
  }

  @override
  Future<void> signOut() => _auth.signOut();

  static String _nonce([int length = 32]) {
    const charset =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';
    final rnd = Random.secure();
    return List.generate(length, (_) => charset[rnd.nextInt(charset.length)]).join();
  }
}

/// Decodes the most-recent-auth timestamp from a Supabase access token —
/// `max(amr[].timestamp)`, falling back to `iat`. Mirrors the server's
/// `authTimeFromClaims` in app/lib/auth-context.ts.
int? authTimeFromJwt(String? jwt) {
  if (jwt == null) return null;
  final parts = jwt.split('.');
  if (parts.length != 3) return null;
  try {
    final payload = jsonDecode(
      utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
    ) as Map<String, dynamic>;
    final amr = payload['amr'];
    if (amr is List) {
      final stamps = amr
          .whereType<Map>()
          .map((e) => e['timestamp'])
          .whereType<num>()
          .map((n) => n.toInt());
      if (stamps.isNotEmpty) return stamps.reduce(max) * 1000;
    }
    final iat = payload['iat'];
    return iat is num ? iat.toInt() * 1000 : null;
  } catch (_) {
    return null;
  }
}

// ── Null backend (Supabase not configured) ───────────────────────────

class NullAuthBackend implements AuthBackend {
  const NullAuthBackend();
  @override
  Stream<AuthUser?> authChanges() => Stream.value(null);
  @override
  AuthUser? get currentUser => null;
  @override
  String? get accessToken => null;
  @override
  int? get authTimeMs => null;
  @override
  Future<void> sendOtp(String email) async => throw const AuthUnavailable();
  @override
  Future<void> verifyOtp(String email, String token) async =>
      throw const AuthUnavailable();
  @override
  Future<void> signInWithApple() async => throw const AuthUnavailable();
  @override
  Future<void> signInWithGoogle() async => throw const AuthUnavailable();
  @override
  Future<void> signOut() async {}
}
