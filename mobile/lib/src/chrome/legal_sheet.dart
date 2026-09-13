import 'package:flutter/material.dart';

import '../theme/tokens.dart';
import 'legal_content.dart';

/// A scrollable, native in-app sheet for legal copy (privacy / terms) —
/// replaces linking out to tesserapuzzle.com so the app never has to leave
/// itself just to show text. Draggable rather than a fixed-height modal
/// since the content runs well past one screen.
Future<void> showLegalSheet(
  BuildContext context, {
  required String title,
  required List<LegalSection> sections,
}) {
  final c = context.colors;
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: c.paper,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => SafeArea(
        top: false,
        child: ListView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
          children: [
            Text(
              title,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 22,
                fontWeight: FontWeight.w300,
                color: c.ink,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Last updated $legalLastUpdated',
              style: TextStyle(fontSize: 12, color: c.muted),
            ),
            const SizedBox(height: 16),
            for (final section in sections) _SectionView(section: section),
          ],
        ),
      ),
    ),
  );
}

class _SectionView extends StatelessWidget {
  const _SectionView({required this.section});

  final LegalSection section;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (section.heading != null) ...[
            Text(
              section.heading!,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 15,
                color: c.ink,
              ),
            ),
            const SizedBox(height: 6),
          ],
          for (final p in section.paragraphs)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: SelectableText(
                p,
                style: TextStyle(fontSize: 13, color: c.inkSoft, height: 1.4),
              ),
            ),
          for (final b in section.bullets)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '• ',
                    style: TextStyle(fontSize: 13, color: c.muted),
                  ),
                  Expanded(
                    child: SelectableText(
                      b,
                      style: TextStyle(
                        fontSize: 13,
                        color: c.inkSoft,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
