#!/usr/bin/env node
/**
 * Runs the same tests as `npm run e2e:contracts` with E2E_REQUIRE_CONTRACTS=1
 * so Playwright fails fast when storage state or Supabase public env is missing.
 * Invokes `npx playwright` directly so the env var survives Windows npm nesting.
 * See docs/CD_CONTRACTS_AND_CORE_SLICE.md
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, E2E_REQUIRE_CONTRACTS: '1' };

const args = [
  'playwright',
  'test',
  'tests/e2e/pass9-idempotency-replay.spec.ts',
  'tests/e2e/claim-packet-contract.spec.ts',
  'tests/e2e/claim-route-happy-path.spec.ts',
  'tests/e2e/a1-rpc-auth-contract.spec.ts',
  '--project=chromium-desktop',
];

const res = spawnSync('npx', args, {
  stdio: 'inherit',
  env,
  shell: true,
  cwd: root,
});

process.exit(res.status === null ? 1 : res.status);
