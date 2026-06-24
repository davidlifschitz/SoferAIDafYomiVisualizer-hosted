# Hosted Vercel Site Implementation And Grok Build Handoff

> **Primary instruction for Grok Build:** Continue this repository from its current state. Do not scaffold a new project, delete the existing domain implementation, or redesign the approved stack. Work test-first, commit each completed task, and stop when an external credential or account action requires the user.

## Start Here

Repository:

```text
/Users/thebiglipper/Developer/SoferAIDafYomiVisualizer-hosted
```

Branch:

```text
feature/hosted-vercel
```

Current committed baseline:

```text
b5b760a chore: recover hosted implementation baseline
```

There is no Git remote yet.

Do not use:

```text
/Users/thebiglipper/Documents/SoferAIDafYomiVisualizer
```

That older workspace was affected by macOS File Provider offloading and damaged Git metadata.

Read the approved design before coding:

```text
docs/superpowers/specs/2026-06-24-hosted-vercel-site-design.md
```

## Current State

### Committed And Implemented

- Next.js App Router scaffold
- React and strict TypeScript configuration
- ESLint, Vitest, and Playwright configuration
- Production build script
- Required application dependencies
- Text normalization domain
- Daf reference parsing and half-page enumeration
- Mercava metanav mapping
- Secure YUTorah lecture-key normalization
- Range-alignment domain
- Shared report types
- Official Shabbat 2a/2b Sefaria segment fixture
- Sofer-derived transcript excerpt fixture
- Forty-one domain tests
- Shabbos Daf 2 regression:
  - Start `Shabbat 2a:1`
  - End `Shabbat 2b:14`
  - Confidence approximately `0.53`

### Uncommitted Intentional RED Work

These files are untracked:

```text
tests/database/001_schema.test.sql
tests/database/002_credits.test.sql
tests/database/003_publication_rls.test.sql
```

They are intentional pgTAP tests for the current database task. Inspect and preserve them. Do not discard them as generated output.

The CLI-created migration exists but is empty:

```text
supabase/migrations/20260624103411_initial_schema.sql
```

The immediate task is to make the RED database tests pass by implementing this migration.

### Not Implemented

- Supabase schema and RLS
- Supabase authentication clients and UI
- Dashboard workflow
- Submission API
- Turnstile
- Rate limiting
- Live Sofer client
- Live Sefaria client
- Vercel Workflow
- Browserless capture
- Supabase Storage integration
- Manual correction UI
- Publication routes
- Stripe billing
- Admin controls
- Full E2E suite
- GitHub remote/CI
- Vercel deployment

## Environment Notes

At handoff time:

- `node_modules` is absent. Run `npm ci`.
- Disk space was low after Supabase image downloads. Check `df -h /` before pulling more images.
- A separate Colima profile named `supabase` was created for local Supabase.
- The default Colima profile contains unrelated Docker state. Do not delete or prune it without user approval.
- The Supabase profile may be stopped.

Recommended setup:

```bash
cd /Users/thebiglipper/Developer/SoferAIDafYomiVisualizer-hosted
df -h /
npm ci
colima start --profile supabase
docker context use colima-supabase
supabase start
```

Free at least 8 GB before a fresh full Supabase image pull. Do not delete personal files, Docker profiles, or broad system data without explicit permission.

## Execution Rules

1. Preserve unrelated changes.
2. Follow test-driven development.
3. Run the focused test first, then broader checks.
4. Do not make live paid Sofer requests in automated tests.
5. Use fixtures or injected fake services for CI.
6. Do not expose secrets in source or browser bundles.
7. Use current official documentation for Supabase, Vercel Workflows, Stripe, Browserless, and Turnstile.
8. Commit one coherent task at a time.
9. Do not claim completion without fresh verification output.
10. Do not deploy to production without explicit user approval. A preview deployment is the first target.

## Verification Commands

Current project commands:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Database commands must be discovered with current CLI help rather than guessed:

```bash
supabase --help
supabase test --help
supabase db --help
```

## Task 1: Complete Supabase Schema, Ledger, And RLS

**Status:** In progress; RED tests exist and migration is empty.

**Owned files:**

```text
supabase/config.toml
supabase/migrations/20260624103411_initial_schema.sql
supabase/seed.sql
tests/database/*.sql
```

Implement:

- `analysis_status` enum
- `publication_mode` enum
- `profiles`
- `canonical_lectures`
- `analyses`
- `credit_ledger`
- `user_results`
- `analysis_pages`
- `stripe_customers`
- `stripe_events`
- `app_settings`

Database requirements:

- UUID primary keys
- Correct FK creation order
- Index every foreign key and common lookup path
- Unique idempotency keys
- Append-only ledger
- RLS on every exposed table
- Owner-only profile, ledger, and private-result access
- No direct client ledger writes
- No direct client writes to analyses, pages, Stripe records, or settings
- Listed public result access without exposing internal analysis fields
- Unlisted results not broadly anonymous through table policies

Credit requirements:

