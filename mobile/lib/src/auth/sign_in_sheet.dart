import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../i18n.dart';
import '../i18n/dict.dart';
import '../theme/tokens.dart';
import 'auth_controller.dart';

/// Sign-in / create-account sheet (spec §6.1): Sign in with Apple (iOS,
/// listed first per Guideline 4.8), Sign in with Google, then email +
/// 6-digit code. Dismissible; closes itself on success.
Future<void> showSignInSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: context.colors.paper,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => const Padding(
      padding: EdgeInsets.only(bottom: 0),
      child: _SignInBody(),
    ),
  );
}

enum _Step { choose, code }

class _SignInBody extends ConsumerStatefulWidget {
  const _SignInBody();

  @override
  ConsumerState<_SignInBody> createState() => _SignInBodyState();
}

class _SignInBodyState extends ConsumerState<_SignInBody> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  _Step _step = _Step.choose;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    super.dispose();
  }

  AuthController get _auth => ref.read(authControllerProvider);
  Map<String, dynamic> _dict = const {};
  String _t(String k, [Map<String, Object>? v]) => t(_dict, k, v);

  /// Whether a real auth backend is available (Supabase configured).
  bool get _configured => ref.read(authBackendProvider) is! NullAuthBackend;

  Future<void> _guard(Future<void> Function() action, {String? errorKey}) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      if (mounted && ref.read(authUserProvider) != null) {
        Navigator.of(context).pop();
      }
    } catch (_) {
      if (mounted) setState(() => _error = _t(errorKey ?? 'account.error'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendCode() async {
    final email = _email.text.trim();
    if (!email.contains('@')) {
      setState(() => _error = _t('account.error'));
      return;
    }
    await _guard(() => _auth.sendOtp(email));
    if (mounted && _error == null) setState(() => _step = _Step.code);
  }

  Future<void> _verify() => _guard(
    () => _auth.verifyOtp(_email.text.trim(), _code.text.trim()),
    errorKey: 'account.codeError',
  );

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    _dict = ref.watch(dictOrEmptyProvider);
    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          24,
          4,
          24,
          24 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              _t('account.modalTitle'),
              style: TextStyle(
                fontFamily: 'Fraunces',
                fontSize: 22,
                fontWeight: FontWeight.w300,
                color: c.ink,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _t('account.modalBody'),
              style: TextStyle(fontSize: 13, color: c.muted),
            ),
            const SizedBox(height: 20),
            if (_step == _Step.choose) ..._chooseStep(c) else ..._codeStep(c),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: TextStyle(fontSize: 12, color: c.error),
              ),
            ],
          ],
        ),
      ),
    );
  }

  List<Widget> _chooseStep(TesseraColors c) {
    return [
      if (!_configured)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text(
            _t('account.unavailable'),
            style: TextStyle(fontSize: 12, color: c.muted),
          ),
        ),
      if (Platform.isIOS) ...[
        _ProviderButton(
          label: _t('account.appleButton'),
          icon: Icons.apple,
          onPressed: _busy || !_configured
              ? null
              : () => _guard(_auth.signInWithApple, errorKey: 'account.oauthFailed'),
        ),
        const SizedBox(height: 8),
      ],
      _ProviderButton(
        label: _t('account.googleButton'),
        icon: Icons.g_mobiledata,
        onPressed: _busy || !_configured
            ? null
            : () => _guard(_auth.signInWithGoogle, errorKey: 'account.oauthFailed'),
      ),
      const SizedBox(height: 16),
      Row(
        children: [
          Expanded(child: Divider(color: c.rule)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Text(
              _t('account.emailDivider'),
              style: TextStyle(fontSize: 11, color: c.muted),
            ),
          ),
          Expanded(child: Divider(color: c.rule)),
        ],
      ),
      const SizedBox(height: 12),
      TextField(
        controller: _email,
        enabled: !_busy && _configured,
        keyboardType: TextInputType.emailAddress,
        autocorrect: false,
        decoration: InputDecoration(
          hintText: _t('account.placeholder'),
          border: const OutlineInputBorder(),
          isDense: true,
        ),
        onSubmitted: (_) => _sendCode(),
      ),
      const SizedBox(height: 10),
      FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: c.ink,
          foregroundColor: c.paper,
          padding: const EdgeInsets.symmetric(vertical: 13),
        ),
        onPressed: _busy || !_configured ? null : _sendCode,
        child: Text(_busy ? _t('account.submitting') : _t('account.submit')),
      ),
    ];
  }

  List<Widget> _codeStep(TesseraColors c) {
    return [
      Text(
        _t('account.codePrompt', {'email': _email.text.trim()}),
        style: TextStyle(fontSize: 13, color: c.inkSoft),
      ),
      const SizedBox(height: 12),
      TextField(
        controller: _code,
        enabled: !_busy,
        keyboardType: TextInputType.number,
        maxLength: 10,
        autofocus: true,
        decoration: InputDecoration(
          hintText: _t('account.codePlaceholder'),
          border: const OutlineInputBorder(),
          isDense: true,
          counterText: '',
        ),
        onChanged: (v) {
          if (v.trim().length >= 6) _verify();
        },
        onSubmitted: (_) => _verify(),
      ),
      const SizedBox(height: 10),
      FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: c.ink,
          foregroundColor: c.paper,
          padding: const EdgeInsets.symmetric(vertical: 13),
        ),
        onPressed: _busy ? null : _verify,
        child: Text(_busy ? _t('account.verifying') : _t('account.verify')),
      ),
      TextButton(
        onPressed: _busy
            ? null
            : () => setState(() {
                _step = _Step.choose;
                _code.clear();
                _error = null;
              }),
        child: Text(_t('account.restart')),
      ),
    ];
  }
}

class _ProviderButton extends StatelessWidget {
  const _ProviderButton({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return OutlinedButton.icon(
      style: OutlinedButton.styleFrom(
        foregroundColor: c.ink,
        side: BorderSide(color: c.rule),
        padding: const EdgeInsets.symmetric(vertical: 13),
        minimumSize: const Size.fromHeight(48),
      ),
      onPressed: onPressed,
      icon: Icon(icon, size: 20),
      label: Text(label),
    );
  }
}
