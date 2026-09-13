import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../i18n.dart';
import '../i18n/dict.dart';
import '../mode.dart';
import '../share_position.dart';
import '../theme/tokens.dart';
import 'leaderboard_client.dart';
import 'leaderboard_providers.dart';

/// The web's shareable join link (app/components/LeaguesPanel.tsx uses the
/// same `/?join=<code>` path). The app doesn't handle this link itself yet
/// (deep-link wiring is deferred — see the Phase 5 plan), but it's a real,
/// join-able link for whoever's on the web app already, and the code
/// alone still works for manual entry on mobile.
String inviteLink(String code) => 'https://tesserapuzzle.com/?join=$code';

Future<void> shareInvite(BuildContext context, String name, String code) => Share.share(
  'Join my Tessera league "$name": ${inviteLink(code)}',
  sharePositionOrigin: sharePositionOrigin(context),
);

/// One league: today's board (members only) + the all-time "days won" tally.
class LeagueStandingsScreen extends ConsumerWidget {
  const LeagueStandingsScreen({
    super.key,
    required this.leagueId,
    required this.name,
    required this.mode,
    required this.num,
  });

  final String leagueId;
  final String name;
  final ModeId mode;
  final int num;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final args = (leagueId: leagueId, mode: mode, num: num);
    final async = ref.watch(leagueStandingsProvider(args));

    final inviteCode = async.valueOrNull?.league.inviteCode;
    return Scaffold(
      backgroundColor: c.paper,
      appBar: AppBar(backgroundColor: c.paper, title: Text(name)),
      bottomNavigationBar: inviteCode == null
          ? null
          : SafeArea(
              minimum: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: c.ink,
                  foregroundColor: c.paper,
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: () => showInviteSheet(context, name, inviteCode),
                icon: const Icon(Icons.person_add_alt_1, size: 18),
                label: Text(t(dict, 'leagues.invite')),
              ),
            ),
      body: async.when(
        loading: () => Center(
          child: Text(t(dict, 'leaderboard.loading'), style: TextStyle(color: c.muted)),
        ),
        error: (_, _) => Center(
          child: Text(t(dict, 'game.loadError'), style: TextStyle(color: c.muted)),
        ),
        data: (standings) => ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (!standings.hasHandle)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  t(dict, 'leagues.noHandlePrompt'),
                  style: TextStyle(fontSize: 13, color: c.muted),
                ),
              ),
            Text(
              t(dict, 'leagues.today').toUpperCase(),
              style: TextStyle(fontSize: 10, letterSpacing: 1, color: c.muted),
            ),
            const SizedBox(height: 8),
            if (standings.board.isEmpty)
              Text(
                t(dict, 'leagues.noneToday'),
                style: TextStyle(fontSize: 13, color: c.muted),
              )
            else
              for (final e in standings.board) _StandingsRow(entry: e),
            const SizedBox(height: 24),
            Text(
              t(dict, 'leagues.daysWon').toUpperCase(),
              style: TextStyle(fontSize: 10, letterSpacing: 1, color: c.muted),
            ),
            const SizedBox(height: 8),
            for (final tly in standings.tally)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      tly.handle,
                      style: TextStyle(
                        fontSize: 13,
                        color: c.ink,
                        fontWeight: tly.isMe ? FontWeight.w700 : FontWeight.w400,
                      ),
                    ),
                    Text('${tly.daysWon}', style: TextStyle(fontSize: 13, color: c.muted)),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// The invite bottom sheet: instructions, the code (tap to copy), and a
/// share button. Replaces an earlier inline card and, before that, an
/// app-bar icon — PJ feedback both times was that it needed to be a
/// clearer, dedicated moment rather than competing with the board for
/// attention, and that the native share sheet alone (no code visible,
/// full-screen) was too heavy as the *only* way to invite someone.
Future<void> showInviteSheet(BuildContext context, String name, String code) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: context.colors.paper,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _InviteSheetBody(name: name, code: code),
  );
}

class _InviteSheetBody extends ConsumerStatefulWidget {
  const _InviteSheetBody({required this.name, required this.code});

  final String name;
  final String code;

  @override
  ConsumerState<_InviteSheetBody> createState() => _InviteSheetBodyState();
}

class _InviteSheetBodyState extends ConsumerState<_InviteSheetBody> {
  bool _copied = false;

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.code));
    if (!mounted) return;
    setState(() => _copied = true);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(24, 4, 24, 24 + MediaQuery.of(context).viewInsets.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              t(dict, 'leagues.inviteFriends'),
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 22,
                fontWeight: FontWeight.w300,
                color: c.ink,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              t(dict, 'leagues.inviteInstructions', {'name': widget.name}),
              style: TextStyle(fontSize: 13, color: c.muted),
            ),
            const SizedBox(height: 20),
            InkWell(
              key: const Key('invite-code-tap'),
              borderRadius: BorderRadius.circular(10),
              onTap: _copy,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 18),
                decoration: BoxDecoration(
                  color: c.cream,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: c.rule),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      widget.code,
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 3,
                        color: c.ink,
                      ),
                    ),
                    Icon(
                      _copied ? Icons.check : Icons.copy,
                      size: 18,
                      color: _copied ? c.solved : c.muted,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _copied ? t(dict, 'leagues.copied') : t(dict, 'leagues.tapToCopy'),
              style: TextStyle(fontSize: 11, color: _copied ? c.solved : c.muted),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: c.ink,
                foregroundColor: c.paper,
                minimumSize: const Size.fromHeight(48),
              ),
              onPressed: () => shareInvite(context, widget.name, widget.code),
              icon: const Icon(Icons.ios_share, size: 16),
              label: Text(t(dict, 'leagues.shareButton')),
            ),
          ],
        ),
      ),
    );
  }
}

class _StandingsRow extends StatelessWidget {
  const _StandingsRow({required this.entry});

  final LeaderboardEntry entry;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(width: 24, child: Text('${entry.rank}', style: TextStyle(fontSize: 13, color: c.muted))),
          Expanded(
            child: Text(
              entry.handle,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 13,
                color: c.ink,
                fontWeight: entry.isMe ? FontWeight.w700 : FontWeight.w400,
              ),
            ),
          ),
          Text('${entry.moves}', style: TextStyle(fontSize: 13, color: c.ink)),
        ],
      ),
    );
  }
}
