import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/account_client.dart' show AccountApiException;
import '../auth/auth_controller.dart';
import '../auth/sign_in_sheet.dart';
import '../clock.dart';
import '../epoch.dart';
import '../i18n.dart';
import '../i18n/dict.dart';
import '../mode.dart';
import '../puzzle_number.dart';
import '../settings/settings.dart';
import '../theme/tokens.dart';
import 'leaderboard_client.dart';
import 'leaderboard_providers.dart';
import 'league_standings_screen.dart';

/// Port of the web's LeaderboardModal + LeaguesPanel (app/components/).
/// Global/Country boards for today's puzzle, plus a Leagues tab (list,
/// join by code, create). Every row the server returns is already
/// filtered to a verified, non-revealed replay, so "verified" is a static
/// badge on each row rather than a per-row flag.
class LeaderboardScreen extends ConsumerStatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  ConsumerState<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends ConsumerState<LeaderboardScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this);
  ModeId? _mode;

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final mode = _mode ??= ref.read(settingsProvider).modeId;
    final today = puzzleNumber(todayUtcDate(), kEpoch);

    return Scaffold(
      backgroundColor: c.paper,
      appBar: AppBar(
        backgroundColor: c.paper,
        title: Text(t(dict, 'leaderboard.title')),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(96),
          child: Column(
            children: [
              _ModeToggle(
                value: mode,
                onChanged: (m) => setState(() => _mode = m),
                labels: (t(dict, 'history.mode.classic'), t(dict, 'history.mode.hard')),
              ),
              const SizedBox(height: 8),
              TabBar(
                controller: _tabs,
                labelColor: c.ink,
                unselectedLabelColor: c.muted,
                indicatorColor: c.ink,
                tabs: [
                  Tab(text: t(dict, 'leaderboard.tabGlobal')),
                  Tab(text: t(dict, 'leaderboard.tabCountry')),
                  Tab(text: t(dict, 'leaderboard.tabLeagues')),
                ],
              ),
            ],
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _BoardTab(mode: mode, num: today, country: false),
          _BoardTab(mode: mode, num: today, country: true),
          _LeaguesTab(mode: mode, num: today),
        ],
      ),
    );
  }
}

class _ModeToggle extends StatelessWidget {
  const _ModeToggle({
    required this.value,
    required this.onChanged,
    required this.labels,
  });

  final ModeId value;
  final ValueChanged<ModeId> onChanged;
  final (String, String) labels;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    Widget seg(ModeId id, String label) {
      final active = id == value;
      return GestureDetector(
        onTap: () => onChanged(id),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: active ? c.paper : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
            border: active ? Border.all(color: c.rule) : null,
          ),
          child: Text(
            label,
            style: TextStyle(fontSize: 12, color: active ? c.ink : c.muted),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: c.cream,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: c.rule),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          seg(ModeId.classic, labels.$1),
          seg(ModeId.hard, labels.$2),
        ],
      ),
    );
  }
}

class _BoardTab extends ConsumerWidget {
  const _BoardTab({required this.mode, required this.num, required this.country});

  final ModeId mode;
  final int num;
  final bool country;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final async = ref.watch(leaderboardProvider((mode: mode, num: num)));

    return async.when(
      loading: () => Center(
        child: Text(t(dict, 'leaderboard.loading'), style: TextStyle(color: c.muted)),
      ),
      error: (_, _) => Center(
        child: Text(t(dict, 'game.loadError'), style: TextStyle(color: c.muted)),
      ),
      data: (res) {
        final entries = country ? res.country.entries : res.global;
        final me = country ? res.meCountry : res.meGlobal;
        final inList = me != null && entries.any((e) => e.isMe);

        if (!res.signedIn) {
          return _CenteredMessage(text: t(dict, 'leaderboard.signInPrompt'));
        }
        if (!res.hasHandle) {
          return _CenteredMessage(text: t(dict, 'leaderboard.optInPrompt'));
        }
        if (entries.isEmpty) {
          return _CenteredMessage(text: t(dict, 'leaderboard.empty'));
        }

        return ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          children: [
            _BoardHeader(dict: dict),
            for (final e in entries) _BoardRow(dict: dict, entry: e),
            if (me != null && !inList) ...[
              const SizedBox(height: 8),
              Text(
                t(dict, 'leaderboard.yourRank').toUpperCase(),
                style: TextStyle(fontSize: 10, letterSpacing: 1, color: c.muted),
              ),
              _BoardRow(dict: dict, entry: me),
            ],
          ],
        );
      },
    );
  }
}

