# Agent Instructions — SoferAIDafYomiVisualizer-hosted

This file is the highest-level agent policy for this repository. Read it before starting work.

## Authoritative product docs

- `docs/superpowers/specs/2026-06-24-hosted-vercel-site-design.md`
- `docs/superpowers/plans/2026-06-24-hosted-vercel-site-implementation.md`

Do not restart product discovery or replace approved services without explicit user approval.

## Manual testing gate (required)

When implementing a **new feature** or completing a **task-sized chunk of user-facing work**:

1. Implement the feature and run automated checks (`npm test`, `typecheck`, `lint`, `build`, and any focused integration/database tests that apply).
2. **Stop before moving to the next feature/task.**
3. Give the user clear manual test steps: URLs, credentials/fixtures, expected outcomes, and known local-dev quirks (for example, local magic links appear in Mailpit, not Gmail).
4. **Wait for the user to confirm manual testing** before:
   - committing (if not already committed),
   - starting the next implementation task,
   - or declaring the feature complete.

If automated tests pass but the user reports a manual failure, treat the feature as **not done** until the issue is fixed and re-tested.

Exception: pure internal refactors with no behavior change may proceed without a manual test pause, but say so explicitly.

## Local environment notes

- Use this repo only: `/Users/thebiglipper/Developer/SoferAIDafYomiVisualizer-hosted`
- Local Supabase: default Colima + `supabase start -x vector`
- Local auth emails: http://127.0.0.1:54324 (Mailpit), not real inboxes
- Copy keys from `supabase status -o env` into `.env.local` (gitignored)

## Execution rules

- Work test-first; preserve unrelated changes
- Never commit credentials
- Keep RLS enabled on exposed tables
- Do not deploy production without explicit approval
- Commit coherent tasks separately with verification output