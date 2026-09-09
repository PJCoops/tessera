import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../i18n.dart';
import '../i18n/dict.dart';
import '../settings/settings.dart';
import '../theme/tokens.dart';
import '../game/board_controller.dart';
import 'definitions_repository.dart';

/// "Today's words" (spec §9). English shows definitions from
/// dictionaryapi.dev (cached 30 days, non-blocking on failure); other
/// locales show the word list only with a "coming soon" note
/// (decision 19). Port of the "Today's words" view in app/HowToPlay.tsx.
class WordsScreen extends ConsumerWidget {
  const WordsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    final locale = ref.watch(settingsProvider.select((s) => s.locale));
    final puzzle = ref.watch(puzzleProvider);

    return Scaffold(
      backgroundColor: c.paper,
      appBar: AppBar(
        backgroundColor: c.paper,
        title: Text(t(dict, 'howto.titleWords')),
      ),
      body: puzzle.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => Center(
          child: Text(
            t(dict, 'game.loadError'),
            style: TextStyle(color: c.inkSoft),
          ),
        ),
        data: (p) {
          final words = p.goldRows;
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              if (locale == 'en')
                for (final w in words) _EnWordRow(word: w, dict: dict)
              else ...[
                for (final w in words)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text(
                      w.toUpperCase(),
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 1,
                        color: c.ink,
                      ),
                    ),
                  ),
                const SizedBox(height: 8),
                Text(
                  'Definitions coming soon.',
                  style: TextStyle(fontSize: 12, color: c.muted),
                ),
              ],
              if (locale == 'en') ...[
                const SizedBox(height: 12),
                Text(
                  t(dict, 'howto.words.attribution'),
                  style: TextStyle(fontSize: 10, color: c.muted),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _EnWordRow extends ConsumerWidget {
  const _EnWordRow({required this.word, required this.dict});

  final String word;
  final Map<String, dynamic> dict;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final def = ref.watch(definitionProvider(word.toLowerCase()));

    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            children: [
              Text(
                word.toUpperCase(),
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 1,
                  color: c.ink,
                ),
              ),
              if (def.valueOrNull?.partOfSpeech != null)
                Text(
                  def.value!.partOfSpeech!,
                  style: TextStyle(
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                    color: c.muted,
                  ),
                ),
              if (def.valueOrNull?.resolvedFrom != null)
                Text(
                  '${t(dict, 'howto.words.from')} ${def.value!.resolvedFrom}',
                  style: TextStyle(fontSize: 12, color: c.muted),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            def.when(
              loading: () => '…',
              error: (_, _) => t(dict, 'howto.words.missing'),
              data: (d) => d.definition ?? t(dict, 'howto.words.missing'),
            ),
            style: TextStyle(fontSize: 13, color: c.inkSoft),
          ),
        ],
      ),
    );
  }
}
