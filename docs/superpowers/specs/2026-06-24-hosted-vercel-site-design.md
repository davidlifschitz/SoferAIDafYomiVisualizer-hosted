# Hosted Daf Shiur Visualizer Design

> **Grok Build handoff:** This is the approved product specification. Implement it in the repository containing this file. Do not restart the product design process or replace the chosen services without explicit user approval.

## Product Goal

Build a hosted application that accepts a YUTorah Daf Yomi shiur, transcribes it with Sofer, validates and aligns it against Sefaria, and shows exactly where the shiur begins and ends on the relevant Mercava daf pages.

The application is public, but submitting a paid transcription requires an authenticated account with credits.

## Repository

Use:

```text
/Users/thebiglipper/Developer/SoferAIDafYomiVisualizer-hosted
```

Do not use the older repository under `~/Documents/SoferAIDafYomiVisualizer`. macOS offloaded portions of that workspace and damaged its Git metadata.

## Success Criteria

- The application deploys to Vercel as a Next.js App Router project.
- Users sign in with an email magic link or Google through Supabase Auth.
- Each newly verified account receives five free credits exactly once.
- Submitting a new lecture consumes one credit immediately.
- A failed Sofer job is not automatically refunded.
- An identical completed lecture is reused without consuming another credit.
- Long-running transcription and matching survive requests and deployments.
- Results display every Mercava half-page from the detected start through end.
- The start marker appears only on the correct starting page.
- The end marker appears only on the correct ending page.
- Users can manually correct the detected start and end segments.
- Results support private, unlisted, and publicly listed visibility.
- Users can buy credit packs or subscribe through Stripe.
- Abuse and spending controls prevent uncontrolled Sofer charges.

## Approved Stack

- **Application:** Next.js App Router, React, TypeScript
- **Hosting:** Vercel
- **Durable execution:** Vercel Workflows using the `workflow` SDK
- **Authentication:** Supabase Auth
- **Database:** Supabase Postgres
- **Assets:** Supabase Storage
- **Transcription:** Sofer.AI
- **Text validation:** Sefaria API
- **Mercava rendering:** Browserless
- **Payments:** Stripe Checkout, Billing, Billing Portal, and webhooks
- **Abuse protection:** Cloudflare Turnstile plus server-side rate limits
- **Testing:** Vitest, pgTAP/Supabase database tests, Playwright

Do not replace durable workflows with a long-running Vercel request. Do not run Playwright or a bundled browser inside Vercel for Mercava capture; Browserless is the approved capture provider.

## Authentication

Support:

- Email magic-link sign-in
- Google OAuth

Only verified identities receive the free credit grant. The grant must also work when email verification happens after the initial `auth.users` insert.

Never use user-editable `raw_user_meta_data` for authorization. Administrator status must come from trusted server-owned data or `app_metadata`.

## Credits

Credits use an append-only ledger. A mutable balance column is not the source of truth.

Credit grants:

- New verified account: `+5`
- Five-credit pack: `+5`
- Twenty-credit pack: `+20`
- Successful subscription invoice: `+10`
- Administrative adjustment: signed amount with a required reason

Charges:

- New Sofer analysis: `-1`

Pricing:

- Five credits: `$2`
- Twenty credits: `$7`
- Ten credits per month: `$4`

All unused credits roll over. Stripe price IDs must be environment configuration rather than hard-coded authorization evidence.

A submitted Sofer job is not automatically refunded. Any later refund is a separate compensating ledger entry.

## Submission And Deduplication

The server submission boundary must:

1. Authenticate the user.
2. Validate a Turnstile token.
3. Apply per-user and per-IP rate limits.
4. Enforce per-user concurrency limits.
5. Check the global submission pause and spending cap.
6. Normalize the YUTorah URL into a stable lecture key.
7. Reuse an existing completed canonical analysis without charging.
8. Otherwise create the analysis and atomically consume one credit.
9. Start a durable workflow only after the database transaction succeeds.

Supported YUTorah URLs must resolve to a numeric lecture ID. Reject unsupported hosts, credentials in URLs, unexpected ports, non-HTTPS URLs, duplicate lecture query parameters, and missing or invalid IDs.

## Durable Analysis Workflow

The workflow consists of idempotent steps:

1. Resolve YUTorah metadata and direct audio.
2. Submit audio to Sofer.
3. Persist Sofer identifiers immediately.
4. Poll Sofer with durable waits until completion or terminal failure.
5. Retrieve the transcript.
6. Retrieve candidate Sefaria pages and segments.
7. Normalize Hebrew, English, and transliterated text.
8. Detect the start and end segments.
9. Enumerate every required half-page.
10. Capture Mercava pages through Browserless.
11. Store images and report artifacts in Supabase Storage.
12. Persist the completed or partial result.

Workflow retries must never submit the same paid Sofer job twice after an identifier has been saved.

## Range Alignment

The TypeScript domain implementation already exists and is covered by fixture tests.

Regression target:

```text
Lecture: Rabbi Aryeh Lebowitz, Shabbos Daf 02
Start:   Shabbat 2a:1
End:     Shabbat 2b:14
Confidence: approximately 0.53
```

Important domain behavior:

