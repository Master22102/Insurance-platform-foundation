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
import { createServerClient } from '@supabase/ssr';
import { CONFIDENCE_VERSION, statusToConfidenceLabel } from '@/lib/confidence/labels';

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

  // Get document status
  const { data: doc, error } = await supabase
    .from('policy_documents')
    .select(`
      document_id,
      document_status,
      account_id,
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
  if (doc.account_id !== auth.user.id) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  // Keep client UX simple: only terminal states are "complete" / "failed".
  // Anything else is treated as "processing" for the UI poller.
  const uiStatus = doc.document_status === 'complete'
    ? 'complete'
    : doc.document_status === 'failed'
      ? 'failed'
      : 'processing';

  const confidenceLabel = statusToConfidenceLabel(doc.document_status);

  // Get clause counts if extraction is complete
  let clauseCounts = null;
  if (doc.document_status === 'complete') {
    const { data: clauses } = await supabase
      .from('policy_clauses')
      .select('extraction_status')
      .eq('policy_document_id', documentId);

    if (clauses) {
      const statuses = clauses.map((c: any) => String(c.extraction_status || '').toUpperCase());
      clauseCounts = {
        total: clauses.length,
        auto_accepted: statuses.filter((s) => s === 'AUTO_ACCEPTED').length,
        pending_review: statuses.filter((s) => s === 'PENDING_REVIEW').length,
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
    status: uiStatus,
    raw_status: doc.document_status,
    message: CALM_MESSAGES[doc.document_status] || CALM_MESSAGES.processing,
    extraction: {
      started_at: doc.extraction_started_at,
      completed_at: doc.extraction_completed_at,
      pipeline_version: doc.pipeline_version,
      error: doc.document_status === 'failed'
        ? "We couldn't read this document automatically. Your file is still saved."
        : undefined,
    },
    clauses: clauseCounts,
    rules_found: clauseCounts?.auto_accepted ?? null,
    confidence: {
      confidence_label: confidenceLabel,
      confidence_version: CONFIDENCE_VERSION,
      cco_reference_id: null,
    },
    job: job ? {
      id: job.id,
      status: job.status,
      retries: job.retry_count,
    } : null,
  });
}
