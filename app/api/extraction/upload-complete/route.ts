/**
 * POST /api/extraction/upload-complete
 * 
 * Called after file upload to Supabase Storage is confirmed.
 * The policy + document records already exist (created by initiate_policy_upload RPC).
 * This route updates the document with storage details and queues extraction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { document_id, storage_path, file_size_bytes, mime_type } = body;

    if (!document_id) {
      return NextResponse.json({ ok: false, error: 'document_id required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get existing document record
    const { data: doc, error: docError } = await supabase
      .from('policy_documents')
      .select('document_id, policy_id, account_id, trip_id')
      .eq('document_id', document_id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ ok: false, error: 'Document not found' }, { status: 404 });
    }

    // Update document with storage details
    if (storage_path) {
      await supabase
        .from('policy_documents')
        .update({
          raw_artifact_path: storage_path,
          file_size_bytes: file_size_bytes || null,
          mime_type: mime_type || null,
          document_status: 'processing',
        })
        .eq('document_id', document_id);
    }

    // Queue extraction job
    await supabase
      .from('job_queue')
      .insert({
        job_name: `extract-${document_id}`,
        job_type: 'policy_parse',
        payload: {
          document_id,
          policy_id: doc.policy_id,
          account_id: doc.account_id,
          trip_id: doc.trip_id,
          storage_path: storage_path || '',
        },
        status: 'pending',
        max_retries: 3,
      });

    return NextResponse.json({
      ok: true,
      document_id,
      status: 'PROCESSING',
    });

  } catch (err: any) {
    console.error('[upload-complete]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
