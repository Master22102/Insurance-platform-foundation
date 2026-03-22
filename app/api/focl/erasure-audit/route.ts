import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { userRateLimitedJsonResponse } from '@/lib/rate-limit/simple-memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FounderGate = { error: NextResponse } | { userId: string };

async function requireFounder(request: NextRequest): Promise<FounderGate> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    return { error: NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 }) };
  }
  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get: (name) => request.cookies.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { error: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  }
  const { data: profile } = await supabase.from('user_profiles').select('membership_tier').eq('user_id', user.id).maybeSingle();
  if (profile?.membership_tier !== 'FOUNDER') {
    return { error: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }) };
  }
  return { userId: user.id };
}

/** GET — recent erasure log rows (service role). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireFounder(request);
  if ('error' in gate) {
    return gate.error;
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service role not configured' }, { status: 503 });
  }

  const { data, error } = await admin
    .from('erasure_redaction_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, rows: data ?? [] });
}

/** POST — operator-triggered erasure for a target account (legal / support). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireFounder(request);
  if ('error' in gate) {
    return gate.error;
  }

  const postLimited = userRateLimitedJsonResponse(gate.userId, 'focl-erasure-audit', 10, 15 * 60 * 1000);
  if (postLimited) return postLimited;

  let body: { targetAccountId?: string; requestReference?: string; jurisdiction?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const target = String(body.targetAccountId || '').trim();
  if (!target) {
    return NextResponse.json({ ok: false, error: 'targetAccountId required' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service role not configured' }, { status: 503 });
  }

  const { data, error } = await admin.rpc('process_erasure_request', {
    p_account_id: target,
    p_actor_id: gate.userId,
    p_actor_kind: 'operator',
    p_legal_basis: 'operator_initiated_erasure',
    p_jurisdiction: body.jurisdiction ?? null,
    p_request_reference: body.requestReference ?? null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, result: data });
}
