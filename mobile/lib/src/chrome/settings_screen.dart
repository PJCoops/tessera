import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../auth/auth_controller.dart';
import '../auth/delete_account_flow.dart';
import '../auth/sign_in_sheet.dart';
import '../i18n.dart';
import '../i18n/dict.dart';
import '../mode.dart';
import '../notifications/reminder_controller.dart';
import '../settings/settings.dart';
import '../theme/tokens.dart';
import 'email_signup.dart';
import 'how_to_sheet.dart';

const _privacyUrl = 'https://tesserapuzzle.com/privacy';
const _termsUrl = 'https://tesserapuzzle.com/terms';
const _supportUrl = 'mailto:support@tesserapuzzle.com';

final _packageInfoProvider = FutureProvider(
  (ref) => PackageInfo.fromPlatform(),
);

/// The settings screen (spec §16.4). Preferences persist through
/// [settingsProvider]; the account / purchases / privacy rows are
/// placeholders that later phases fill in.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final s = ref.watch(settingsProvider);
    final ctrl = ref.read(settingsProvider.notifier);

    return Scaffold(
      backgroundColor: c.paper,
      appBar: AppBar(
        backgroundColor: c.paper,
        title: Text(t(dict, 'howto.tabs.settings')),
      ),
      body: ListView(
        children: [
          _SettingRow(
            title: t(dict, 'settings.theme.title'),
            description: t(dict, 'settings.theme.descriptionApp'),
            control: _Segmented<ThemeMode>(
              value: s.themeMode,
              onChanged: ctrl.setThemeMode,
              options: [
                (ThemeMode.system, t(dict, 'settings.theme.system')),
                (ThemeMode.light, t(dict, 'settings.theme.light')),
                (ThemeMode.dark, t(dict, 'settings.theme.dark')),
              ],
            ),
          ),
          _SettingRow(
            title: t(dict, 'settings.language.title'),
            description: t(dict, 'settings.language.description'),
            control: _Segmented<String>(
              value: s.locale,
              onChanged: ctrl.setLocale,
              options: const [('en', 'English'), ('es', 'Español')],
            ),
          ),
          _SettingRow(
            title: t(dict, 'settings.colourBlind.title'),
            description: t(dict, 'settings.colourBlind.description'),
            control: Switch(
              value: s.colourBlind,
              onChanged: ctrl.setColourBlind,
            ),
            inlineControl: true,
          ),
          _SettingRow(
            title: t(dict, 'settings.hideHints.title'),
            description: t(dict, 'settings.hideHints.description'),
            control: Switch(value: s.hideHints, onChanged: ctrl.setHideHints),
            inlineControl: true,
          ),
          _SettingRow(
            title: t(dict, 'settings.mute.title'),
            description: t(dict, 'settings.mute.description'),
            control: Switch(value: s.muted, onChanged: ctrl.setMuted),
            inlineControl: true,
          ),
          const _ReminderRow(),
          const EmailSignup(),
          ListTile(
            title: Text(t(dict, 'game.howToPlay')),
            trailing: Icon(Icons.chevron_right, color: c.muted),
            onTap: () =>
                showHowToSheet(context, n: modeById(s.modeId).n),
          ),

          const Divider(height: 32),
          _SectionLabel(label: t(dict, 'account.title')),
          const _AccountRow(),
          for (final key in const [
            'settings.account.restorePurchases',
            'settings.account.removeAds',
            'settings.account.privacyChoices',
          ])
            ListTile(
              enabled: false,
              title: Text(t(dict, key)),
              trailing: Text(
                t(dict, 'settings.soon'),
                style: TextStyle(fontSize: 12, color: c.muted),
              ),
            ),
          const _DeleteAccountRow(),

          const Divider(height: 32),
          ListTile(
            title: Text(t(dict, 'settings.legal.privacy')),
            trailing: Icon(Icons.open_in_new, size: 18, color: c.muted),
            onTap: () => _launch(_privacyUrl),
          ),
          ListTile(
            title: Text(t(dict, 'settings.legal.terms')),
            trailing: Icon(Icons.open_in_new, size: 18, color: c.muted),
            onTap: () => _launch(_termsUrl),
          ),
          ListTile(
            title: Text(t(dict, 'settings.legal.licenses')),
            trailing: Icon(Icons.chevron_right, color: c.muted),
            onTap: () => showLicensePage(context: context),
          ),
          ListTile(
            title: Text(t(dict, 'settings.legal.support')),
            trailing: Icon(Icons.open_in_new, size: 18, color: c.muted),
            onTap: () => _launch(_supportUrl),
          ),

          const SizedBox(height: 8),
          Center(
            child: ref
                .watch(_packageInfoProvider)
                .maybeWhen(
                  data: (info) => Text(
                    'v${info.version} (${info.buildNumber})',
                    style: TextStyle(fontSize: 11, color: c.muted),
                  ),
                  orElse: () => const SizedBox.shrink(),
                ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

Future<void> _launch(String url) async {
  final uri = Uri.parse(url);
  if (await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

/// Sign in (opens the OTP / Apple / Google sheet) or, when signed in, the
/// account email with a Sign out action.
class _AccountRow extends ConsumerWidget {
  const _AccountRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final user = ref.watch(authUserProvider);

    if (user == null) {
      return ListTile(
        title: Text(t(dict, 'settings.account.signIn')),
        subtitle: Text(
          t(dict, 'account.description'),
          style: TextStyle(fontSize: 12, color: c.muted),
        ),
        trailing: Icon(Icons.chevron_right, color: c.muted),
        onTap: () => showSignInSheet(context),
      );
    }
    return ListTile(
      title: Text(
        t(dict, 'account.signedInAs', {'email': user.email ?? ''}),
        style: const TextStyle(fontSize: 14),
      ),
      trailing: TextButton(
        onPressed: () => ref.read(authControllerProvider).signOut(),
        child: Text(t(dict, 'account.signOut')),
      ),
    );
  }
}

/// Delete account — disabled until signed in, then opens the in-app
/// deletion flow (§6.3).
class _DeleteAccountRow extends ConsumerWidget {
  const _DeleteAccountRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final signedIn = ref.watch(authUserProvider) != null;

    return ListTile(
      enabled: signedIn,
      title: Text(
        t(dict, 'settings.account.deleteAccount'),
        style: TextStyle(color: signedIn ? c.error : null),
      ),
      trailing: signedIn
          ? Icon(Icons.chevron_right, color: c.muted)
          : Text(
              t(dict, 'settings.soon'),
              style: TextStyle(fontSize: 12, color: c.muted),
            ),
      onTap: signedIn ? () => showDeleteAccountFlow(context) : null,
    );
  }
}

/// Daily-reminder toggle + time. Turning it on asks for notification
/// permission first; if that's refused the switch stays off and a hint
/// points at device Settings. The actual scheduling is driven by
/// [reminderSyncProvider] watching these settings.
class _ReminderRow extends ConsumerWidget {
  const _ReminderRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final s = ref.watch(settingsProvider);
    final ctrl = ref.read(settingsProvider.notifier);
    final messenger = ScaffoldMessenger.of(context);

    Future<void> onToggle(bool want) async {
      if (want) {
        final granted = await ref
            .read(reminderServiceProvider)
            .requestPermission();
        if (!granted) {
          messenger.showSnackBar(
            SnackBar(content: Text(t(dict, 'settings.reminder.deniedApp'))),
          );
          return;
        }
      }
      ctrl.setReminderEnabled(want);
    }

    return Column(
      children: [
        _SettingRow(
          title: t(dict, 'settings.reminder.title'),
          description: t(dict, 'settings.reminder.descriptionApp'),
          control: Switch(value: s.reminderEnabled, onChanged: onToggle),
          inlineControl: true,
        ),
        if (s.reminderEnabled)
          ListTile(
            dense: true,
            contentPadding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            title: Text(
              t(dict, 'settings.reminder.timeLabel'),
              style: TextStyle(fontSize: 13, color: c.inkSoft),
            ),
            trailing: Text(
              s.reminder.format(context),
              style: TextStyle(color: c.inkSoft),
            ),
            onTap: () async {
              final picked = await showTimePicker(
                context: context,
                initialTime: s.reminder,
              );
              if (picked != null) ctrl.setReminder(picked);
            },
          ),
      ],
    );
  }
}

class _SettingRow extends StatelessWidget {
  const _SettingRow({
    required this.title,
    required this.description,
    required this.control,
    this.inlineControl = false,
  });

  final String title;
  final String description;
  final Widget control;

  /// Compact controls (a switch) sit on the title row; wide controls (a
  /// segmented picker) drop below the description.
  final bool inlineControl;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(
          description,
          style: TextStyle(fontSize: 12, color: c.muted, height: 1.3),
        ),
      ],
    );

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: inlineControl
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: text),
                const SizedBox(width: 12),
                control,
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [text, const SizedBox(height: 10), control],
            ),
    );
  }
}

class _Segmented<T> extends StatelessWidget {
  const _Segmented({
    required this.value,
    required this.onChanged,
    required this.options,
  });

  final T value;
  final ValueChanged<T> onChanged;
  final List<(T, String)> options;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: c.cream,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: c.rule),
      ),
      child: Row(
        children: [
          for (final (v, label) in options)
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(v),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: v == value ? c.paper : Colors.transparent,
                    borderRadius: BorderRadius.circular(6),
                    border: v == value ? Border.all(color: c.rule) : null,
                  ),
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      color: v == value ? c.ink : c.muted,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          fontSize: 10,
          letterSpacing: 1,
          color: context.colors.muted,
        ),
      ),
    );
  }
}
