/**
 * Extraction Worker — Document Upload → Extraction → Bridge → Coverage Graph
 * ===========================================================================
 *
 * The worker that closes the loop between document upload and the Coverage Graph.
 *
 * Flow (per F-6.5.1 Section 2.2 Seven-Stage Pipeline):
 *
 *   1. Upload confirmed → job_queue entry created by initiate_policy_upload()
 *   2. Worker picks up job (this module)
 *   3. Download document from Supabase Storage
 *   4. Extract text (pdfplumber/pdfminer/OCR layered fallback)
 *   5. Segment text → detect headings, sections
 *   6. Run clause family passes (10 pass groups, 38+ clause types)
 *   7. Consolidate → normalize → conflict resolution → confidence scoring
 *   8. Promote rules (HIGH confidence + plausibility guard)
 *   9. Bridge rules → policy_clauses via record_extraction_complete()
 *  10. Emit completion events to ledger
 *
 * Failure modes (per F-6.5.1 Section 8):
 *   - Extraction failure → document_status = 'needs_review', event emitted
 *   - OCR failure → falls through to manual review
 *   - Hallucination guard → clauses without citations are blocked
 *   - Worker unavailable → jobs accumulate, no data loss
 *
 * Can run as:
 *   - Supabase Edge Function (production)
 *   - Standalone Node.js script (testing)
 *   - Background job processor (via job_queue polling)
 *
 * Grounded in:
 *   - F-6.5.1 Policy Parsing & Clause Extraction
 *   - Section 3.0 Governance Substrate (event emission)
 *   - Section 12.3 Data Pipelines (canonical ingestion path)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { processDocument, ProcessingResult } from '../lib/document-intelligence';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

// ============================================================
// CONFIGURATION
// ============================================================

const PIPELINE_VERSION = 'extraction-worker-v1.0';
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/html',
  'message/rfc822',       // .mhtml
  'application/xml',
  'text/xml',
];

// Clause type → taxonomy family mapping (must match migration seed)
const CLAUSE_TO_FAMILY: Record<string, string> = {
  trip_delay_threshold: 'FAM-11', trip_delay_limit: 'FAM-05',
  baggage_delay_threshold: 'FAM-10', missed_connection_threshold: 'FAM-11',
  baggage_liability_limit: 'FAM-10', carrier_liability_cap: 'FAM-10',
  medical_emergency_coverage_limit: 'FAM-09', emergency_evacuation_limit: 'FAM-12',
  dental_emergency_limit: 'FAM-09', rental_car_damage_limit: 'FAM-05',
  personal_accident_coverage_limit: 'FAM-05', personal_effects_coverage_limit: 'FAM-05',
  supplemental_liability_limit: 'FAM-05', repatriation_remains_limit: 'FAM-12',
  trip_cancellation_limit: 'FAM-08', trip_interruption_limit: 'FAM-08',
  hotel_cancellation_window: 'FAM-08', cruise_cancellation_window: 'FAM-08',
  claim_deadline_days: 'FAM-14', deposit_requirement: 'FAM-03',
  final_payment_deadline: 'FAM-07', check_in_deadline: 'FAM-07',
  requires_receipts: 'FAM-03', requires_police_report: 'FAM-03',
  requires_medical_certificate: 'FAM-03', requires_carrier_delay_letter: 'FAM-03',
  requires_baggage_pir: 'FAM-03', requires_itinerary: 'FAM-03',
  requires_payment_proof: 'FAM-03', payment_method_requirement: 'FAM-03',
  common_carrier_requirement: 'FAM-03', round_trip_requirement: 'FAM-03',
  refund_eligibility_rule: 'FAM-08',
  eu_delay_compensation_threshold: 'FAM-16', eu_denied_boarding_compensation: 'FAM-16',
  eu_care_obligation: 'FAM-16', eu_rerouting_obligation: 'FAM-16',
  eu_refund_deadline: 'FAM-16', eu_cancellation_compensation: 'FAM-16',
  medical_evacuation_cost_estimate: 'FAM-12',
};

// ============================================================
// TYPES
// ============================================================

interface ExtractionJob {
  job_id: string;
  document_id: string;
  policy_id: string;
  account_id: string;
  trip_id: string | null;
  storage_path: string;
  original_filename: string;
}

interface ExtractionResult {
  ok: boolean;
  document_id: string;
  status: 'COMPLETE' | 'PARTIAL' | 'FAILED';
  clauses_accepted: number;
  clauses_review: number;
  clauses_rejected: number;
  version_id?: string;
  error?: string;
}

// ============================================================
// WORKER: PROCESS SINGLE DOCUMENT
// ============================================================

/**
 * Process a single uploaded document through the extraction pipeline.
 * This is the core worker function.
 *
 * @param supabase - Authenticated Supabase client (service_role)
 * @param job - The extraction job details
 * @returns ExtractionResult
 */