- Verified user receives `+5` exactly once
- Delayed email confirmation also grants exactly once
- Google verified user also grants exactly once
- No authorization from user metadata
- Safe own-balance function
- Private atomic charge function
- Stable per-user lock
- Retry-idempotent `-1` charge
- Stable `insufficient_credits` failure
- No partial charge on insufficient funds

Security requirements:

- Privileged functions in a non-exposed schema
- Fixed `search_path`
- Revoke default `PUBLIC` execution
- Explicit safe grants
- No cross-user balance lookup

Run:

```bash
supabase start
supabase db reset
# Run the supported current pgTAP test command discovered through --help.
# Run database advisors if supported by the installed CLI.
npm test
npm run typecheck
npm run lint
npm run build
```

Expected commit:

```text
feat: add Supabase schema credits and RLS
```

## Task 2: Add Supabase Authentication

Create:

```text
lib/supabase/client.ts
lib/supabase/server.ts
lib/supabase/admin.ts
lib/supabase/proxy.ts
proxy.ts
app/login/page.tsx
app/login/actions.ts
app/auth/callback/route.ts
components/app-shell.tsx
tests/components/login.test.tsx
```

Support:

- Email magic link
- Google OAuth
- Safe callback code exchange
- Validated relative `next` redirects
- Cookie refresh through the current Next.js/Supabase SSR pattern
- Protected dashboard, billing, settings, admin, and private result routes

Use:

- `createBrowserClient`
- `createServerClient`
- `getClaims()` or the current secure Supabase equivalent

Do not authorize from `getSession()` alone or user-editable metadata.

Environment contract:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
SOFER_API_KEY=
BROWSERLESS_API_TOKEN=
STRIPE_RESTRICTED_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PACK_5=
STRIPE_PRICE_PACK_20=
STRIPE_PRICE_SUB_10=
```

Never commit real values.

Expected commit:

```text
feat: add Supabase magic link and Google auth
```

## Task 3: Build Dashboard And Fixture Visualizer

Create:

```text
components/analysis-form.tsx
components/credit-balance.tsx
components/analysis-progress.tsx
components/range-visualizer.tsx
components/evidence-inspector.tsx
app/analyses/[id]/page.tsx
tests/components/range-visualizer.test.tsx
```

Update `app/page.tsx` into the authenticated dashboard.

Visualizer requirements:

- Vertically stacked Mercava pages
- Preserve image aspect ratio
- Start marker on 2a
- End marker on 2b
- Percentage-based marker placement:

```ts
const left = `${(marker.x / screenshot.width) * 100}%`;
const top = `${(marker.y / screenshot.height) * 100}%`;
```

- Accessible labels
- Zoom controls
- Evidence inspector
- Desktop and mobile layout checks

Expected commit:

```text
feat: build hosted dashboard and range visualizer
```

## Task 4: Add Turnstile, Limits, Deduplication, And Submission

Create:

```text
lib/services/turnstile.ts
lib/analysis/submit.ts
app/api/analyses/route.ts
tests/services/turnstile.test.ts
tests/analysis/submit.test.ts
```

Submission order:

1. Authenticate.
2. Validate Turnstile server-side.
3. Apply user/IP limits.
4. Check global pause/spending cap.
5. Normalize YUTorah lecture key.
6. Reuse a completed canonical analysis at no charge.
7. Otherwise atomically create and charge.
8. Start workflow.

Required tests:

- New lecture: `5 -> 4`
- Duplicate completed lecture: remains `5`
- Retried POST: one charge
- Failed workflow after submission: remains charged
- Zero balance: no analysis
- Invalid/expired/duplicate Turnstile token

Expected commit:

```text
feat: add protected credit-backed submissions
```

## Task 5: Add Sofer And Sefaria Clients

Create:

```text
lib/services/sofer.ts
lib/services/sefaria.ts
tests/services/sofer.test.ts
tests/services/sefaria.test.ts
```

Sofer requirements:

- Express processing mode
- Bearer authorization
- Direct audio request shape
- Typed batch/transcription identifiers
- Typed status handling

Sefaria requirements:

- Bulk and classic API shaping
- Segment-level English and Hebrew
- Stable canonical refs

Retry only:

- Network errors
- HTTP 429
- HTTP 5xx

Do not retry rejected credentials or malformed input indefinitely.

Expected commit:

```text
feat: add typed Sofer and Sefaria clients
```

## Task 6: Implement Vercel Workflow

Create:

```text
lib/analysis/workflow.ts
lib/analysis/steps.ts
tests/analysis/workflow.test.ts
```

Required stages:

```text
resolving
transcribing
matching
capturing
complete
```

Workflow requirements:

- `"use workflow"` at the orchestration boundary
- `"use step"` in durable steps
- Persist Sofer identifiers before waiting
- Reuse persisted identifiers on replay
- Durable sleeps between polls
- Terminal deadline
- No duplicate paid submission after replay

Expected commit:

```text
feat: add durable Vercel analysis workflow
```

## Task 7: Add Browserless And Storage

Create:

```text
lib/services/browserless.ts
lib/services/storage.ts
tests/services/browserless.test.ts
tests/services/storage.test.ts
```

Requirements:

- Enumerate all required half-pages
- Correct metanav IDs
- Stable viewport
- Expected daf label wait
- Private Supabase Storage upload
- Signed URL generation
- Partial result when some captures fail
- Retry missing images without rerunning Sofer

Expected commit:

```text
feat: capture and store Mercava daf pages
```

## Task 8: Add Corrections And Publication

Create:

```text
components/range-correction.tsx
components/publication-control.tsx
app/api/analyses/[id]/correction/route.ts
app/api/results/[id]/publication/route.ts
app/r/[slug]/page.tsx
app/library/page.tsx
tests/analysis/correction.test.ts
tests/analysis/publication.test.ts
```

Requirements:

- Corrected start cannot follow corrected end
- Recompute half-page range
- Preserve generated result separately
- Enforce private/unlisted/listed matrix
- Never leak account or workflow internals publicly

Expected commit:

```text
feat: add result correction and publishing
```

## Task 9: Add Stripe Billing

Create:

```text
lib/services/stripe.ts
app/api/stripe/checkout/route.ts
app/api/stripe/portal/route.ts
app/api/stripe/webhook/route.ts
app/billing/page.tsx
tests/billing/stripe-webhook.test.ts
```

Requirements:

- Checkout Session for packs
- Checkout Session for subscription
- Billing Portal
- Dynamic payment methods
- Raw-body signature verification
- Event idempotency
- Pack grant from successful paid Checkout
- Subscription grant from successful invoice
- Compensating entries for refunds/disputes
- Credits roll over indefinitely

Expected commit:

```text
feat: add Stripe credits and subscription billing
```

## Task 10: Add Administration

Create:

```text
lib/auth/admin.ts
app/admin/page.tsx
app/api/admin/settings/route.ts
app/api/admin/credits/route.ts
tests/admin/admin.test.ts
```

Admin controls:

- Pause submissions
- Resume submissions
- Set spending limits
- Inspect failed/partial analyses
- Add or remove credits with reason and idempotency key

Authorization must use trusted data.

Expected commit:

```text
feat: add administration and cost controls
```

## Task 11: Complete Testing And Security Gates

Replace the skipped E2E scaffold with real tests:

```text
e2e/auth.spec.ts
e2e/analysis.spec.ts
e2e/publication.spec.ts
e2e/billing.spec.ts
```

Required journeys:

- Verified signup gets five credits
- Duplicate lecture costs zero
- New analysis costs one
- Shabbos Daf 2 starts on 2a and ends on 2b
- Publication access matrix
- Stripe test checkout and invoice grant
- Turnstile/rate-limit rejection

Full gate:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
# Supported Supabase database tests
# Supported Supabase advisors
```

