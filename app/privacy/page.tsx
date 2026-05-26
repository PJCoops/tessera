import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Tessera handles your data.",
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "26 May 2026";
const CONTACT_EMAIL = "pjcooper.design@gmail.com";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" lastUpdated={LAST_UPDATED}>
      <p>
        This policy explains what data Tessera collects, why, and what you can
        do about it. Plain language, no surprises.
      </p>

      <h2>Who we are</h2>
      <p>
        Tessera Puzzle is run by Paul Cooper, sole trader, based in the United
        Kingdom. For anything to do with your data, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>What we collect</h2>

      <h3>If you just play the puzzle</h3>
      <ul>
        <li>
          A streak counter stored in your browser&apos;s localStorage. Never
          leaves your device.
        </li>
        <li>
          Anonymous play stats by default, used in aggregate (how many people
          played today, how far they got). No persistent ID, no IP address
          stored.
        </li>
      </ul>

      <h3>If you opt in to full analytics</h3>
      <ul>
        <li>
          A persistent anonymous identifier so we can see retention (did the
          same player return tomorrow?) and multi-day funnels.
        </li>
        <li>
          Your IP address, used to derive approximate country and then
          discarded by our analytics provider.
        </li>
      </ul>

      <h3>If you opt in to marketing</h3>
      <ul>
        <li>
          Anonymous event signals shared with X and Reddit so we can measure
          whether ads on those platforms brought you here.
        </li>
      </ul>

      <h3>If you sign up for the email list</h3>
      <ul>
        <li>Your email address, until you unsubscribe.</li>
        <li>
          Your locale (English or Spanish) so we can send the right version of
          the email.
        </li>
        <li>
          Where on the site you signed up from. Used to understand which entry
          points work and to prove you opted in.
        </li>
        <li>
          The date and time you subscribed, recorded by our email provider.
        </li>
      </ul>

      <h2>Why we collect it</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Why</th>
            <th>Legal basis</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Anonymous play stats</td>
            <td>Understand how the game is used</td>
            <td>Legitimate interest</td>
          </tr>
          <tr>
            <td>Full analytics (opt-in)</td>
            <td>Retention, cohort analysis</td>
            <td>Consent</td>
          </tr>
          <tr>
            <td>Marketing pixels (opt-in)</td>
            <td>Measure ad effectiveness</td>
            <td>Consent</td>
          </tr>
          <tr>
            <td>Email signups</td>
            <td>Send updates you asked for</td>
            <td>Consent</td>
          </tr>
        </tbody>
      </table>

      <h2>Who else sees it</h2>
      <ul>
        <li>
          <strong>Vercel</strong>, our hosting provider. They process visit
          metadata as part of serving the site.{" "}
          <a
            href="https://vercel.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vercel privacy policy
          </a>
          .
        </li>
        <li>
          <strong>PostHog (EU)</strong>, our analytics provider. Data stays in
          the EU.{" "}
          <a
            href="https://posthog.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            PostHog privacy policy
          </a>
          .
        </li>
        <li>
          <strong>Loops</strong>, our email provider. Used only if you signed
          up for the daily reminder list. Loops is based in the United States;
          your email is transferred there under standard contractual clauses.{" "}
          <a
            href="https://loops.so/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Loops privacy policy
          </a>
          .
        </li>
        <li>
          <strong>X and Reddit</strong>, only if you accepted marketing cookies.
          These transfers go to the United States under standard contractual
          clauses.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>Anonymous analytics: 12 months rolling.</li>
        <li>Email signups: until you unsubscribe.</li>
        <li>
          Marketing pixel data: handled by X and Reddit per their own
          retention policies.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>Under UK and EU data protection law, you can:</p>
      <ul>
        <li>Ask what data we hold about you.</li>
        <li>Ask us to correct or delete it.</li>
        <li>Object to processing, or withdraw consent at any time.</li>
        <li>Ask for your data in a portable format.</li>
        <li>Complain to a regulator (ICO in the UK; your local DPA in the EU).</li>
      </ul>
      <p>
        To exercise any of these, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We&apos;ll
        respond within 30 days.
      </p>

      <h2>Cookies and tracking</h2>
      <p>
        Full detail in our <a href="/cookies">cookie policy</a>. Change your
        choices any time via the &quot;Cookie preferences&quot; link in the
        footer.
      </p>

      <h2>Children</h2>
      <p>
        Tessera isn&apos;t aimed at under-13s and we don&apos;t knowingly
        collect data from them. If you believe a child has provided us data,
        email us and we&apos;ll delete it.
      </p>

      <h2>Changes</h2>
      <p>
        We&apos;ll update the date at the top when this changes. If the change
        is material, we&apos;ll surface a notice in-app and re-prompt your
        cookie choices.
      </p>

      <h2>Complaints</h2>
      <p>
        If we&apos;ve got something wrong, please tell us first at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. You can also
        complain to the UK Information Commissioner&apos;s Office at{" "}
        <a
          href="https://ico.org.uk/"
          target="_blank"
          rel="noopener noreferrer"
        >
          ico.org.uk
        </a>
        .
      </p>
    </LegalPage>
  );
}
