/**
 * Concatenate the known "gap" migrations (after 20260321143000 through pass14)
 * into one SQL file for a single Supabase SQL Editor run.
 *
 *   npm run bundle:gap-migrations
 *
 * Outputs:
 *   - supabase/bundles/gap-through-pass14-ONE-BATCH.sql  (14 files, unchanged list)
 *   - supabase/bundles/post-pass14-through-a1-ONE-BATCH.sql  (PGRST203 + canonical + A1 — run if pass14+ gap already applied)
 *   - supabase/bundles/gap-through-a1-ONE-BATCH.sql  (14 + post-pass14, one shot from mid-gap through A1)
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
const outPass14 = path.join(outDir, 'gap-through-pass14-ONE-BATCH.sql');
const outPostPass14 = path.join(outDir, 'post-pass14-through-a1-ONE-BATCH.sql');
const outFull = path.join(outDir, 'gap-through-a1-ONE-BATCH.sql');

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

/** After pass14: PostgREST / job_queue / incident status + A1 RPC auth (see docs/MIGRATIONS_APPLY_ORDER.md). */
const AFTER_PASS14 = [
  '20260324120000_fix_pgrst203_and_job_queue_job_name.sql',
  '20260324130000_fix_change_incident_status_text_canonical.sql',
  '20260325100000_a1_advance_trip_maturity_auth_bind.sql',
  '20260325101000_a1_route_claim_auth_bind.sql',
];

const BANNER_PASS14 = `/* =============================================================================
   ONE-BATCH GAP MIGRATIONS (generated — do not edit by hand)
   SKIPPED (already applied on target): 20260321170000_section41_policy_governance_determinism.sql
   Remaining: 14 files from 20260321183000 … 20260323151000

   Regenerate:  npm run bundle:gap-migrations
   See: docs/REPO_VS_DATABASE.md, supabase/bundles/README.md
   ============================================================================= */

`;

const BANNER_POST = `/* =============================================================================
   POST–PASS14 ONE-BATCH (generated — do not edit by hand)
   Contents: PGRST203/job_name fix, change_incident_status canonical text, A1 advance_trip_maturity + route_claim

   Use when: gap-through-pass14 (or equivalent) is ALREADY on the database.
   If not: use gap-through-a1-ONE-BATCH.sql or apply migrations in timestamp order.

   Regenerate:  npm run bundle:gap-migrations
   ============================================================================= */

`;

const BANNER_FULL = `/* =============================================================================
   GAP THROUGH A1 — ONE-BATCH (generated — do not edit by hand)
   14 gap files + 4 post-pass14 files (same as gap-through-pass14 + post-pass14-through-a1)

   SKIPPED: 20260321170000_section41_* (apply separately if needed)

   Regenerate:  npm run bundle:gap-migrations
   ============================================================================= */

`;

function concatWithBanner(banner, names, label) {
  const parts = [banner];
  for (const name of names) {
    const full = path.join(migrationsDir, name);
    if (!fs.existsSync(full)) {
      console.error(`bundle-gap-migrations: missing ${name} (${label})`);
      process.exit(1);
    }
    parts.push(
      `\n\n-- >>>>>>> BEGIN: ${name} <<<<<<\n\n`,
      fs.readFileSync(full, 'utf8'),
      `\n\n-- >>>>>>> END: ${name} <<<<<<\n`,
    );
  }
  return parts.join('');
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const pass14Sql = concatWithBanner(BANNER_PASS14, FILES, 'pass14');
  fs.writeFileSync(outPass14, pass14Sql, 'utf8');
  console.log(`bundle-gap-migrations: wrote ${outPass14} (${(fs.statSync(outPass14).size / 1024).toFixed(1)} KiB)`);

  const postSql = concatWithBanner(BANNER_POST, AFTER_PASS14, 'post-pass14');
  fs.writeFileSync(outPostPass14, postSql, 'utf8');
  console.log(`bundle-gap-migrations: wrote ${outPostPass14} (${(fs.statSync(outPostPass14).size / 1024).toFixed(1)} KiB)`);

  const fullSql = concatWithBanner(BANNER_FULL, [...FILES, ...AFTER_PASS14], 'full');
  fs.writeFileSync(outFull, fullSql, 'utf8');
  console.log(`bundle-gap-migrations: wrote ${outFull} (${(fs.statSync(outFull).size / 1024).toFixed(1)} KiB)`);
}

main();
