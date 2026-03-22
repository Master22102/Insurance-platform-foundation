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
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { userRateLimitedJsonResponse } from '@/lib/rate-limit/simple-memory';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const syncFromQuery = request.nextUrl.searchParams.get('sync') === 'true';
    const { document_id, sync: syncFromBody } = body;
    const sync = Boolean(syncFromQuery || syncFromBody);

    if (!document_id) {
      return NextResponse.json(
        { ok: false, error: 'document_id is required' },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: 'Server configuration missing' },
        { status: 500 },
      );
    }

    let response = NextResponse.json({ ok: true });
    const authSupabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) => {
          response.cookies.set({ name, value, ...options });
        },
        remove: (name, options) => {
          response.cookies.set({ name, value: '', ...options, maxAge: 0 });
        },
      },
    });
    const { data: auth, error: authError } = await authSupabase.auth.getUser();
    if (authError || !auth?.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const rl = userRateLimitedJsonResponse(auth.user.id, 'extraction-process', 20, 60 * 60 * 1000);
    if (rl) return rl;

    // Service role writes, but ownership is still enforced against caller.
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify document exists and belongs to caller
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
    if (doc.account_id !== auth.user.id) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
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

    const policyLabelFromPath = doc.raw_artifact_path?.split('/').pop() || 'policy-document';
    const { data: enqueueResult, error: enqueueError } = await supabase.rpc(
      'enqueue_policy_parse_job_atomic',
      {
        p_document_id: doc.document_id,
        p_account_id: auth.user.id,
        p_storage_path: doc.raw_artifact_path,
        p_policy_label: policyLabelFromPath,
        p_trip_id: doc.trip_id || null,
        p_source_type: doc.source_type || null,
      },
    );
    if (enqueueError || !enqueueResult?.ok) {
      return NextResponse.json(
        { ok: false, error: 'Your document is saved, but processing could not start right now.' },
        { status: 500 },
      );
    }

    const jobId = enqueueResult?.job_id;

    // If sync mode requested (testing), process immediately
    if (sync) {
      const { processUploadedDocument } = await import('../../../../scripts/extraction-worker');
      const result = await processUploadedDocument(supabase, {
        job_id: jobId,
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
        .eq('id', jobId);

      return NextResponse.json({
        ok: result.ok,
        status: result.status,
        document_id,
        job_id: jobId,
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
      job_id: jobId,
      message: 'Extraction job queued. Document will be processed shortly.',
    });

  } catch (_err: any) {
    return NextResponse.json(
      { ok: false, error: 'We could not start processing right now. Please try again.' },
      { status: 500 },
    );
  }
}
