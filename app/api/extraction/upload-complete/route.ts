/**
 * POST /api/extraction/upload-complete
 *
 * Called after file upload to Supabase Storage is confirmed.
 * Per F-6.5.1 Section 3.4: "On upload confirmation, a policy_parse_requested
 * job is inserted into job_queue."
 *
 * Important:
 * - The client already calls `initiate_policy_upload()` to create policy + policy_document.
 * - This endpoint ONLY attaches storage metadata to the document and enqueues the parse job.
 *
 * Auth:
 * - Uses the caller's Supabase session (RLS), not the service role key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
    const isLocalhost = request.nextUrl.hostname === 'localhost' || request.nextUrl.hostname === '127.0.0.1';
    if (!isLocalhost && proto !== 'https') {
      return NextResponse.json(
        { ok: false, error: 'A secure connection is required to complete uploads.' },
        { status: 426 },
      );
    }

    const body = await request.json();
    const {
      trip_id,
      policy_label,
      storage_path,
      file_size_bytes,
      mime_type,
      hash_sha256,
      source_type,
      document_id,
    } = body;

    // Validate required fields
    if (!document_id) return NextResponse.json({ ok: false, error: 'document_id required' }, { status: 400 });
    if (!storage_path) return NextResponse.json({ ok: false, error: 'storage_path required' }, { status: 400 });
    if (!policy_label) return NextResponse.json({ ok: false, error: 'policy_label required' }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 });
    }

    let response = NextResponse.json({ ok: true });
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) => { response.cookies.set({ name, value, ...options }); },
        remove: (name, options) => { response.cookies.set({ name, value: '', ...options, maxAge: 0 }); },
      },
    });

    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const writerSupabase = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : supabase;

    const { data: doc, error: docError } = await writerSupabase
      .from('policy_documents')
      .select('document_id, policy_id, account_id, trip_id')
      .eq('document_id', document_id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ ok: false, error: 'Document not found' }, { status: 404 });
    }
    if (doc.account_id !== auth.user.id) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    if (!storage_path.startsWith(`${auth.user.id}/`)) {
      return NextResponse.json({ ok: false, error: 'Invalid storage path' }, { status: 400 });
    }

    const pathParts = storage_path.split('/');
    const folder = pathParts.slice(0, -1).join('/');
    const fileName = pathParts[pathParts.length - 1];
    if (!folder || !fileName) {
      return NextResponse.json({ ok: false, error: 'Invalid storage path' }, { status: 400 });
    }
    const { data: storageEntries, error: storageListError } = await writerSupabase
      .storage
      .from('policy-documents')
      .list(folder, { search: fileName, limit: 1 });
    if (storageListError || !storageEntries?.some((entry) => entry.name === fileName)) {
      return NextResponse.json(
        { ok: false, error: 'Upload not confirmed yet. Please retry in a moment.' },
        { status: 409 },
      );
    }

    // In environments without service role configured, fail safely into terminal
    // "failed" state so traveler flow remains deterministic and transparent.
    if (!serviceRoleKey) {
      const { error: failUpdateError } = await writerSupabase
        .from('policy_documents')
        .update({
          document_status: 'failed',
          extraction_error_message: 'Extraction worker unavailable in this environment',
        })
        .eq('document_id', document_id);
      if (failUpdateError) throw failUpdateError;

      response = NextResponse.json({
        ok: true,
        document_id,
        policy_id: doc.policy_id,
        status: 'FAILED',
        user_message: 'Upload completed. Extraction is temporarily unavailable in this environment.',
      });
      return response;
    }

    const { data: enqueueResult, error: enqueueError } = await writerSupabase.rpc(
      'enqueue_policy_parse_job_atomic',
      {
        p_document_id: document_id,
        p_account_id: auth.user.id,
        p_storage_path: storage_path,
        p_policy_label: policy_label,
        p_trip_id: trip_id || doc.trip_id || null,
        p_source_type: source_type || null,
        p_file_size_bytes: file_size_bytes || null,
        p_mime_type: mime_type || null,
        p_content_hash: hash_sha256 || null,
      },
    );
    if (enqueueError) {
      return NextResponse.json(
        { ok: false, error: 'Your upload is saved, but processing could not start right now.' },
        { status: 500 },
      );
    }
    if (!enqueueResult?.ok) {
      return NextResponse.json(
        { ok: false, error: 'Your upload is saved, but processing could not start right now.' },
        { status: 500 },
      );
    }

    const jobId = enqueueResult?.job_id as string | undefined;

    /**
     * E2E / local dev: run extraction inline so Playwright does not depend on a background worker.
     * Enable with `E2E_EXTRACTION_SYNC=1` and `SUPABASE_SERVICE_ROLE_KEY` (same as `/api/extraction/process?sync=true`).
     */
    if (jobId && process.env.E2E_EXTRACTION_SYNC === '1') {
      try {
        const { processUploadedDocument } = await import('../../../../scripts/extraction-worker');
        const result = await processUploadedDocument(writerSupabase, {
          job_id: jobId,
          document_id,
          policy_id: doc.policy_id,
          account_id: auth.user.id,
          trip_id: trip_id || doc.trip_id || null,
          storage_path,
          original_filename: policy_label,
        });
        await writerSupabase
          .from('job_queue')
          .update({
            status: result.ok ? 'completed' : 'failed',
            metadata: { result },
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);
        response = NextResponse.json({
          ok: true,
          document_id,
          policy_id: doc.policy_id,
          job_id: jobId,
          status: result.ok ? 'COMPLETE' : 'FAILED',
          extraction_sync: true,
          user_message: result.ok
            ? 'Your document has been processed.'
            : "We weren't able to read this document automatically. Your file is still saved.",
        });
        return response;
      } catch (syncErr) {
        console.error('[upload-complete] E2E_EXTRACTION_SYNC inline extraction failed', syncErr);
        // Fall through: job stays queued for a real worker
      }
    }

    response = NextResponse.json({
      ok: true,
      document_id,
      policy_id: doc.policy_id,
      job_id: jobId,
      status: 'QUEUED',
      user_message: "Your document has been uploaded. We're reading it now — this usually takes a minute or two.",
    });
    return response;

  } catch (_err: any) {
    return NextResponse.json(
      { ok: false, error: 'We could not complete this upload right now. Please try again.' },
      { status: 500 },
    );
  }
}