Also scan tracked files and built browser assets for secrets.

Expected commit:

```text
test: add hosted product verification
```

## Task 12: Configure Services And Deploy Preview

External setup required:

- Supabase project
- Google OAuth credentials
- Stripe test products/prices
- Stripe webhook
- Browserless token
- Turnstile site
- Sofer API key
- Vercel account/project

Use separate preview and production credentials where possible.

Before deploying:

- Apply migrations
- Pass RLS tests
- Configure auth redirect URLs
- Configure Google OAuth
- Configure Stripe webhook
- Configure Turnstile domains
- Verify Browserless capture
- Run fixture-backed Shabbos 2 E2E

Deploy preview first:

```bash
vercel link
vercel deploy . -y --no-wait
vercel inspect <preview-url>
```

Do not deploy production unless the user explicitly approves it.

## Git And Handoff Hygiene

Before starting:

```bash
git status --short --branch
git log --oneline -5
```

Current untracked pgTAP tests are intentional. Preserve them.

After each task:

```bash
git diff --check
git status --short
```

Commit only after focused and broad verification.

No remote is configured. Ask the user where to publish before creating or pushing a GitHub repository.

## External Credentials Stop Conditions

Continue locally with fixtures and test doubles until one of these is required:

- Creating a Supabase cloud project
- Configuring Google OAuth
- Creating Stripe products or webhook destinations
- Creating Browserless or Turnstile resources
- Adding a live Sofer key
- Linking Vercel
- Publishing GitHub

At those points, report the smallest exact user action or request explicit authorization for account-side changes.

## Final Completion Checklist

- [ ] Supabase migration and RLS tests pass
- [ ] Verified signup grants exactly five credits
- [ ] Duplicate analysis costs zero
- [ ] New analysis costs one
- [ ] Durable workflow cannot duplicate Sofer submission
- [ ] Sefaria matching preserves Shabbos 2 regression
- [ ] Browserless stores all required pages
- [ ] Start marker appears on 2a
- [ ] End marker appears on 2b
- [ ] Corrections persist separately
- [ ] Publication modes enforce access
- [ ] Stripe grants are idempotent
- [ ] Admin cost controls work
- [ ] No secrets leak
- [ ] Unit, database, build, and E2E checks pass
- [ ] Vercel preview is ready
