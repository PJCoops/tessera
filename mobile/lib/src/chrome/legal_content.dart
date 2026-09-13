/// Plain-text content for the in-app privacy policy and terms sheets
/// (legal_sheet.dart), kept in lockstep with the web copy at
/// app/privacy/page.tsx and app/terms/page.tsx. English only, matching web
/// (there is no es version of either page there either). Third-party
/// sub-processor privacy policies (Vercel, PostHog, Loops) and the ICO are
/// named but not linked — nothing in this file opens an external browser.
const legalLastUpdated = '26 May 2026';
const legalContactEmail = 'pjcooper.design@gmail.com';

class LegalSection {
  const LegalSection({this.heading, this.paragraphs = const [], this.bullets = const []});

  final String? heading;
  final List<String> paragraphs;
  final List<String> bullets;
}

List<LegalSection> privacySections() => [
  const LegalSection(
    paragraphs: [
      'This policy explains what data Tessera collects, why, and what you '
          'can do about it. Plain language, no surprises.',
    ],
  ),
  const LegalSection(
    heading: 'Who we are',
    paragraphs: [
      'Tessera Puzzle is run by Paul Cooper, sole trader, based in the '
          'United Kingdom. For anything to do with your data, email '
          '$legalContactEmail.',
    ],
  ),
  const LegalSection(
    heading: 'What we collect — if you just play the puzzle',
    bullets: [
      "A streak counter stored on your device. Never leaves it.",
      'Anonymous play stats by default, used in aggregate (how many people '
          'played today, how far they got). No persistent ID, no IP address '
          'stored.',
    ],
  ),
  const LegalSection(
    heading: 'What we collect — if you opt in to full analytics',
    bullets: [
      'A persistent anonymous identifier so we can see retention (did the '
          'same player return tomorrow?) and multi-day funnels.',
      'Your IP address, used to derive approximate country and then '
          'discarded by our analytics provider.',
    ],
  ),
  const LegalSection(
    heading: 'What we collect — if you sign up for the email list',
    bullets: [
      'Your email address, until you unsubscribe.',
      'Your locale (English or Spanish) so we can send the right version '
          'of the email.',
      'Where you signed up from. Used to understand which entry points '
          'work and to prove you opted in.',
      'The date and time you subscribed, recorded by our email provider.',
    ],
  ),
  const LegalSection(
    heading: 'Why we collect it',
    bullets: [
      'Anonymous play stats — understand how the game is used '
          '(legitimate interest).',
      'Full analytics (opt-in) — retention, cohort analysis (consent).',
      'Email signups — send updates you asked for (consent).',
    ],
  ),
  const LegalSection(
    heading: 'Who else sees it',
    bullets: [
      'Vercel, our hosting provider. They process visit metadata as part '
          "of serving the app's backend. See Vercel's own privacy policy "
          'for detail.',
      'PostHog (EU), our analytics provider. Data stays in the EU. See '
          "PostHog's own privacy policy for detail.",
      'Loops, our email provider, used only if you signed up for the '
          'daily reminder list. Loops is based in the United States; your '
          'email is transferred there under standard contractual clauses. '
          "See Loops's own privacy policy for detail.",
    ],
  ),
  const LegalSection(
    heading: 'How long we keep it',
    bullets: [
      'Anonymous analytics: 12 months rolling.',
      'Email signups: until you unsubscribe.',
    ],
  ),
  const LegalSection(
    heading: 'Your rights',
    paragraphs: ['Under UK and EU data protection law, you can:'],
    bullets: [
      'Ask what data we hold about you.',
      'Ask us to correct or delete it.',
      'Object to processing, or withdraw consent at any time.',
      'Ask for your data in a portable format.',
      "Complain to a regulator (the ICO in the UK; your local data "
          'protection authority in the EU).',
    ],
  ),
  const LegalSection(
    paragraphs: [
      'To exercise any of these, email $legalContactEmail. We’ll '
          'respond within 30 days.',
    ],
  ),
  const LegalSection(
    heading: 'Children',
    paragraphs: [
      "Tessera isn't aimed at under-13s and we don't knowingly collect "
          'data from them. If you believe a child has provided us data, '
          "email us and we'll delete it.",
    ],
  ),
  const LegalSection(
    heading: 'Changes',
    paragraphs: [
      'We’ll update the date at the top when this changes. If the '
          "change is material, we'll surface a notice in-app.",
    ],
  ),
  const LegalSection(
    heading: 'Complaints',
    paragraphs: [
      "If we've got something wrong, please tell us first at "
          '$legalContactEmail. You can also complain to the UK Information '
          "Commissioner's Office (ico.org.uk).",
    ],
  ),
];

List<LegalSection> termsSections() => [
  const LegalSection(
    paragraphs: [
      "Tessera is a free daily word puzzle. By playing, you agree to "
          "these terms. They're short on purpose.",
    ],
  ),
  const LegalSection(
    heading: 'Who runs the game',
    paragraphs: [
      'Tessera Puzzle is operated by Paul Cooper, sole trader, based in '
          'the United Kingdom. Contact: $legalContactEmail.',
    ],
  ),
  const LegalSection(
    heading: 'Using the puzzle',
    paragraphs: ['You can play freely. We ask you not to:'],
    bullets: [
      'Scrape or automate solves for the daily puzzle.',
      "Publish the day's solution before midnight UTC.",
      "Attempt to disrupt the service or other players' experience.",
      'Use Tessera to break the law.',
    ],
  ),
  const LegalSection(
    heading: 'Ownership',
    paragraphs: [
      'The puzzles, code, and designs are owned by Paul Cooper. You can '
          "play, share scores, and link to the app. You can't reproduce "
          'the puzzles or designs commercially without written permission.',
    ],
  ),
  const LegalSection(
    heading: 'Service availability',
    paragraphs: [
      "We try to keep Tessera available every day, but we don't "
          'guarantee uptime. The puzzle may occasionally be unavailable '
          'for maintenance, hosting issues, or causes outside our control.',
    ],
  ),
  const LegalSection(
    heading: 'Changes',
    paragraphs: [
      'We may update these terms occasionally. The "last updated" date '
          'at the top shows when. Material changes will be flagged '
          'in-app. Continued play after a non-material change means you '
          'accept the update.',
    ],
  ),
  const LegalSection(
    heading: 'Liability',
    paragraphs: [
      "Tessera is provided as-is. We aren't liable for losses arising "
          'from your use of the app or its unavailability, except where '
          "the law doesn't allow us to exclude liability (for example, "
          'fraud or death and personal injury caused by negligence). Our '
          'total liability to you is capped at £100.',
    ],
  ),
  const LegalSection(
    heading: 'Termination',
    paragraphs: [
      'You can stop using Tessera any time, and clear your data via '
          'Settings → Delete account. We may suspend or remove access '
          'for anyone who breaks these terms.',
    ],
  ),
  const LegalSection(
    heading: 'Governing law',
    paragraphs: [
      'These terms are governed by the laws of England and Wales. '
          'Disputes will be resolved in the courts of England and Wales.',
    ],
  ),
  const LegalSection(
    heading: 'Contact',
    paragraphs: [
      'Questions about these terms? Email $legalContactEmail.',
    ],
  ),
];
