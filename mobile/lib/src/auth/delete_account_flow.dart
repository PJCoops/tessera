import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../i18n.dart';
import '../i18n/dict.dart';
import '../theme/tokens.dart';
import 'account_client.dart';
import 'auth_controller.dart';

/// The in-app account-deletion flow (spec §6.3): confirm → fresh OTP
/// re-auth → `DELETE /api/v1/account` → a grace-state screen with a
/// Restore action. Entirely in-app, no web redirect.
Future<void> showDeleteAccountFlow(BuildContext context) {
  return Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => const _DeleteAccountScreen()),
  );
}

enum _Step { confirm, reauth, pending }

class _DeleteAccountScreen extends ConsumerStatefulWidget {
  const _DeleteAccountScreen();

  @override
  ConsumerState<_DeleteAccountScreen> createState() => _State();
}

class _State extends ConsumerState<_DeleteAccountScreen> {
  final _code = TextEditingController();
  _Step _step = _Step.confirm;
  bool _busy = false;
  String? _error;
  AccountDeleteResult? _result;

  Map<String, dynamic> get _dict => ref.read(dictOrEmptyProvider);
  String _t(String k, [Map<String, Object>? v]) => t(_dict, k, v);
  String get _email => ref.read(authControllerProvider).user?.email ?? '';

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _startReauth() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider).sendOtp(_email);
      setState(() => _step = _Step.reauth);
    } catch (_) {
      setState(() => _error = _t('deleteAccount.failed'));
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _verifyAndDelete() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(authControllerProvider)
          .verifyOtp(_email, _code.text.trim());
      final res = await ref.read(accountClientProvider).deleteAccount();
      setState(() {
        _result = res;
        _step = _Step.pending;
      });
    } on ReauthRequired {
      // The token still isn't fresh enough — resend and retry.
      _code.clear();
      setState(() => _error = _t('deleteAccount.failed'));
    } catch (_) {
      setState(() => _error = _t('deleteAccount.failed'));
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _restore() async {
    setState(() => _busy = true);
    try {
      await ref.read(accountClientProvider).restoreAccount();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_t('deleteAccount.restored'))),
        );
        Navigator.of(context).pop();
      }
    } catch (_) {
      setState(() {
        _error = _t('deleteAccount.failed');
        _busy = false;
      });
    }
  }

  Future<void> _finish() async {
    await ref.read(authControllerProvider).signOut();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    ref.watch(dictOrEmptyProvider); // rebuild when strings land
    return Scaffold(
      backgroundColor: c.paper,
      appBar: AppBar(
        backgroundColor: c.paper,
        title: Text(_t('deleteAccount.title')),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: switch (_step) {
            _Step.confirm => _confirm(c),
            _Step.reauth => _reauth(c),
            _Step.pending => _pending(c),
          },
        ),
      ),
    );
  }

  Widget _confirm(TesseraColors c) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        _t('deleteAccount.confirmTitle'),
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 22,
          fontWeight: FontWeight.w300,
          color: c.ink,
        ),
      ),
      const SizedBox(height: 12),
      Text(
        _t('deleteAccount.confirmBody'),
        style: TextStyle(fontSize: 14, color: c.inkSoft, height: 1.4),
      ),
      if (_error != null) ...[
        const SizedBox(height: 12),
        Text(_error!, style: TextStyle(color: c.error, fontSize: 12)),
      ],
      const SizedBox(height: 28),
      FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: c.error,
          foregroundColor: c.onInverse,
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
        onPressed: _busy ? null : _startReauth,
        child: Text(_t('deleteAccount.confirm')),
      ),
      TextButton(
        onPressed: _busy ? null : () => Navigator.of(context).pop(),
        child: Text(_t('deleteAccount.cancel')),
      ),
    ],
  );

  Widget _reauth(TesseraColors c) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        _t('deleteAccount.reauthTitle'),
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 22,
          fontWeight: FontWeight.w300,
          color: c.ink,
        ),
      ),
      const SizedBox(height: 12),
      Text(
        _t('deleteAccount.reauthBody', {'email': _email}),
        style: TextStyle(fontSize: 13, color: c.inkSoft),
      ),
      const SizedBox(height: 16),
      TextField(
        controller: _code,
        enabled: !_busy,
        keyboardType: TextInputType.number,
        maxLength: 10,
        autofocus: true,
        decoration: InputDecoration(
          hintText: _t('account.codePlaceholder'),
          border: const OutlineInputBorder(),
          counterText: '',
        ),
        onChanged: (_) => setState(() {}),
        onSubmitted: (_) => _verifyAndDelete(),
      ),
      if (_error != null) ...[
        const SizedBox(height: 8),
        Text(_error!, style: TextStyle(color: c.error, fontSize: 12)),
      ],
      const SizedBox(height: 16),
      FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: c.error,
          foregroundColor: c.onInverse,
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
        onPressed: _busy || _code.text.trim().length < 6
            ? null
            : _verifyAndDelete,
        child: Text(_t('deleteAccount.confirm')),
      ),
    ],
  );

  Widget _pending(TesseraColors c) {
    final date = _result?.permanentAt.toLocal().toString().split(' ').first ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          _t('deleteAccount.pendingTitle'),
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 22,
            fontWeight: FontWeight.w300,
            color: c.ink,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          _t('deleteAccount.pendingBody', {'date': date}),
          style: TextStyle(fontSize: 14, color: c.inkSoft, height: 1.4),
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: TextStyle(color: c.error, fontSize: 12)),
        ],
        const SizedBox(height: 28),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: c.ink,
            foregroundColor: c.paper,
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          onPressed: _busy ? null : _restore,
          child: Text(_t('deleteAccount.restore')),
        ),
        TextButton(
          onPressed: _busy ? null : _finish,
          child: Text(_t('deleteAccount.done')),
        ),
      ],
    );
  }
}
