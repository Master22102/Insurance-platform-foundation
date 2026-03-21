import fs from 'node:fs';
import path from 'node:path';
import { readAccessTokenFromStorageStateFile } from './utils/supabaseRest';

/**
 * When E2E_REQUIRE_CONTRACTS=1, fail before workers start if we cannot run
 * real contract tests (storage + Supabase JWT + public env). Addresses SHIP_BAR C2
 * "green but everything skipped" (including empty/invalid storage).
 */
export default async function globalRequireContractsSetup(): Promise<void> {
  if (process.env.E2E_REQUIRE_CONTRACTS !== '1') return;

  const storage = path.join(process.cwd(), '.playwright', 'storageState.json');
  if (!fs.existsSync(storage)) {
    throw new Error(
      '[E2E_REQUIRE_CONTRACTS] Missing .playwright/storageState.json — run `npm run e2e:auth` locally or set PLAYWRIGHT_STORAGE_STATE_B64 in CI (see docs/CI_E2E_SAMPLE.md).',
    );
  }

  if (!readAccessTokenFromStorageStateFile(storage)) {
    throw new Error(
      '[E2E_REQUIRE_CONTRACTS] No usable Supabase access_token in storageState (localStorage or sb-*-auth-token cookie) — run `npm run e2e:auth` again (session may be expired).',
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
  if (!url || !key) {
    throw new Error(
      '[E2E_REQUIRE_CONTRACTS] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (use .env.local or CI secrets).',
    );
  }
  const looksPlaceholder =
    url.includes('placeholder.supabase.co') ||
    /placeholder/i.test(key) ||
    key === 'placeholder-anon-key-for-ci-build-only';
  if (looksPlaceholder) {
    throw new Error(
      '[E2E_REQUIRE_CONTRACTS] NEXT_PUBLIC_* are CI-style placeholders — put the **same** real Supabase URL + anon key in `.env.local` as the project you used for `npm run e2e:auth` (JWT and REST host must match).',
    );
  }
}
