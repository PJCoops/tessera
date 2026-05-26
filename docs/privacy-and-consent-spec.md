# Tessera Privacy, Consent & Legal — Spec

Status: Draft
Owner: Paul
Last updated: 2026-05-25
Related: [accounts-spec.md](./accounts-spec.md)

## Why now

Tessera currently runs PostHog (analytics) with no consent gate, no privacy policy, and no terms. Meta Pixel + Conversions API are being **disabled** (no active Meta spend), but the code stays in place behind an env-var flag so re-enabling later is a one-line config change. Reddit Pixel and X (Twitter) Pixel are planned additions for paid acquisition on those platforms. That's a GDPR / UK GDPR / ePrivacy gap. Adding accounts (which introduces email, login history, server-stored data) sharpens the obligation. Better to land this alongside accounts than to bolt it on after.

## Scope

In:
- Privacy policy + cookie policy + T&Cs (the three documents)
- Cookie consent banner (GDPR-compliant: granular, no pre-ticks, equal-prominence reject)
- Consent gating of PostHog and Meta Pixel
- Privacy center page (`/privacy-center`) to view + change preferences and request deletion / export
- Consent record audit (how we prove the user agreed, without itself becoming a PII problem)

Out:
- Cookie consent for non-EU/UK visitors. We can serve everyone the same banner for simplicity (cheaper than geo-routing) but won't try to match California / Brazil specifics until traffic justifies it.
- Age verification. Tessera isn't directed at under-13s; we'll add a standard "you must be 13+" clause in T&Cs and stop there.
- DPA paperwork with Supabase / Vercel / Meta. They all publish standard DPAs we accept by using the service; we'll link to them.

---

## Legal posture

