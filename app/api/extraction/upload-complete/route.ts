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

export async function POST(request: NextRequest) {
  try {
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

    const { data: doc, error: docError } = await supabase
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

    const { error: updateError } = await supabase
      .from('policy_documents')
      .update({
        raw_artifact_path: storage_path,
        file_size_bytes: file_size_bytes || null,
        mime_type: mime_type || null,
        content_hash: hash_sha256 || null,
        document_status: 'queued',
      })
      .eq('document_id', document_id);
    if (updateError) throw updateError;

    const { data: job, error: jobError } = await supabase
      .from('job_queue')
      .insert({
        job_name: `extract-${document_id}`,
        job_type: 'policy_parse',
        payload: {
          document_id,
          policy_id: doc.policy_id,
          account_id: auth.user.id,
          trip_id: trip_id || doc.trip_id || null,
          storage_path,
          original_filename: policy_label,
          source_type: source_type || null,
        },
        status: 'pending',
        max_retries: 3,
      })
      .select('id')
      .single();
    if (jobError) throw jobError;

    response = NextResponse.json({
      ok: true,
      document_id,
      policy_id: doc.policy_id,
      job_id: job?.id,
      status: 'QUEUED',
      user_message: "Your document has been uploaded. We're reading it now — this usually takes a minute or two.",
    });
    return response;

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
