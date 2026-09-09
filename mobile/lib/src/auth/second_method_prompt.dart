import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../i18n.dart';
import '../i18n/dict.dart';
import '../theme/tokens.dart';
import 'sign_in_sheet.dart';

const _promptedKey = 'tessera:second-method-prompted';

/// After the first successful sign-in, prompt once (dismissible) to add a
/// second method — OTP is single-factor, so this is the only guard against
/// a permanent lockout when an inbox is lost (spec §6.1, §16.5).
Future<void> maybeShowSecondMethodPrompt(
  BuildContext context,
  WidgetRef ref,
) async {
  final prefs = await SharedPreferences.getInstance();
  if (prefs.getBool(_promptedKey) ?? false) return;
  await prefs.setBool(_promptedKey, true);
  if (!context.mounted) return;

  final dict = ref.read(dictOrEmptyProvider);
  final c = context.colors;
  await showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: c.paper,
      title: Text(t(dict, 'secondMethod.title')),
      content: Text(t(dict, 'secondMethod.body')),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: Text(t(dict, 'secondMethod.later')),
        ),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: c.ink,
            foregroundColor: c.paper,
          ),
          onPressed: () {
            Navigator.of(ctx).pop();
            showSignInSheet(context);
          },
          child: Text(t(dict, 'secondMethod.add')),
        ),
      ],
    ),
  );
}
