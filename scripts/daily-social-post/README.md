# Daily social post

Screenshots the day's Tessera puzzle and posts it to X, Reddit (r/TesseraPuzzle), and the Tessera Facebook Page.

## Run locally

```bash
cp .env.example .env   # at repo root, fill in secrets
node --env-file=.env scripts/daily-social-post/index.mjs
```

Flags (env vars):

- `DRY_RUN=1` — capture screenshot and print copy, skip posting
- `ONLY=x,reddit,facebook` — post to a subset
- `PUZZLE_URL=https://...` — override the URL to screenshot

## Credentials

See `.env.example`. All three platforms need pre-provisioned long-lived tokens:

- **X**: developer app with Read+Write, OAuth 1.0a user context for the posting account.
- **Reddit**: "script" app created by **u/coopstar230**, plus that account's password.
- **Facebook**: long-lived Page access token for the Tessera Page (`pages_manage_posts`, `pages_read_engagement`).

## GitHub Actions

The workflow `.github/workflows/daily-social-post.yml` runs at 08:00 UTC. All env vars are mapped from repo secrets.
