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

/// One league: today's board (members only) + the all-time "days won"
/// tally. Each non-`isMe` board row gets a report action (§12.3) — a
/// lightweight flag, not a moderation tool: it just posts to the server
/// and acks, the row stays on the board.
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
            if (inviteCode != null) ...[
              _InviteCard(dict: dict, name: name, code: inviteCode),
              const SizedBox(height: 24),
            ],
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
              for (final e in standings.board)
                _StandingsRow(
                  dict: dict,
                  entry: e,
                  onReport: e.isMe
                      ? null
                      : () => _confirmReport(context, ref, dict, e.handle),
                ),
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

  Future<void> _confirmReport(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> dict,
    String handle,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t(dict, 'leaderboard.reportConfirmTitle')),
        content: Text(t(dict, 'leaderboard.reportConfirmBody')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(t(dict, 'leagues.back')),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(t(dict, 'leaderboard.reportScore')),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;

    try {
      await ref.read(leaderboardClientProvider).reportScore(mode, num, handle);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t(dict, 'leaderboard.reportSent'))),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t(dict, 'leaderboard.reportError'))),
      );
    }
  }
}

/// A hard-to-miss invite affordance: the code itself (tap to copy) plus a
/// share button — replaces the earlier app-bar icon, which had no visible
/// code and no instructions (PJ feedback: "easy to miss and doesn't
/// reveal the league invite code").
class _InviteCard extends StatefulWidget {
  const _InviteCard({required this.dict, required this.name, required this.code});

  final Map<String, dynamic> dict;
  final String name;
  final String code;

  @override
  State<_InviteCard> createState() => _InviteCardState();
}

class _InviteCardState extends State<_InviteCard> {
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
    final dict = widget.dict;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.cream,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: c.rule),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            t(dict, 'leagues.inviteFriends').toUpperCase(),
            style: TextStyle(fontSize: 10, letterSpacing: 1, color: c.muted),
          ),
          const SizedBox(height: 4),
          Text(
            t(dict, 'leagues.inviteInstructions', {'name': widget.name}),
            style: TextStyle(fontSize: 12, color: c.inkSoft),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: InkWell(
                  key: const Key('invite-code-tap'),
                  borderRadius: BorderRadius.circular(8),
                  onTap: _copy,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                    decoration: BoxDecoration(
                      color: c.paper,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: c.rule),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          widget.code,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 2,
                            color: c.ink,
                          ),
                        ),
                        Icon(
                          _copied ? Icons.check : Icons.copy,
                          size: 16,
                          color: _copied ? c.solved : c.muted,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (_copied) ...[
            const SizedBox(height: 4),
            Text(
              t(dict, 'leagues.copied'),
              style: TextStyle(fontSize: 11, color: c.solved),
            ),
          ],
          const SizedBox(height: 12),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: c.ink,
              foregroundColor: c.paper,
              minimumSize: const Size.fromHeight(44),
            ),
            onPressed: () => shareInvite(context, widget.name, widget.code),
            icon: const Icon(Icons.ios_share, size: 16),
            label: Text(t(dict, 'leagues.shareInvite')),
          ),
        ],
      ),
    );
  }
}

class _StandingsRow extends StatelessWidget {
  const _StandingsRow({required this.dict, required this.entry, this.onReport});

  final Map<String, dynamic> dict;
  final LeaderboardEntry entry;
  final VoidCallback? onReport;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(width: 24, child: Text('${entry.rank}', style: TextStyle(fontSize: 13, color: c.muted))),
          Expanded(
            child: Row(
              children: [
                Flexible(
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
                const SizedBox(width: 4),
                Tooltip(
                  message: t(dict, 'leaderboard.verifiedTooltip'),
                  child: Icon(Icons.verified, size: 13, color: c.muted),
                ),
              ],
            ),
          ),
          Text('${entry.moves}', style: TextStyle(fontSize: 13, color: c.ink)),
          if (onReport != null)
            IconButton(
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              icon: Icon(Icons.flag_outlined, size: 16, color: c.muted),
              tooltip: t(dict, 'leaderboard.reportScore'),
              onPressed: onReport,
            )
          else
            const SizedBox(width: 32),
        ],
      ),
    );
  }
}
