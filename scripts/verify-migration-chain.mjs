/**
 * CI/local: ensure critical security migrations (pass12–14) are present on disk.
 * Does NOT prove they are applied remotely — see docs/BLOCK_AB_PRODUCTION_TRACKER.md.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

const REQUIRED = [
  '20260323150000_pass12_membership_self_rpc_auth_binding.sql',
  '20260323150001_pass13_action_inbox_actor_auth_binding.sql',
  '20260323151000_pass14_claim_packet_routing_ready_guard.sql',
];

let ok = true;
for (const file of REQUIRED) {
  const full = path.join(migrationsDir, file);
  if (!fs.existsSync(full)) {
    console.error(`verify-migration-chain: missing ${file}`);
    ok = false;
  }
}

if (!ok) {
  console.error('verify-migration-chain: FAIL (see docs/MIGRATIONS_APPLY_ORDER.md)');
  process.exit(1);
}

console.log('verify-migration-chain: OK (pass12–14 files present)');
