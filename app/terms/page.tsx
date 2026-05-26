import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: "Rules for using Tessera Puzzle.",
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "26 May 2026";
const CONTACT_EMAIL = "pjcooper.design@gmail.com";

export default function TermsPage() {
  return (
    <LegalPage title="Terms and conditions" lastUpdated={LAST_UPDATED}>
      <p>
        Tessera is a free daily word puzzle. By playing, you agree to these
        terms. They&apos;re short on purpose.
      </p>

      <h2>Who runs the game</h2>
      <p>
        Tessera Puzzle is operated by Paul Cooper, sole trader, based in the
        United Kingdom. Contact:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>Using the puzzle</h2>
      <p>You can play freely. We ask you not to:</p>
      <ul>
        <li>Scrape or automate solves for the daily puzzle.</li>
        <li>Publish the day&apos;s solution before midnight UTC.</li>
        <li>Attempt to disrupt the service or other players&apos; experience.</li>
        <li>Use Tessera to break the law.</li>
      </ul>

      <h2>Ownership</h2>
      <p>
        The puzzles, code, and designs are owned by Paul Cooper. You can play,
        share scores, and link to the site. You can&apos;t reproduce the
        puzzles or designs commercially without written permission.
      </p>

      <h2>Service availability</h2>
      <p>
        We try to keep Tessera available every day, but we don&apos;t
        guarantee uptime. The puzzle may occasionally be unavailable for
        maintenance, hosting issues, or causes outside our control.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms occasionally. The &quot;last updated&quot;
        date at the top shows when. Material changes will be flagged in-app.
        Continued play after a non-material change means you accept the
        update.
      </p>

      <h2>Liability</h2>
      <p>
        Tessera is provided as-is. We aren&apos;t liable for losses arising
        from your use of the site or its unavailability, except where the law
        doesn&apos;t allow us to exclude liability (for example, fraud or
        death and personal injury caused by negligence). Our total liability
        to you is capped at £100.
      </p>

      <h2>Termination</h2>
      <p>
        You can stop using Tessera any time, and clear your data via your
        browser settings. We may suspend or remove access for anyone who
        breaks these terms.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of England and Wales. Disputes
        will be resolved in the courts of England and Wales.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
