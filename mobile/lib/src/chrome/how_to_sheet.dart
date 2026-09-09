import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../i18n.dart';
import '../i18n/dict.dart';
import '../theme/tokens.dart';
import 'legend.dart';

/// The dismissible, re-openable how-to sheet (spec §16.1). Port of the
/// "How to play" tab in app/HowToPlay.tsx. Opened from the game top bar
/// and from Settings.
Future<void> showHowToSheet(BuildContext context, {required int n}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: context.colors.paper,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _HowToBody(n: n),
  );
}

class _HowToBody extends ConsumerWidget {
  const _HowToBody({required this.n});

  final int n;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final dict = ref.watch(dictOrEmptyProvider);
    String tr(String key, [Map<String, Object>? vars]) => t(dict, key, vars);
    final wordCount = n * 2;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                tr('howto.title'),
                style: TextStyle(
                  fontFamily: 'Fraunces',
                  fontSize: 24,
                  fontWeight: FontWeight.w300,
                  color: c.ink,
                ),
              ),
              const SizedBox(height: 20),
              _Step(
                n: 1,
                title: tr('howto.step1.title'),
                body: tr('howto.step1.body', {'wordCount': wordCount, 'n': n}),
              ),
              _Step(
                n: 2,
                title: tr('howto.step2.title'),
                body: tr('howto.step2.body'),
              ),
              _Step(
                n: 3,
                title: tr('howto.step3.title'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _LegendRow(
                      variant: LegendVariant.hint,
                      text: tr('howto.step3.dashed'),
                    ),
                    _LegendRow(
                      variant: LegendVariant.row,
                      text: tr('howto.step3.green'),
                    ),
                    _LegendRow(
                      variant: LegendVariant.bonus,
                      text: tr('howto.step3.complete', {'n': n}),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: c.ink,
                    foregroundColor: c.paper,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text(tr('howto.play')),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.n, required this.title, this.body, this.child});

  final int n;
  final String title;
  final String? body;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(color: c.cream, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Text(
              '$n',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 13,
                color: c.ink,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(fontWeight: FontWeight.w600, color: c.ink),
                ),
                const SizedBox(height: 4),
                if (body != null)
                  Text(body!, style: TextStyle(fontSize: 13, color: c.muted)),
                if (child != null) ...[const SizedBox(height: 8), child!],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LegendRow extends StatelessWidget {
  const _LegendRow({required this.variant, required this.text});

  final LegendVariant variant;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: Legend(variant: variant),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 13,
                color: context.colors.muted,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
