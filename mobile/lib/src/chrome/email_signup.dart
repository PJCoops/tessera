import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../email/subscribe_repository.dart';
import '../i18n.dart';
import '../i18n/dict.dart';
import '../settings/settings.dart';
import '../theme/tokens.dart';

const _privacyUrl = 'https://tesserapuzzle.com/privacy';

/// Light client-side check that mirrors `isPlausibleEmail` in
/// `app/api/subscribe/route.ts` — an "@" with non-empty halves, a dot in
/// the domain, no whitespace. The server re-validates.
bool isPlausibleEmail(String value) {
  if (value.isEmpty || value.length > 254) return false;
  if (RegExp(r'\s').hasMatch(value)) return false;
  final at = value.indexOf('@');
  if (at < 1 || at == value.length - 1) return false;
  return value.substring(at + 1).contains('.');
}

/// The "third channel" email signup (spec §10): posts to `/api/subscribe`
/// so the daily-reminder email list picks the address up. Independent of
/// the local notification toggle above it.
class EmailSignup extends ConsumerStatefulWidget {
  const EmailSignup({super.key});

  @override
  ConsumerState<EmailSignup> createState() => _EmailSignupState();
}

enum _Status { idle, submitting, done, error }

class _EmailSignupState extends ConsumerState<EmailSignup> {
  final _controller = TextEditingController();
  _Status _status = _Status.idle;
  String? _message;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final dict = ref.read(dictOrEmptyProvider);
    final email = _controller.text.trim();
    if (!isPlausibleEmail(email)) {
      setState(() {
        _status = _Status.error;
        _message = t(dict, 'email.error');
      });
      return;
    }
    setState(() {
      _status = _Status.submitting;
      _message = null;
    });

    final result = await ref
        .read(subscribeRepositoryProvider)
        .subscribe(
          email: email,
          source: 'mobile-settings',
          locale: ref.read(settingsProvider).locale,
        );
    if (!mounted) return;

    setState(() {
      switch (result) {
        case SubscribeStatus.ok:
          _status = _Status.done;
          _message = t(dict, 'email.success');
          _controller.clear();
        case SubscribeStatus.notConfigured:
          _status = _Status.error;
          _message = t(dict, 'email.notConfigured');
        case SubscribeStatus.badEmail:
        case SubscribeStatus.rateLimited:
        case SubscribeStatus.error:
          _status = _Status.error;
          _message = t(dict, 'email.error');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final busy = _status == _Status.submitting;
    final done = _status == _Status.done;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            t(dict, 'email.title'),
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 2),
          Text(
            t(dict, 'email.body'),
            style: TextStyle(fontSize: 12, color: c.muted, height: 1.3),
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  enabled: !busy && !done,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  onSubmitted: (_) => _submit(),
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: t(dict, 'email.placeholder'),
                    border: const OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: busy || done ? null : _submit,
                child: Text(
                  busy ? t(dict, 'email.submitting') : t(dict, 'email.submit'),
                ),
              ),
            ],
          ),
          if (_message != null) ...[
            const SizedBox(height: 8),
            Text(
              _message!,
              style: TextStyle(
                fontSize: 12,
                color: _status == _Status.error ? c.error : c.inkSoft,
              ),
            ),
          ],
          const SizedBox(height: 8),
          Wrap(
            children: [
              Text(
                '${t(dict, 'email.privacyLeader')} ',
                style: TextStyle(fontSize: 11, color: c.muted),
              ),
              GestureDetector(
                onTap: () => launchUrl(
                  Uri.parse(_privacyUrl),
                  mode: LaunchMode.externalApplication,
                ),
                child: Text(
                  t(dict, 'email.privacyLink'),
                  style: TextStyle(
                    fontSize: 11,
                    color: c.inkSoft,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