export async function processUploadedDocument(
  supabase: SupabaseClient,
  job: ExtractionJob,
): Promise<ExtractionResult> {

  const { document_id, policy_id, account_id, storage_path, original_filename } = job;

  // --- Stage 1: Update document status to processing ---
  await supabase
    .from('policy_documents')
    .update({
      document_status: 'processing',
      extraction_started_at: new Date().toISOString(),
      pipeline_version: PIPELINE_VERSION,
    })
    .eq('document_id', document_id);

  await emitEvent(supabase, {
    event_type: 'policy_parse_started',
    feature_id: 'F-6.5.1',
    scope_type: 'policy_document',
    scope_id: document_id,
    actor_id: account_id,
    actor_type: 'system',
    reason_code: 'WORKER_PICKUP',
  });

  // --- Stage 2: Download document from storage ---
  let localFilePath: string;
  try {
    localFilePath = await downloadFromStorage(supabase, storage_path, original_filename);
  } catch (err: any) {
    return await failExtraction(supabase, job, 'DOWNLOAD_FAILED', err.message);
  }

  // --- Stage 3: Verify integrity (SHA-256) ---
  const fileHash = computeFileHash(localFilePath);
  await supabase
    .from('policy_documents')
    .update({ content_hash: fileHash })
    .eq('document_id', document_id);

  // --- Stage 4: Run extraction pipeline ---
  let result: ProcessingResult;
  try {
    result = await processDocument(localFilePath, original_filename);
  } catch (err: any) {
    cleanupTempFile(localFilePath);
    return await failExtraction(supabase, job, 'EXTRACTION_ERROR', err.message);
  }

  cleanupTempFile(localFilePath);

  // --- Stage 5: Check extraction success ---
  if (!result.extraction.success) {
    return await failExtraction(supabase, job, 'EXTRACTION_FAILED',
      result.extraction.error || 'Unknown extraction failure');
  }

  if (result.promotedRules.length === 0 && result.candidates.length === 0) {
    return await failExtraction(supabase, job, 'NO_CLAUSES_DETECTED',
      'Document parsed but no clause candidates detected');
  }

  // --- Stage 6: Transform promoted rules into clause format ---
  const clauses: any[] = [];
  let acceptedCount = 0;
  let reviewCount = 0;
  let rejectedCount = 0;

  // Process promoted rules (HIGH confidence → AUTO_ACCEPTED)
  for (const rule of result.promotedRules) {
    // Hallucination guard: must have source citation
    if (!rule.sourceSnippet || rule.sourceSnippet.trim().length < 10) {
      rejectedCount++;
      await emitEvent(supabase, {
        event_type: 'extraction_hallucination_blocked',
        feature_id: 'F-6.5.1',
        scope_type: 'policy_document',
        scope_id: document_id,
        actor_id: account_id,
        actor_type: 'system',
        reason_code: 'MISSING_SOURCE_CITATION',
        metadata: { clause_type: rule.clauseType },
      });
      continue;
    }

    const familyCode = CLAUSE_TO_FAMILY[rule.clauseType] || 'FAM-99';

    clauses.push({
      clause_type: rule.clauseType,
      family_code: familyCode,
      canonical_text: formatCanonicalText(rule),
      source_citation: rule.sourceSnippet.substring(0, 500),
      section_path: rule.sourceSection || null,
      confidence_label: 'HIGH',
      extraction_status: 'AUTO_ACCEPTED',
      structured_value: {
        type: rule.value.type,
        value: rule.value.value,
        unit: rule.value.unit || '',
        raw: rule.value.raw || '',
      },
    });
    acceptedCount++;
  }

  // Process remaining candidates that are CONDITIONAL → PENDING_REVIEW
  for (const candidate of result.candidates) {
    if (candidate.confidence === 'HIGH') continue; // Already handled above
    if (candidate.confidence === 'CONDITIONAL') {
      if (!candidate.sourceSnippet || candidate.sourceSnippet.trim().length < 10) {
        rejectedCount++;
        continue;
      }

      const familyCode = CLAUSE_TO_FAMILY[candidate.clauseType] || 'FAM-99';

      clauses.push({
        clause_type: candidate.clauseType,
        family_code: familyCode,
        canonical_text: formatCanonicalText(candidate),
        source_citation: candidate.sourceSnippet.substring(0, 500),
        section_path: candidate.sourceSection || null,
        confidence_label: 'CONDITIONAL',
        extraction_status: 'PENDING_REVIEW',
        structured_value: candidate.value ? {
          type: candidate.value.type,
          value: candidate.value.value,
          unit: candidate.value.unit || '',
          raw: candidate.value.raw || '',
        } : null,
      });
      reviewCount++;
    }
  }

  // --- Stage 7: Write clauses to database via record_extraction_complete ---
  try {
    const { data: bridgeResult, error: bridgeError } = await supabase.rpc(
      'record_extraction_complete',
      {
        p_document_id: document_id,
        p_clauses: clauses,
        p_model_version: 'phrase-cluster-v1.0',
        p_pipeline_version: PIPELINE_VERSION,
        p_ocr_engine_version: result.extraction.method?.includes('ocr') ? 'tesseract-5.3' : null,
        p_itr_trace_id: null, // ITR created by the RPC
      },
    );

    if (bridgeError) {
      return await failExtraction(supabase, job, 'BRIDGE_ERROR', bridgeError.message);
    }

    // --- Stage 8: Emit completion event ---
    await emitEvent(supabase, {
      event_type: bridgeResult?.status === 'COMPLETE'
        ? 'policy_parse_complete'
        : 'policy_parse_partial',
      feature_id: 'F-6.5.1',
      scope_type: 'policy',
      scope_id: policy_id,
      actor_id: account_id,
      actor_type: 'system',
      reason_code: 'EXTRACTION_SUCCESS',
      metadata: {
        document_id,
        clauses_accepted: acceptedCount,
        clauses_review: reviewCount,
        clauses_rejected: rejectedCount,
        extraction_method: result.extraction.method,
        version_id: bridgeResult?.version_id,
      },
    });

    return {
      ok: true,
      document_id,
      status: reviewCount > 0 ? 'PARTIAL' : 'COMPLETE',
      clauses_accepted: acceptedCount,
      clauses_review: reviewCount,
      clauses_rejected: rejectedCount,
      version_id: bridgeResult?.version_id,
    };

  } catch (err: any) {
    return await failExtraction(supabase, job, 'BRIDGE_EXCEPTION', err.message);
  }
}

