/**
 * POST /api/extraction/upload-complete
 * 
 * Called after file upload to Supabase Storage is confirmed.
 * Per F-6.5.1 Section 3.4: "On upload confirmation, a policy_parse_requested
 * job is inserted into job_queue."
 * 
 * Flow:
 *   1. Client uploads file directly to Supabase Storage (presigned URL)
 *   2. Client calls this endpoint with storage path + metadata
 *   3. This endpoint calls initiate_policy_upload() RPC
 *   4. RPC creates policy + document + queues extraction job
 *   5. Returns document_id for progress tracking
 * 
 * Traveler sees: "Uploaded → Processing → Complete (or Needs Review)"
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      account_id,
      trip_id,
      policy_label,
      storage_path,
      file_size_bytes,
      mime_type,
      hash_sha256,
      source_type,
    } = body;

    // Validate required fields
    if (!account_id) {
      return NextResponse.json({ ok: false, error: 'account_id required' }, { status: 400 });
    }
    if (!policy_label) {
      return NextResponse.json({ ok: false, error: 'policy_label required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call initiate_policy_upload() RPC — this creates policy + document + emits events
    const { data: uploadResult, error: uploadError } = await supabase.rpc(
      'initiate_policy_upload',
      {
        p_account_id: account_id,
        p_trip_id: trip_id || null,
        p_policy_label: policy_label,
        p_source_type: source_type || 'pdf_upload',
      },
    );

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: `Upload registration failed: ${uploadError.message}` },
        { status: 500 },
      );
    }

    if (!uploadResult?.ok) {
      return NextResponse.json({
        ok: false,
        error: uploadResult?.reason || 'Upload registration failed',
        status: uploadResult?.status,
      }, { status: 422 });
    }

    const { policy_id, document_id } = uploadResult;

    // Update document with storage details
    if (storage_path) {
      await supabase
        .from('policy_documents')
        .update({
          raw_artifact_path: storage_path,
          file_size_bytes: file_size_bytes || null,
          mime_type: mime_type || null,
          content_hash: hash_sha256 || null,
        })
        .eq('document_id', document_id);
    }

    // Queue extraction job
    const { data: job, error: jobError } = await supabase
      .from('job_queue')
      .insert({
        job_name: `extract-${document_id}`,
        job_type: 'policy_parse',
        payload: {
          document_id,
          policy_id,
          account_id,
          trip_id: trip_id || null,
          storage_path: storage_path || '',
          original_filename: policy_label,
        },
        status: 'pending',
        max_retries: 3,
      })
      .select('id')
      .single();

    return NextResponse.json({
      ok: true,
      policy_id,
      document_id,
      job_id: job?.id,
      status: 'QUEUED',
      message: 'Document registered and extraction queued.',
      // Calm Mode Language (per Section 7.2):
      user_message: 'Your document has been uploaded. We\'re reading it now — this usually takes a minute or two.',
    });

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