class _CenteredMessage extends StatelessWidget {
  const _CenteredMessage({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 14, color: c.muted),
        ),
      ),
    );
  }
}

class _BoardHeader extends StatelessWidget {
  const _BoardHeader({required this.dict});
  final Map<String, dynamic> dict;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final style = TextStyle(fontSize: 10, letterSpacing: 0.5, color: c.muted);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(width: 28, child: Text(t(dict, 'leaderboard.colRank'), style: style)),
          Expanded(child: Text(t(dict, 'leaderboard.colPlayer'), style: style)),
          SizedBox(
            width: 56,
            child: Text(t(dict, 'leaderboard.colMoves'), textAlign: TextAlign.right, style: style),
          ),
          SizedBox(
            width: 56,
            child: Text(t(dict, 'leaderboard.colTime'), textAlign: TextAlign.right, style: style),
          ),
        ],
      ),
    );
  }
}

/// One board row: rank, handle (+ a static "verified" mark — every row the
/// server returns is already a verified, non-revealed replay), moves, time.
class _BoardRow extends StatelessWidget {
  const _BoardRow({required this.dict, required this.entry});

  final Map<String, dynamic> dict;
  final LeaderboardEntry entry;

  static String _fmtTime(int? ms) {
    if (ms == null) return '–';
    final total = ms ~/ 1000;
    final m = total ~/ 60;
    final s = total % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(
            width: 28,
            child: Text(
              '${entry.rank}',
              style: TextStyle(fontSize: 13, color: c.muted),
            ),
          ),
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
          SizedBox(
            width: 56,
            child: Text(
              '${entry.moves}',
              textAlign: TextAlign.right,
              style: TextStyle(fontSize: 13, color: c.ink),
            ),
          ),
          SizedBox(
            width: 56,
            child: Text(
              _fmtTime(entry.timeMs),
              textAlign: TextAlign.right,
              style: TextStyle(fontSize: 13, color: c.muted),
            ),
          ),
        ],
      ),
    );
  }
}

class _LeaguesTab extends ConsumerWidget {
  const _LeaguesTab({required this.mode, required this.num});
  final ModeId mode;
  final int num;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final async = ref.watch(myLeaguesProvider);

