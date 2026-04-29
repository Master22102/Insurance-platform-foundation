import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mustEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return null;
  return { url, anon, service };
}

export async function POST(request: NextRequest) {
  const env = mustEnv();
  if (!env) return NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 });

  const authClient = createServerClient(env.url, env.anon, {
    cookies: {
      get: (name) => request.cookies.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await authClient
    .from('user_profiles')
    .select('membership_tier')
    .eq('user_id', user.id)
    .maybeSingle();
  if ((profile as { membership_tier?: string } | null)?.membership_tier !== 'FOUNDER') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  let body: { source_id?: string; validate_all?: boolean };
  try {
    body = (await request.json()) as { source_id?: string; validate_all?: boolean };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const sourceId = typeof body.source_id === 'string' ? body.source_id.trim() : undefined;
  const validateAll = body.validate_all === true;

  if (!sourceId && !validateAll) {
    return NextResponse.json({ ok: false, error: 'source_id or validate_all required' }, { status: 400 });
  }
  if (sourceId && !/^[a-z0-9_]+$/.test(sourceId)) {
    return NextResponse.json({ ok: false, error: 'Invalid source_id' }, { status: 400 });
  }

  const admin = createClient(env.url, env.service);
  const jobName = validateAll ? 'corpus_acquisition:validate_all' : `corpus_acquisition:${sourceId}`;
  const payload = {
    source_id: sourceId ?? null,
    validate_all: validateAll,
    queued_by: user.id,
    queued_at: new Date().toISOString(),
  };
  const { data: inserted, error } = await admin
    .from('job_queue')
    .insert({
      job_name: jobName,
      job_type: 'corpus_acquisition',
      status: 'pending',
      payload,
      metadata: { ...payload, result_status: null, result_notes: null },
    })
    .select('id, created_at')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: 'Failed to queue job' }, { status: 500 });
  }

  const jobId = inserted?.id as string;
  const queuedAt = (inserted?.created_at as string) || new Date().toISOString();

  return NextResponse.json({
    ok: true,
    job_id: jobId,
    source_id: sourceId ?? 'validate_all',
    queued_at: queuedAt,
    message: sourceId
      ? `Document library update queued for ${sourceId}. Run the local worker to download or validate.`
      : 'Check-all-sources job queued. Run the local worker to validate.',
  });
}
