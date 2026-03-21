# Sample CI: Playwright + Supabase public env

**In-repo:** `.github/workflows/ci.yml` runs **typecheck + lint + `verify:csp-config` + production build** on every PR (no Supabase secrets; **build** uses placeholder `NEXT_PUBLIC_SUPABASE_*` inlined at compile time). Optional DB checks: **`docs/VERIFY_OPTIONAL.md`**.

**Optional:** `.github/workflows/e2e-contracts-optional.yml` — **workflow_dispatch** only; set secrets below then run **Actions → E2E contracts (optional)**.

**Optional (DB / service_role):** `.github/workflows/verify-optional-db.yml` — **Actions → Verify optional (DB)** — `ingest_corpus_rules` idempotency. Secrets: **`docs/VERIFY_OPTIONAL.md`**.

When the workflow dialog opens, you may set:

| Input | Effect |
|-------|--------|
| **Run policy governance** | After contracts, runs **`npm run e2e:policy-governance`** (longer; needs extraction pipeline). |
| **Strict policy governance REST** | If governance runs, sets **`E2E_STRICT_POLICY_GOVERNANCE_REST=1`** (hard-fail PostgREST/RLS errors in that spec). |
| **Require Playwright storage state** | If **true**, workflow **fails** when **`PLAYWRIGHT_STORAGE_STATE_B64`** is unset (no silent skip for auth-dependent specs). When **true**, the job also sets **`E2E_REQUIRE_CONTRACTS=1`** so Playwright **fails fast** if storage file or `NEXT_PUBLIC_*` is missing before tests run (`docs/CD_CONTRACTS_AND_CORE_SLICE.md`). |

Locally: `npm run e2e:policy-governance` (same spec as cross-browser core minus other files).

For a **template** job embedded in your own pipeline, use the outline below — adjust branches, Node version, and secret names.

## Secrets / variables (GitHub)

- `NEXT_PUBLIC_SUPABASE_URL` — project URL (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key (public; still store as encrypted secret in CI)
- Optional: base64-encoded **`PLAYWRIGHT_STORAGE_STATE_B64`** — output of `certutil` / `base64` on `.playwright/storageState.json` from a trusted setup run
- For **Verify optional (DB)** workflow only: **`SUPABASE_SERVICE_ROLE_KEY`**, **`VERIFY_CORPUS_ACTOR_UUID`** (`auth.users.id`) — see **`docs/VERIFY_OPTIONAL.md`** (never expose service role to the browser)

## Example job outline

```yaml
name: e2e-smoke
on: [push, pull_request]
jobs:
  playwright:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: Insurance-platform-foundation-main/package-lock.json
      - name: Install
        working-directory: Insurance-platform-foundation-main
        run: npm ci
      - name: Install Playwright browsers
        working-directory: Insurance-platform-foundation-main
        run: npx playwright install --with-deps chromium
      - name: Storage state (optional)
        if: ${{ env.PLAYWRIGHT_STORAGE_STATE_B64 != '' }}
        working-directory: Insurance-platform-foundation-main
        run: |
          mkdir -p .playwright
          echo "$PLAYWRIGHT_STORAGE_STATE_B64" | base64 -d > .playwright/storageState.json
        env:
          PLAYWRIGHT_STORAGE_STATE_B64: ${{ secrets.PLAYWRIGHT_STORAGE_STATE_B64 }}
      - name: Typecheck
        working-directory: Insurance-platform-foundation-main
        run: npm run typecheck
      - name: E2E contracts (Chromium)
        working-directory: Insurance-platform-foundation-main
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
        run: npm run e2e:contracts
```

`npm run e2e:contracts` includes **`pass9`**, **`claim-packet-contract`**, and **`claim-route-happy-path`** (Chromium). For claim-route only: `npm run e2e:claim-route` (gate + happy path).

**Note:** Without `storageState.json`, specs that call `test.skip(!hasStorageState())` will skip. That can be acceptable for a **typecheck-only** or **smoke** job if you name the workflow accordingly (e.g. `e2e-contracts-skips-ok`).

**Strict local / gate run:** `npm run e2e:contracts:required` sets `E2E_REQUIRE_CONTRACTS=1` and **errors** if `.playwright/storageState.json` or `NEXT_PUBLIC_SUPABASE_*` is missing (addresses **SHIP_BAR C2**).

### Strict policy REST (optional)

For CI jobs that **must** fail when PostgREST / RLS blocks the governance DB chain after extraction completes, set:

`E2E_STRICT_POLICY_GOVERNANCE_REST=1`

This is used by `tests/e2e/policy-governance-e2e.spec.ts` so the Supabase REST slice is not swallowed by an empty `catch` when you want a hard gate (requires working user JWT + RLS aligned with the test account).