- Hebrew maqaf is treated as a word separator.
- Invalid chunk sizes and steps are rejected.
- An end candidate may never precede the selected start.
- A requested preferred end reference is honored among close candidates.
- Shabbat refs are bounded from daf 2 through daf 157.
- Full half-page enumeration from `Shabbat 2a` through `Shabbat 157b` is valid.

Do not casually change scoring constants. Any behavior change requires a failing regression test first.

## Mercava Pages

Current mapping:

```text
Shabbat 2a -> metanav 2180
Shabbat 2b -> metanav 2184
Each following half-page increments by 4.
```

Browserless should:

- Load `https://themercava.com/app/books/metanav/<id>`.
- Use a stable `1240x1280` viewport.
- Wait until the expected daf label appears.
- Capture PNG output.
- Apply a bounded timeout.

Store images privately under:

```text
analyses/<analysis-id>/<canonical-page-ref>.png
```

Private and unlisted pages receive short-lived signed asset URLs.

If matching succeeds but a screenshot fails, preserve the result as `partial`. Do not discard valid text matching.

## Publication

Each user result has one mode:

- `private`: owner and administrator only
- `unlisted`: available through an opaque share URL, omitted from indexes
- `listed`: visible in the public library and eligible for indexing

Public views must omit:

- Account email
- Sofer identifiers
- Workflow identifiers
- Billing details
- Full transcript artifacts not required as evidence

## User Experience

The first screen is the working dashboard, not a marketing landing page.

Primary views:

- **Dashboard:** credit balance, YUTorah URL submission, active jobs, recent results
- **Analysis:** workflow progress or completed result
- **Visualizer:** vertically stacked Mercava pages, zoom, start/end markers
- **Evidence inspector:** confidence, Hebrew and English evidence, transcript excerpts
- **Correction:** replacement start/end Sefaria segment selection
- **Library:** listed public results
- **Billing:** packs, subscription, portal, ledger history
- **Settings:** identity and publication defaults
- **Admin:** submission pause, spending limits, failures, credit adjustments

The UI should be quiet and operational:

- No oversized marketing hero
- No decorative gradient/orb backgrounds
- No nested cards
- Stable image geometry
- Accessible marker labels and controls
- Responsive desktop and mobile layouts
- Lucide icons for familiar actions

## Database Boundary

Required tables:

- `profiles`
- `canonical_lectures`
- `analyses`
- `credit_ledger`
- `user_results`
- `analysis_pages`
- `stripe_customers`
- `stripe_events`
- `app_settings`

Required enums:

- `analysis_status`
- `publication_mode`

Every table in the exposed `public` schema must have RLS enabled.

Client access:

- Users can read their own profile, ledger, and results.
- Users cannot directly insert or mutate ledger entries.
- Users cannot directly mutate analyses, pages, Stripe records, or app settings.
- Listed results are publicly readable through a safe projection.
- Unlisted results are served through an opaque server route, not broad anonymous table access.

Privileged database functions belong in a non-exposed schema, use a fixed `search_path`, and have explicit execution grants.

## Payments

Use Stripe Checkout Sessions:

- One-time mode for credit packs
- Subscription mode for monthly credits

Do not pass `payment_method_types`; allow Stripe dynamic payment methods.

Only signed, idempotently processed webhooks grant credits:

- Completed paid Checkout Session grants a pack.
- Successful subscription invoice grants ten credits.
- Duplicate webhook event IDs are no-ops.
- Refunds and disputes create compensating negative ledger entries.

Use a restricted Stripe API key where practical.

## Abuse And Cost Controls

- Verified account required
- Turnstile on signup and submission
- Per-IP signup limits
- Per-user and per-IP submission limits
- Per-user concurrent job limit
- Canonical lecture deduplication
- Global submission pause
- Configurable monthly Sofer spending cap
- Server-side allowlist and URL validation to prevent SSRF

## Error Handling

Distinguish:

- Invalid YUTorah URL
- Lecture/audio unavailable
- Insufficient credits
- Rate limited
- Sofer rejected, timed out, or failed
- Sefaria unavailable
- Low-confidence range
- Mercava image unavailable
- Payment pending or failed

Low-confidence results complete with a warning and correction controls. Missing screenshots produce partial results.

## Security Requirements

- Never expose Supabase secret/service keys to the browser.
- Never expose Sofer, Browserless, Stripe, or Turnstile secrets.
- Never log complete secret values.
- Validate Stripe webhook signatures from the raw body.
- Validate Turnstile server-side.
- Keep RLS enabled and tested.
- Use trusted authorization data only.
- Prevent duplicate credits and duplicate charges with unique idempotency keys.
- Validate every outbound URL before server fetching.

## Explicit Non-Goals

- Native macOS or iOS application
- Anonymous paid analysis
- Automatic refunds for failed Sofer submissions
- Transcript editing
- Batch processing an entire YUTorah collection
- User-provided Sofer credentials
- Mac App Store or ZIP distribution

## Completion Definition

The product is complete when:

- Unit, database, integration, E2E, lint, typecheck, and build checks pass.
- A verified test account receives exactly five credits.
- Duplicate lecture reuse costs zero credits.
- A new lecture consumes exactly one credit.
- Shabbos Daf 2 shows start on Mercava 2a and end on 2b.
- Visibility modes enforce their access matrix.
- Stripe test purchases and invoices grant credits exactly once.
- No secret appears in tracked files or browser output.
- A Vercel preview is ready and checked on desktop and mobile.
