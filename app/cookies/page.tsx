import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Cookie policy",
  description: "Cookies and tracking used by Tessera.",
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "26 May 2026";

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie policy" lastUpdated={LAST_UPDATED}>
      <p>
        We use cookies and similar storage (like localStorage) for three things:
        keeping your game state, understanding how the puzzle is played, and
        measuring whether our ads work. You control most of this.
      </p>

      <h2>Categories</h2>

      <h3>Strictly necessary</h3>
      <p>
        Always on. Without these the game can&apos;t function. We store your
        preferences (theme, locale), your puzzle progress, your streak, and
        your cookie choices.
      </p>

      <h3>Analytics (opt-in upgrade)</h3>
      <p>
        Anonymous stats run by default and never require consent. If you opt
        in, we upgrade analytics to include a persistent anonymous ID so we can
        understand retention, cohorts, and longer-term funnels. Provided by
        PostHog, hosted in the EU.
      </p>

      <h3>Marketing</h3>
      <p>
        Off by default. If you opt in, we load tags from X and Reddit so we
        can measure whether our ads on those platforms led to you visiting.
      </p>

      <h2>Specific cookies and storage</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Where</th>
            <th>Purpose</th>
            <th>Expiry</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>tessera_consent</td>
            <td>First-party cookie</td>
            <td>Your cookie choices</td>
            <td>12 months</td>
            <td>Necessary</td>
          </tr>
          <tr>
            <td>tessera:streak</td>
            <td>localStorage</td>
            <td>Your current and best streak</td>
            <td>Until cleared</td>
            <td>Necessary</td>
          </tr>
          <tr>
            <td>tessera:theme</td>
            <td>localStorage</td>
            <td>Light / dark / system</td>
            <td>Until cleared</td>
            <td>Necessary</td>
          </tr>
          <tr>
            <td>ph_*</td>
            <td>localStorage (PostHog)</td>
            <td>Persistent anonymous ID for retention analytics</td>
            <td>12 months</td>
            <td>Analytics (only if opted in)</td>
          </tr>
          <tr>
            <td>_twq_*, muc_ads, personalization_id</td>
            <td>X cookies</td>
            <td>Ad attribution for X campaigns</td>
            <td>Up to 2 years</td>
            <td>Marketing (only if opted in)</td>
          </tr>
        </tbody>
      </table>

      <h2>Changing your mind</h2>
      <p>
        Use the &quot;Cookie preferences&quot; link in the footer at any time.
        Withdrawing consent clears the relevant cookies and stops the
        associated scripts loading on future visits.
      </p>

      <h2>Other browser storage</h2>
      <p>
        We use localStorage for things the cookie law treats as cookies even
        though they technically aren&apos;t. Same rules apply.
      </p>

      <h2>Questions</h2>
      <p>
        See the <a href="/privacy">privacy policy</a> for the full picture, or
        email <a href="mailto:pjcooper.design@gmail.com">pjcooper.design@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
