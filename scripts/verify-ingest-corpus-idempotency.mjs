/**
 * Optional DB verification: ingest_corpus_rules document-level idempotency (same source_file + pipeline).
 * Requires SUPABASE_SERVICE_ROLE_KEY + URL + a real account UUID (policies.account_id FK).
 *
 * Skip (exit 0) if prerequisites missing — safe for CI without secrets.
 *
 *   VERIFY_CORPUS_ACTOR_UUID=<auth.users.id> npm run verify:ingest-corpus-idempotency
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const actorId = process.env.VERIFY_CORPUS_ACTOR_UUID || '';

if (!url || !serviceKey) {
  console.log('verify-ingest-corpus-idempotency: SKIP (no SUPABASE_SERVICE_ROLE_KEY or URL)');
  process.exit(0);
}

if (!actorId) {
  console.log(
    'verify-ingest-corpus-idempotency: SKIP (set VERIFY_CORPUS_ACTOR_UUID to auth.users.id)',
  );
  process.exit(0);
}

const pipelineVersion = 'verify-corpus-idem-v1';
const stamp = Date.now();
const sourceFile = `corpus-idempotency-e2e-${stamp}.pdf`;

const rules = [
  {
    rule_id: `idem-${stamp}-1`,
    clause_type: 'flight_delay',
    normalized_value: '6',
    value_type: 'duration',
    raw_value: '6 hours',
    unit: 'hours',
    confidence: 'HIGH',
    operational_or_requirement: 'requirement',
    source_snippet:
      'Trip delay benefits begin after six hours of delay; carrier confirmation letter required for claims.',
    source_snippet_hash: 'verify',
    source_section: 'Delay',
    detected_by_pass: 'verify-script',
    high_value: false,
    source_file: sourceFile,
    source_family: 'travel',
    artifact_type: 'pdf_native_text',
    extraction_mode: 'native_pdf',
    has_table_data: false,
    quality_notes: '',
  },
];

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runIngest() {
  const { data, error } = await supabase.rpc('ingest_corpus_rules', {
    p_rules: rules,
    p_actor_id: actorId,
    p_pipeline_version: pipelineVersion,
    p_dry_run: false,
  });
  if (error) throw new Error(error.message);
  return data;
}

try {
  const first = await runIngest();
  if (!first?.ok) throw new Error(`first ingest not ok: ${JSON.stringify(first)}`);
  if ((first.docs_created ?? 0) < 1) {
    throw new Error(`expected docs_created >= 1, got ${JSON.stringify(first)}`);
  }

  const second = await runIngest();
  if (!second?.ok) throw new Error(`second ingest not ok: ${JSON.stringify(second)}`);
  if ((second.docs_skipped ?? 0) < 1) {
    throw new Error(
      `expected docs_skipped >= 1 on duplicate corpus doc hash, got ${JSON.stringify(second)}`,
    );
  }
  if ((second.docs_created ?? 0) !== 0) {
    throw new Error(
      `expected docs_created === 0 on replay, got ${JSON.stringify(second)}`,
    );
  }

  console.log('verify-ingest-corpus-idempotency: OK', {
    first_docs_created: first.docs_created,
    second_docs_skipped: second.docs_skipped,
    second_clauses_created: second.clauses_created,
  });
  if ((second.clauses_created ?? 0) > 0) {
    console.warn(
      'Note: RPC may still insert clauses on replay for an existing doc; document-level skip is what we asserted.',
    );
  }
} catch (e) {
  console.error('verify-ingest-corpus-idempotency: FAIL', e.message || e);
  process.exit(1);
}
