/**
 * POST /api/extraction/process
 * 
 * Triggers extraction for a specific policy document.
 * Called after upload is confirmed (file in storage, document_id exists).
 * 
 * Flow:
 *   1. Validate request (document_id, auth)
 *   2. Insert extraction job into job_queue
 *   3. Optionally process synchronously (for small docs / testing)
 *   4. Return job status
 * 
 * Per F-6.5.1: extraction is async by default.
 * The job_queue worker picks up pending jobs and processes them.
 * 
 * For testing/development, pass ?sync=true to process immediately.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { document_id, sync } = body;

    if (!document_id) {
      return NextResponse.json(
        { ok: false, error: 'document_id is required' },
        { status: 400 },
      );
    }

    // Get Supabase client with service role for worker operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { ok: false, error: 'Server configuration missing' },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify document exists
    const { data: doc, error: docError } = await supabase
      .from('policy_documents')
      .select('document_id, policy_id, account_id, trip_id, source_type, document_status, raw_artifact_path')
      .eq('document_id', document_id)
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { ok: false, error: 'Document not found' },
        { status: 404 },
      );
    }

    // Don't re-process completed documents
    if (doc.document_status === 'complete') {
      return NextResponse.json({
        ok: true,
        status: 'ALREADY_COMPLETE',
        document_id,
        message: 'Document has already been extracted',
      });
    }

    // Insert job into queue
    const { data: job, error: jobError } = await supabase
      .from('job_queue')
      .insert({
        job_name: `extract-${document_id}`,
        job_type: 'policy_parse',
        payload: {
          document_id: doc.document_id,
          policy_id: doc.policy_id,
          account_id: doc.account_id,
          trip_id: doc.trip_id,
          storage_path: doc.raw_artifact_path,
          original_filename: doc.raw_artifact_path?.split('/').pop() || 'document.pdf',
        },
        status: 'pending',
        max_retries: 3,
      })
      .select()
      .single();

    if (jobError) {
      return NextResponse.json(
        { ok: false, error: `Job creation failed: ${jobError.message}` },
        { status: 500 },
      );
    }

    // Emit queued event
    await supabase.rpc('emit_event', {
      p_event_type: 'policy_parse_queued',
      p_feature_id: 'F-6.5.1',
      p_scope_type: 'policy_document',
      p_scope_id: document_id,
      p_actor_id: doc.account_id,
      p_actor_type: 'system',
      p_reason_code: 'API_TRIGGERED',
      p_metadata: { job_id: job.id },
    });

    // If sync mode requested (testing), process immediately
    if (sync) {
      const { processUploadedDocument } = await import('../../../../scripts/extraction-worker');
      const result = await processUploadedDocument(supabase, {
        job_id: job.id,
        document_id: doc.document_id,
        policy_id: doc.policy_id,
        account_id: doc.account_id,
        trip_id: doc.trip_id,
        storage_path: doc.raw_artifact_path || '',
        original_filename: doc.raw_artifact_path?.split('/').pop() || 'document.pdf',
      });

      // Update job status
      await supabase
        .from('job_queue')
        .update({
          status: result.ok ? 'completed' : 'failed',
          metadata: { result },
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      return NextResponse.json({
        ok: result.ok,
        status: result.status,
        document_id,
        job_id: job.id,
        clauses_accepted: result.clauses_accepted,
        clauses_review: result.clauses_review,
        version_id: result.version_id,
        sync: true,
      });
    }

    // Async mode (default): return immediately, worker processes later
    return NextResponse.json({
      ok: true,
      status: 'QUEUED',
      document_id,
      job_id: job.id,
      message: 'Extraction job queued. Document will be processed shortly.',
    });

  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 },
    );
  }
}
