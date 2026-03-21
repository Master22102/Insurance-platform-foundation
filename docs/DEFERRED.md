# Deferred items (founder / legal / out of scope)

Items that **block** or **shape** work but are not auto-resolved in code. See **`lib/FOUNDER_DIRECT_INVOLVEMENT_LEDGER.md`** for the canonical list.

| Topic | Status | Notes |
|-------|--------|--------|
| FOCL **readiness / notifications** matrix | Deferred | Inbox actions + **basic filters** shipped; full notification cadence + adversarial engine per doctrine remains roadmap. |
| **Founder-only** vs **authenticated** for `feature_gate` mutations | Decision | Pass4 binds `auth.uid()`; role narrowing needs explicit policy. |
| Claim packet / legal copy release gate | Legal | When claim packet UX ships. |
| **CCO / “atomic incident”** E2E | Deferred | No CCO string in Playwright yet; matrix row not mirrored — add spec when scope + env stable, or keep manual smoke. |
| **Apply A1 + follow-up SQL on target Supabase** | Postponed (todo) | Run in SQL editor or `supabase db push` in order: `20260324120000`, `20260324130000` (if not yet), then **`20260325100000`**, **`20260325101000`** — see `docs/MIGRATIONS_APPLY_ORDER.md`. Then **`npm run e2e:contracts:required`** (expect 11 passed). Repo/CI green without this; DB must match for live A1 behavior + contract tests. |

Update this file when a deferred item closes.
