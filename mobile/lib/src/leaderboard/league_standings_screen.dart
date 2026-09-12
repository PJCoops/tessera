import 'package:flutter/material.dart';
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
      appBar: AppBar(
        backgroundColor: c.paper,
        title: Text(name),
        actions: [
          IconButton(
            tooltip: t(dict, 'leagues.shareInvite'),
            icon: const Icon(Icons.ios_share),
            onPressed: inviteCode == null
                ? null
                : () => shareInvite(context, name, inviteCode),
          ),
        ],
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