    return async.when(
      loading: () => Center(
        child: Text(t(dict, 'leaderboard.loading'), style: TextStyle(color: c.muted)),
      ),
      error: (_, _) => Center(
        child: Text(t(dict, 'game.loadError'), style: TextStyle(color: c.muted)),
      ),
      data: (leagues) => ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (leagues.isEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(
                t(dict, 'leagues.empty'),
                style: TextStyle(fontSize: 14, color: c.muted),
              ),
            )
          else
            for (final l in leagues) _LeagueRow(dict: dict, league: l, mode: mode, num: num),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => _showJoinDialog(context, ref, dict),
            child: Text(t(dict, 'leagues.joinButton')),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => _showCreateDialog(context, ref, dict),
            child: Text(t(dict, 'leagues.createButton')),
          ),
        ],
      ),
    );
  }

  Future<void> _showJoinDialog(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> dict,
  ) async {
    final controller = TextEditingController();
    final code = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t(dict, 'leagues.join')),
        content: TextField(
          controller: controller,
          textCapitalization: TextCapitalization.characters,
          decoration: InputDecoration(hintText: t(dict, 'leagues.codePlaceholder')),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(t(dict, 'leagues.back')),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: Text(t(dict, 'leagues.joinButton')),
          ),
        ],
      ),
    );
    if (code == null || code.isEmpty || !context.mounted) return;

    // Manual code entry is itself the explicit join gesture (typing the
    // code + tapping Join) — the "confirmation screen, never a silent
    // auto-join" requirement (§12.2) is specifically about a deep-link
    // tap auto-joining without the user asking; that flow isn't wired
    // this phase (see docs/mobile-accounts-setup.md / spec §22 Phase 5).
    try {
      final league = await ref.read(leaderboardClientProvider).joinLeague(code);
      ref.invalidate(myLeaguesProvider);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t(dict, 'leagues.joinedToast', {'name': league.name}))),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t(dict, 'leagues.notFound'))),
      );
    }
  }

  Future<void> _showCreateDialog(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> dict,
  ) async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t(dict, 'leagues.create')),
        content: TextField(
          controller: controller,
          decoration: InputDecoration(hintText: t(dict, 'leagues.namePlaceholder')),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(t(dict, 'leagues.back')),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: Text(t(dict, 'leagues.create')),
          ),
        ],
      ),
    );
    if (name == null || name.isEmpty || !context.mounted) return;

    try {
      final league = await ref.read(leaderboardClientProvider).createLeague(name);
      ref.invalidate(myLeaguesProvider);
      if (!context.mounted) return;
      // Straight to standings — its share icon is how you invite people,
      // and a brand-new league has nothing else to show yet.
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => LeagueStandingsScreen(
            leagueId: league.id,
            name: league.name,
            mode: mode,
            num: num,
          ),
        ),
      );
    } on AccountApiException catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t(dict, 'leagues.notFound'))),
      );
    }
  }
}

class _LeagueRow extends StatelessWidget {
  const _LeagueRow({
    required this.dict,
    required this.league,
    required this.mode,
    required this.num,
  });

  final Map<String, dynamic> dict;
  final LeagueSummary league;
  final ModeId mode;
  final int num;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return InkWell(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) =>
              LeagueStandingsScreen(leagueId: league.id, name: league.name, mode: mode, num: num),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(league.name, style: TextStyle(fontSize: 14, color: c.ink)),
            Row(
              children: [
                Text(
                  t(dict, 'leagues.members', {'n': league.memberCount}),
                  style: TextStyle(fontSize: 12, color: c.muted),
                ),
                Icon(Icons.chevron_right, size: 18, color: c.muted),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Handles a tapped league-invite link (`deep_links/deep_links.dart`
/// parsed the code out already). Signs the player in first if needed
/// (mirrors the web's app/TesseraGame.tsx — open the sign-in sheet, finish
/// once signed in), then a confirmation dialog before actually joining —
/// unlike the web, which joins silently (§12.2 requires this on mobile).
/// No preview endpoint exists to show the league's name up front, so the
/// confirmation is code-only; the toast after joining shows the name.
Future<void> handleJoinLinkCode(BuildContext context, WidgetRef ref, String code) async {
  final dict = ref.read(dictOrEmptyProvider);

  if (ref.read(authUserProvider) == null) {
    await showSignInSheet(context);
    if (!context.mounted || ref.read(authUserProvider) == null) return;
  }
  if (!context.mounted) return;

  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(t(dict, 'leagues.joinConfirmTitle', {'name': code})),
      content: Text(t(dict, 'leagues.joinConfirmBody')),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: Text(t(dict, 'leagues.back')),
        ),
        FilledButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(t(dict, 'leagues.joinButton')),
        ),
      ],
    ),
  );
  if (ok != true || !context.mounted) return;

  final mode = ref.read(settingsProvider).modeId;
  final today = puzzleNumber(todayUtcDate(), kEpoch);
  try {
    final league = await ref.read(leaderboardClientProvider).joinLeague(code);
    ref.invalidate(myLeaguesProvider);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(t(dict, 'leagues.joinedToast', {'name': league.name}))),
    );
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => LeagueStandingsScreen(
          leagueId: league.id,
          name: league.name,
          mode: mode,
          num: today,
        ),
      ),
    );
  } catch (_) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(t(dict, 'leagues.notFound'))),
    );
  }
}
