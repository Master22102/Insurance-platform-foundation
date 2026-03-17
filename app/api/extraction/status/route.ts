/**
 * GET /api/extraction/status?document_id=xxx
 * 
 * Returns current extraction status for a policy document.
 * Per F-6.5.1: "Uploaded → Processing → Complete (or Needs Review)"
 * 
 * Calm Mode responses (per Section 7.2):
 *   uploaded:    "Your document has been uploaded."
 *   processing:  "We're reading your document now."
 *   complete:    "Your document has been processed. Coverage information is available."
 *   needs_review: "Almost done — a few sections are being verified."
 *   failed:      "We weren't able to read this document. Your document is safely stored."
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CALM_MESSAGES: Record<string, string> = {
  uploaded: 'Your document has been uploaded.',
  queued: 'Your document is queued for processing.',
  processing: "We're reading your document now. This usually takes a minute or two.",
  complete: 'Your document has been processed. Coverage information is available.',
  needs_review: "Almost done — a few sections are being verified.",
  failed: "We weren't able to automatically read this document. Your document is safely stored. A team member will review it.",
};

export async function GET(request: NextRequest) {
  const documentId = request.nextUrl.searchParams.get('document_id');

  if (!documentId) {
    return NextResponse.json({ ok: false, error: 'document_id required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get document status
  const { data: doc, error } = await supabase
    .from('policy_documents')
    .select(`
      document_id,
      document_status,
      extraction_started_at,
      extraction_completed_at,
      extraction_error_message,
      pipeline_version,
      policy_id
    `)
    .eq('document_id', documentId)
    .single();

  if (error || !doc) {
    return NextResponse.json({ ok: false, error: 'Document not found' }, { status: 404 });
  }

  // Get clause counts if extraction is complete
  let clauseCounts = null;
  if (doc.document_status === 'complete') {
    const { data: clauses } = await supabase
      .from('policy_clauses')
      .select('extraction_status')
      .eq('policy_document_id', documentId);

    if (clauses) {
      clauseCounts = {
        total: clauses.length,
        auto_accepted: clauses.filter((c: any) => c.extraction_status === 'AUTO_ACCEPTED').length,
        pending_review: clauses.filter((c: any) => c.extraction_status === 'PENDING_REVIEW').length,
      };
    }
  }

  // Check job queue status
  const { data: jobs } = await supabase
    .from('job_queue')
    .select('id, status, retry_count, last_error')
    .eq('job_type', 'policy_parse')
    .contains('payload', { document_id: documentId })
    .order('created_at', { ascending: false })
    .limit(1);

  const job = jobs?.[0] || null;

  return NextResponse.json({
    ok: true,
    document_id: documentId,
    status: doc.document_status,
    message: CALM_MESSAGES[doc.document_status] || CALM_MESSAGES['processing'],
    extraction: {
      started_at: doc.extraction_started_at,
      completed_at: doc.extraction_completed_at,
      pipeline_version: doc.pipeline_version,
      error: doc.document_status === 'failed' ? doc.extraction_error_message : undefined,
    },
    clauses: clauseCounts,
    job: job ? {
      id: job.id,
      status: job.status,
      retries: job.retry_count,
    } : null,
  });
}
