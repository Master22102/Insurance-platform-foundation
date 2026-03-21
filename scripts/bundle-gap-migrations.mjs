/**
 * Concatenate the known "gap" migrations (after 20260321143000 through pass14)
 * into one SQL file for a single Supabase SQL Editor run.
 *
 *   npm run bundle:gap-migrations
 *
 * Output: supabase/bundles/gap-through-pass14-ONE-BATCH.sql
 *
 * If any migration fails mid-run, use the section headers in the file to see
 * which file to fix; you may need to run remaining files individually.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const outDir = path.join(root, 'supabase', 'bundles');
const outFile = path.join(outDir, 'gap-through-pass14-ONE-BATCH.sql');

/** Same order as docs/REPO_VS_DATABASE.md — update both if the gap changes. */
const FILES = [
  /* 20260321170000_section41_policy_governance_determinism.sql — applied manually (recorded 2026-03-20). */
  '20260321183000_policy_parse_confidence_event_enrichment.sql',
  '20260321193000_atomic_policy_parse_enqueue.sql',
  '20260321200000_strict_quick_scan_credit_consumption.sql',
  '20260321213000_strict_deep_scan_emit_or_rollback.sql',
  '20260321220000_strict_quick_scan_emit_or_rollback.sql',
  '20260322110000_f662_protective_safety_mode_foundation.sql',
  '20260322113000_f663_f664_f666_foundations.sql',
  '20260323120000_pass8_payment_entitlement_auth_emit_hardening.sql',
  '20260323123000_pass9_idempotency_hardening.sql',
  '20260323130000_pass10_statutory_fsm_foundation.sql',
  '20260323140000_pass11_region_mode_auth_binding.sql',
  '20260323150000_pass12_membership_self_rpc_auth_binding.sql',
  '20260323150001_pass13_action_inbox_actor_auth_binding.sql',
  '20260323151000_pass14_claim_packet_routing_ready_guard.sql',
];

const BANNER = `/* =============================================================================
   ONE-BATCH GAP MIGRATIONS (generated — do not edit by hand)
   SKIPPED (already applied on target): 20260321170000_section41_policy_governance_determinism.sql
   Remaining: 14 files from 20260321183000 … 20260323151000

   Regenerate:  npm run bundle:gap-migrations
   See: docs/REPO_VS_DATABASE.md
   ============================================================================= */

`;

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const parts = [BANNER];
  for (const name of FILES) {
    const full = path.join(migrationsDir, name);
    if (!fs.existsSync(full)) {
      console.error(`bundle-gap-migrations: missing ${name}`);
      process.exit(1);
    }
    parts.push(
      `\n\n-- >>>>>>> BEGIN: ${name} <<<<<<\n\n`,
      fs.readFileSync(full, 'utf8'),
      `\n\n-- >>>>>>> END: ${name} <<<<<<\n`,
    );
  }
  fs.writeFileSync(outFile, parts.join(''), 'utf8');
  const kb = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`bundle-gap-migrations: wrote ${outFile} (${kb} KiB)`);
}

main();
