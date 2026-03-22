/**
 * POST /api/e2e/complete-deep-scan-job
 *
 * Completes a pending `job_queue` row for `job_type = 'deep_scan'` with a minimal result payload
 * so `DeepScanPanel` E2E can assert UI without a background scan worker.
 *
 * Guarded by **`E2E_DEEP_SCAN_AUTOCOMPLETE=1`** (set by Playwright `webServer` env). Returns 404 otherwise.
 * Requires authenticated session + job payload `user_id` matching the caller.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const DEEP_SCAN_RESULT = {
  policies_analyzed: 1,
  clauses_reviewed: 2,
  signals: [
    {
      type: 'positive',
      title: 'Fixture: coverage signal',
      description: 'E2E stub deep scan result for deterministic UI.',
      confidence: 'HIGH_STRUCTURAL_ALIGNMENT',
    },
    {
      type: 'gap',
      title: 'Fixture: itinerary gap',
      description: 'E2E stub gap signal.',
      confidence: 'CONDITIONAL_ALIGNMENT',
    },
  ],
};

export async function POST(request: NextRequest) {
  if (process.env.E2E_DEEP_SCAN_AUTOCOMPLETE !== '1') {
    return NextResponse.json({ ok: false, error: 'Not available' }, { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 });
  }

  const authClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      get: (name) => request.cookies.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });

  const { data: auth, error: authError } = await authClient.auth.getUser();
  if (authError || !auth?.user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { job_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const jobId = body.job_id;
  if (!jobId) {
    return NextResponse.json({ ok: false, error: 'job_id required' }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: row, error: fetchErr } = await admin
    .from('job_queue')
    .select('id, job_type, payload, metadata, status')
    .eq('id', jobId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });
  }

  if (row.job_type !== 'deep_scan') {
    return NextResponse.json({ ok: false, error: 'Not a deep_scan job' }, { status: 400 });
  }

  const payload = (row.payload || {}) as Record<string, unknown>;
  const owner = String(payload.user_id || '');
  if (!owner || owner !== auth.user.id) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const prevMeta = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<
    string,
    unknown
  >;

  const { error: updErr } = await admin
    .from('job_queue')
    .update({
      status: 'completed',
      metadata: {
        ...prevMeta,
        deep_scan_result: DEEP_SCAN_RESULT,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, job_id: jobId });
}