| Regime | What it requires | Our response |
|---|---|---|
| **GDPR (EU)** | Lawful basis, consent for non-essential cookies, data subject rights (access, deletion, portability), DPO if scale demands (we don't yet) | Consent banner, privacy center, EU Supabase region, documented basis per data type |
| **UK GDPR + PECR** | Same as GDPR plus stricter cookie rules | Covered by the same controls |
| **ePrivacy Directive** | Prior consent before non-essential cookies are *set* | Banner blocks PostHog + Meta Pixel until accepted |
| **CCPA / CPRA (California)** | "Do not sell" + access/deletion | Phase 2. Same privacy-center endpoints cover it. |

**Lawful basis per data type:**

| Data | Basis | Notes |
|---|---|---|
| Email (account) | Contract | Required to provide the login service |
| Display name | Contract | |
| Streak / puzzle results (account) | Contract | |
| Streak (localStorage, logged out) | Not personal data | Anonymous device storage |
| PostHog analytics | **Consent** | Banner-gated |
| Reddit Pixel | **Consent** | Banner-gated. US transfer (SCCs). |
| X (Twitter) Pixel | **Consent** | Banner-gated. US transfer (SCCs). |
| Login history (Phase 2) | Legitimate interest | Security; documented in policy |
| Consent record | Legal obligation | Required to prove consent |

---

## Consent banner

### Behaviour

- Shows on first visit. **Blocks no content** (no modal overlay) — bottom bar that doesn't obstruct gameplay. The puzzle is still playable while undecided.
- Three buttons of equal prominence: **Accept all** · **Reject all** · **Customise**
- No pre-ticked boxes in Customise. No "Accept all" highlighted as the default. (Both are common GDPR violations the ICO calls out.)
- Until the user chooses, **no** non-essential cookies/scripts load. PostHog and Meta Pixel must not initialise.
- Choice persists in a first-party cookie (`tessera_consent`, 12-month expiry).
- After 12 months, re-prompt — standard practice.
- "Change cookie preferences" link in the footer reopens the customise panel any time.

### Categories

| Category | Always on? | What it covers |
|---|---|---|
| Strictly necessary | Yes | `tessera_consent` cookie, Supabase auth session cookie, any CSRF tokens |
| Analytics | No | PostHog |
| Marketing | No | Reddit Pixel, X (Twitter) Pixel |

Localisation: banner copy needs `en` and `sv` (matches existing i18n).

### What we DON'T do

- No "legitimate interest" toggle for analytics or marketing. That's the dark pattern the EDPB and ICO have warned vendors away from.
- No "by continuing to browse you accept cookies" implicit-consent banner. Doesn't meet GDPR.
- No fingerprinting or workaround tracking when consent is denied. Denied means denied.

---

## Consent record (without making it a PII problem)

The compliance question: *how do you prove user X consented on date Y?*

The trap: storing `(ip_address, user_agent, consent_choice, timestamp)` for every visitor means you're processing PII (IP) for everyone, including those who rejected analytics. That's worse than not recording it.

### Approach

1. **Consent stored client-side** in the `tessera_consent` cookie as a JSON blob: `{ version, accepted_categories, timestamp }`. This is the source of truth for the browser.
2. **Server-side audit log** only when the user is logged in: `consent_events (user_id, version, accepted_categories, created_at)`. Tied to an account, not an IP. Clearly necessary, minimal data.
3. **For anonymous users**, no server-side record. The cookie is the record. If we ever need to prove consent for an anonymous visitor (rare — typically only if they later complain), we point to the policy version + banner UX in place at the time.
4. **Policy version field** lets us re-prompt if the policy materially changes.

This is the same pattern the ICO recommends in its 2023 cookie guidance.

---

## Three documents

### Privacy Policy (`/privacy`)

Required sections (GDPR Art. 13/14):
- Who we are + contact
- What data we collect (the table from "Lawful basis" above, in plain English)
- Why we collect it
- Legal basis for each
- Who we share it with (Supabase EU, Vercel, PostHog EU, Meta — each with a link to their privacy policy)
- International transfers (Meta = US; documented with SCCs)
- Retention periods (see below)
- Your rights (access, rectify, delete, port, object, withdraw consent)
- How to exercise them (privacy center link + email)
- Complaints (your local DPA; we'll list the UK ICO and link to the EDPB list)
- Policy version + last-updated date

**Retention:**

| Data | Retention |
|---|---|
| Account (email, display name) | Until account deleted |
| Streak + puzzle results | Until account deleted (hard) or 2 years from last play |
| Anonymous localStorage streak | Browser-controlled; we don't retain anything server-side |
| PostHog events | 12 months rolling |
| Meta Pixel events | Per Meta's retention (~24 months); we don't store independently |
| Consent audit (logged-in) | 24 months after last update |
| Login history (Phase 2) | 12 months |

### Cookie Policy (`/cookies`)

- Lists every cookie set: name, purpose, category, expiry, first/third party
- Auto-generated table is nice but overkill for MVP. Hand-maintained list of ~6 cookies is fine.
- Link to change preferences (opens the banner customise panel)

### Terms & Conditions (`/terms`)

Game-appropriate scope, not e-commerce boilerplate. Include:
- Acceptable use ("don't scrape the puzzle, don't run bots, don't share solutions before midnight UTC")
- Account rules (one per person, no impersonation, display-name rules)
- Content ownership (puzzles © Tessera; user-submitted content like display name = limited licence to display)
- Service availability (no uptime guarantee)
- Termination (we can delete abusive accounts; you can delete yours any time)
- Liability cap (standard)
- Governing law (Sweden, given Sourceful base? Or wherever the entity is — needs confirmation)
- Changes to terms (we notify; continued use = acceptance for non-material; explicit prompt for material)

**Drafting approach:** I can draft all three using a clear, plain-English tone that matches Tessera's voice (no em dashes, no legalese where avoidable). You'll want a lawyer to glance over T&Cs and the liability clauses before going live. Privacy policy is more formulaic and lower legal risk if it's accurate.

---

## Privacy Center (`/privacy-center`)

One page, logged-in users only. (Logged-out users use the cookie banner's customise panel for consent, and an email link for deletion requests.)

```
┌───────────────────────────────────────────┐
│  Privacy Center                           │
├───────────────────────────────────────────┤
│                                           │
│  Cookie preferences                       │
│  ☑ Strictly necessary (always on)         │
│  ☐ Analytics                              │
│  ☐ Marketing                              │
│  [ Save preferences ]                     │
│                                           │
│  Your data                                │
│  [ Download my data ]    (JSON export)    │
│  [ Delete my account ]   (7-day undo)     │
│                                           │
│  Email preferences                        │
│  ☑ Magic-link sign-in emails (required)   │
│  ☐ Streak reminders                       │
│  ☐ Product updates                        │
│                                           │
│  Consent history                          │
│  • Accepted analytics · 2 days ago        │
│  • Rejected marketing · 2 days ago        │
│  • Accepted T&Cs v1.0 · on signup         │
│                                           │
└───────────────────────────────────────────┘
```

---

## Implementation

### Tooling

I'd build this in-house rather than pulling in a CMP like Cookiebot (€~50/mo, banner is heavy, GDPR-violations have hit several CMPs themselves) or OneTrust (enterprise pricing). For a single-purpose site with ~four trackers, ~200 lines of code does the job and stays under our control.

**Worth reconsidering at five+ trackers.** If marketing keeps adding pixels (TikTok, LinkedIn, Pinterest…), a CMP starts to pay for itself — partly for the maintained tracker list, partly because Google Consent Mode v2 integration becomes load-bearing for ad attribution. Threshold: revisit if we cross five marketing trackers or start running Google Ads.

A small client-side consent context provides:

```ts
const { consent, setConsent, openBanner } = useConsent();
// consent: { necessary: true, analytics: boolean, marketing: boolean, version, timestamp }
```

PostHog and Meta Pixel components check `consent.analytics` / `consent.marketing` before initialising. If consent is later withdrawn, we call `posthog.opt_out_capturing()` and remove the Meta Pixel script + clear its cookies (`_fbp`, `_fbc`).

### Component plan

| Component | Purpose |
|---|---|
| `ConsentProvider` | Context, cookie read/write, version check |
| `ConsentBanner` | Bottom-bar UI, three buttons, customise panel |
| `ConsentCustomisePanel` | Per-category toggles |
| `usePostHogConsent` | Wraps existing posthog-provider to gate init |
| `useMetaPixelConsent` | Wraps meta-pixel.tsx to gate script load |
| `useRedditPixelConsent` | Gates Reddit Pixel script load + cleanup on withdrawal |
| `useXPixelConsent` | Gates X (Twitter) Pixel script load + cleanup on withdrawal |
| `/privacy-center/page.tsx` | Logged-in preferences + data rights |
| `/privacy/page.tsx`, `/terms/page.tsx`, `/cookies/page.tsx` | Static markdown rendered via MDX |
| Footer link: "Privacy · Terms · Cookie preferences" | Always-available access |

### What needs to change in existing code

- [posthog-provider.tsx](app/lib/posthog-provider.tsx): wrap init in a consent check; expose `posthog.opt_in_capturing()` / `opt_out_capturing()` when consent changes
- [meta-pixel.tsx](app/lib/meta-pixel.tsx): only mount when `consent.marketing === true`; unmount + clear cookies (`_fbp`, `_fbc`) on withdrawal
- [meta-event/route.ts](app/api/meta-event/route.ts): server-side Conversions API call must also check the user's marketing consent (passed from client or read from cookie)
- **New: `reddit-pixel.tsx`** mirroring meta-pixel pattern. Clears `_rdt_uuid` on withdrawal.
- **New: `x-pixel.tsx`** mirroring meta-pixel pattern. Clears `_twq_*` cookies on withdrawal.
- All four pixels should share a single `<MarketingPixels />` mount that fans out to whichever are configured via env vars — avoids four near-identical components drifting apart.

---

## Phased delivery (alongside accounts)

### Phase 0 (parallel to accounts Phase 0)
- Draft the three documents
- Build consent context + cookie infrastructure (no UI yet)
- Gate PostHog and all marketing pixels — but **default to "denied"** when no choice is recorded. This is the compliant default and ships dormant before banner UI lands.
- **Disable Meta Pixel** by unsetting `NEXT_PUBLIC_META_PIXEL_ID` in Vercel. The pixel component already short-circuits when the env var is missing (see existing guard), so no code deletion needed. The Conversions API route should also early-return when the env var is unset.
- Add the Reddit + X pixel components, guarded by `NEXT_PUBLIC_REDDIT_PIXEL_ID` and `NEXT_PUBLIC_X_PIXEL_ID` env vars — same "unset = disabled" pattern. Re-enabling any of the three is a one-line Vercel env change.
- **Note:** flipping the analytics default may temporarily reduce analytics volume until the banner is live and users start accepting. Acceptable trade for compliance.

### Phase 1 (with accounts MVP)
- Ship the banner
- Ship `/privacy`, `/terms`, `/cookies` static pages
- Footer links
- Re-enable PostHog + Meta Pixel for users who accept

### Phase 2 (with accounts Phase 2)
- Ship `/privacy-center` (full version for logged-in users)
- Email preferences (requires transactional email infrastructure, which Phase 2 of accounts brings)
- Data export endpoint
- Consent audit log table

### Phase 3
- Localisation review for non-English markets if/when we expand
- CCPA "Do not sell" if US traffic grows enough to matter

---

## What I need from you

### Resolved

- **Data controller:** Paul Cooper, sole trader (UK), pending decision on incorporating a Ltd company — see "Open" below.
- **Privacy contact email:** `pjcooper.design@gmail.com` until a domain inbox is set up.
- **Governing law:** England and Wales.
- **Marketing pixels:** Meta Pixel removed. Reddit + X added when those campaigns start.

### Open

- **Sole trader vs Ltd company.** See "Entity decision" section below.
- **Lawyer review of T&Cs** — not blocking for the draft, blocking for go-live. Worth budgeting £200-500 for a one-off review.
- Review and edit drafted policy text (Phase 1).

---

## Entity decision: sole trader vs Ltd

Currently running as sole trader. Worth thinking about before the privacy policy goes live, because the policy names the data controller — and changing the controller later means re-issuing notices to all users.

**Sole trader risks for Tessera specifically:**
- **Personal liability for GDPR fines.** ICO can fine up to £17.5m or 4% of global turnover. Fines are exceptionally rare for a game this size, but the personal-asset exposure is uncapped.
- **Personal liability for T&C disputes** (e.g. a user claims they were harmed by something on the site). Same point: rare but uncapped.
- **Personal name on every privacy notice.** Your home address shows up in WHOIS and ICO registration if you don't use a registered office service.

**Ltd company benefits:**
- Liability shield. Company assets at risk, not personal.
- Cleaner public-facing identity ("Tessera Games Ltd" reads more legit than a personal name on T&Cs).
- Easier if Tessera ever takes money (ads, subscriptions, sponsorship). Sole traders can do this too but tax/VAT gets messier.
- Costs: ~£12 to incorporate at Companies House, ~£40/yr confirmation statement, accountant typically £500-1000/yr. Below the noise floor if Tessera makes any revenue.

**Recommendation:** Incorporate before launching the privacy policy. Reasons:
1. The privacy policy is a public, semi-permanent document. Better to put the eventual entity name on it from day one.
2. ICO registration (£40/yr, mandatory once you process personal data) is cleaner under a company.
3. Liability shield matters most precisely when you're about to start collecting emails and payment-adjacent data.

The work to incorporate is ~1 hour on Companies House. Worth doing this week if you're proceeding with accounts.

**If you stay sole trader for now:** privacy policy lists "Paul Cooper, sole trader, United Kingdom" as controller. We can swap to a Ltd name later, but it's a notice-to-users event (email all users, update policy version).

## Open questions

1. **Banner placement: bottom bar vs centered modal?** Bar is less intrusive and what NYT Games + Wordle-style sites tend to use. Modal forces a decision but feels heavier. Recommend bar.
2. **Show banner to users who've already been playing pre-launch?** Yes — first visit after the change, regardless of prior history.
3. **Do we send a "we updated our privacy policy" email to existing email-signup users (the EmailSignup component)?** Recommend yes if the list is small enough to make it personal; mandatory if the policy materially changes how their data is used.