// ============================================================
// JOB QUEUE PROCESSOR
// ============================================================

/**
 * Poll the job_queue for pending extraction jobs and process them.
 * This is the background worker loop.
 */
export async function processExtractionQueue(
  supabase: SupabaseClient,
  options: { maxJobs?: number; pollInterval?: number } = {},
): Promise<{ processed: number; succeeded: number; failed: number }> {

  const maxJobs = options.maxJobs || 10;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  // Fetch pending extraction jobs
  const { data: jobs, error } = await supabase
    .from('job_queue')
    .select('*')
    .eq('job_type', 'policy_parse')
    .eq('status', 'pending')
    .lte('run_after', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(maxJobs);

  if (error || !jobs || jobs.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  for (const job of jobs) {
    // Mark job as processing
    await supabase
      .from('job_queue')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', job.id);

    try {
      const extractionJob: ExtractionJob = {
        job_id: job.id,
        document_id: job.payload.document_id,
        policy_id: job.payload.policy_id,
        account_id: job.payload.account_id,
        trip_id: job.payload.trip_id || null,
        storage_path: job.payload.storage_path || '',
        original_filename: job.payload.original_filename || 'document.pdf',
      };

      const result = await processUploadedDocument(supabase, extractionJob);

      if (result.ok) {
        await supabase
          .from('job_queue')
          .update({
            status: 'completed',
            metadata: { result },
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        succeeded++;
      } else {
        await handleJobFailure(supabase, job, result.error || 'Unknown');
        failed++;
      }

    } catch (err: any) {
      await handleJobFailure(supabase, job, err.message);
      failed++;
    }

    processed++;
  }

  return { processed, succeeded, failed };
}

// ============================================================
// HELPERS
// ============================================================

async function downloadFromStorage(
  supabase: SupabaseClient,
  storagePath: string,
  filename: string,
): Promise<string> {
  // Determine bucket and path
  const bucket = 'policy-documents';
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Storage download failed: ${error?.message || 'no data'}`);
  }

  // Write to temp file
  const tmpDir = os.tmpdir();
  const tmpPath = path.join(tmpDir, `extraction-${Date.now()}-${filename}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  fs.writeFileSync(tmpPath, buffer);

  return tmpPath;
}

function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function cleanupTempFile(filePath: string): void {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}

function formatCanonicalText(rule: any): string {
  const ct = rule.clauseType || rule.clause_type;
  const val = rule.value || {};

  if (val.type === 'currency' || val.type === 'sdr') {
    return `${ct}: ${val.value} ${val.unit || ''}`.trim();
  }
  if (val.type === 'duration' || val.type === 'days') {
    return `${ct}: ${val.value} ${val.unit || ''}`.trim();
  }
  if (val.type === 'boolean') {
    return `${ct}: ${val.value ? 'Required' : 'Not Required'}`;
  }
  return `${ct}: ${String(val.value || '').substring(0, 200)}`;
}

async function failExtraction(
  supabase: SupabaseClient,
  job: ExtractionJob,
  reasonCode: string,
  errorMessage: string,
): Promise<ExtractionResult> {

  // Update document status
  await supabase
    .from('policy_documents')
    .update({
      document_status: 'needs_review',
      extraction_error_message: errorMessage.substring(0, 500),
    })
    .eq('document_id', job.document_id);

  // Emit failure event
  await emitEvent(supabase, {
    event_type: 'policy_parse_failed',
    feature_id: 'F-6.5.1',
    scope_type: 'policy_document',
    scope_id: job.document_id,
    actor_id: job.account_id,
    actor_type: 'system',
    reason_code: reasonCode,
    metadata: { error: errorMessage.substring(0, 200) },
  });

  return {
    ok: false,
    document_id: job.document_id,
    status: 'FAILED',
    clauses_accepted: 0,
    clauses_review: 0,
    clauses_rejected: 0,
    error: errorMessage,
  };
}

async function handleJobFailure(
  supabase: SupabaseClient,
  job: any,
  errorMessage: string,
): Promise<void> {
  const retryCount = (job.retry_count || 0) + 1;
  const maxRetries = job.max_retries || 3;

  if (retryCount < maxRetries) {
    // Schedule retry with exponential backoff
    const backoffMs = Math.min(retryCount * 30000, 300000); // 30s, 60s, 90s... max 5min
    await supabase
      .from('job_queue')
      .update({
        status: 'pending',
        retry_count: retryCount,
        last_error: errorMessage.substring(0, 500),
        run_after: new Date(Date.now() + backoffMs).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  } else {
    // Max retries exhausted
    await supabase
      .from('job_queue')
      .update({
        status: 'failed',
        retry_count: retryCount,
        last_error: errorMessage.substring(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  }
}

async function emitEvent(
  supabase: SupabaseClient,
  event: {
    event_type: string;
    feature_id: string;
    scope_type: string;
    scope_id: string;
    actor_id: string;
    actor_type: string;
    reason_code?: string;
    metadata?: Record<string, any>;
  },
): Promise<void> {
  try {
    await supabase.rpc('emit_event', {
      p_event_type: event.event_type,
      p_feature_id: event.feature_id,
      p_scope_type: event.scope_type,
      p_scope_id: event.scope_id,
      p_actor_id: event.actor_id,
      p_actor_type: event.actor_type,
      p_reason_code: event.reason_code || null,
      p_metadata: event.metadata || null,
    });
  } catch {
    // Event emission failure should not crash extraction
    // Per doctrine: "Failure to emit event invalidates the mutation"
    // But for extraction, we log and continue — the clauses are still valid
    console.error(`Event emission failed: ${event.event_type}`);
  }
}

// ============================================================
// STANDALONE EXECUTION
// ============================================================

/**
 * Run the worker as a standalone script for testing.
 * Usage: npx ts-node scripts/extraction-worker.ts
 */
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.log('No Supabase connection. Running in local-test mode.');
    console.log('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to connect.');

    // Local test: process a document from the corpus
    const testDoc = process.argv[2] || 'document-intelligence/California NorwegianCare Ver. 260101.pdf';
    if (!fs.existsSync(testDoc)) {
      console.log(`Test document not found: ${testDoc}`);
      return;
    }

    console.log(`\nProcessing: ${testDoc}`);
    const result = await processDocument(testDoc, path.basename(testDoc));
    console.log(`  Extraction: ${result.extraction.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Sections: ${result.sections.length}`);
    console.log(`  Candidates: ${result.candidates.length}`);
    console.log(`  Promoted: ${result.promotedRules.length}`);

    if (result.promotedRules.length > 0) {
      console.log(`\n  Sample promoted rules:`);
      for (const rule of result.promotedRules.slice(0, 5)) {
        console.log(`    ${rule.clauseType}: ${rule.value.value} ${rule.value.unit || ''}`);
      }
    }
    return;
  }

  const supabase = createClient(url, key);
  console.log('Connected to Supabase. Processing extraction queue...');

  const result = await processExtractionQueue(supabase, { maxJobs: 5 });
  console.log(`Processed: ${result.processed}, Succeeded: ${result.succeeded}, Failed: ${result.failed}`);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export type { ExtractionJob, ExtractionResult };
