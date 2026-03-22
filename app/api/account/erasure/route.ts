import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { userRateLimitedJsonResponse } from '@/lib/rate-limit/simple-memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/account/erasure
 * Body: { password: string, confirmPhrase?: string }
 * Re-authenticates, then runs process_erasure_request via service role (PII nullification only).
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 });
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
  if (!user?.id || !user.email) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const erasureLimited = userRateLimitedJsonResponse(user.id, 'account-erasure', 3, 24 * 60 * 60 * 1000);
  if (erasureLimited) return erasureLimited;

  let body: { password?: string; confirmPhrase?: string };
  try {
    body = (await request.json()) as { password?: string; confirmPhrase?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const password = String(body.password || '').trim();
  if (!password) {
    return NextResponse.json({ ok: false, error: 'Password is required to confirm this request.' }, { status: 400 });
  }

  const confirm = String(body.confirmPhrase || '').trim();
  if (confirm !== 'ERASE MY PERSONAL DATA') {
    return NextResponse.json(
      {
        ok: false,
        error: 'Type the confirmation phrase exactly: ERASE MY PERSONAL DATA',
      },
      { status: 400 },
    );
  }

  const verifyClient = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signErr } = await verifyClient.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (signErr) {
    return NextResponse.json({ ok: false, error: 'Could not verify your password. Try again.' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: 'Erasure service is not configured (missing SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  const { data, error } = await admin.rpc('process_erasure_request', {
    p_account_id: user.id,
    p_actor_id: user.id,
    p_actor_kind: 'user',
    p_legal_basis: 'right_to_erasure',
    p_jurisdiction: null,
    p_request_reference: null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const row = data as Record<string, unknown> | null;
  if (!row?.ok) {
    return NextResponse.json({ ok: false, error: String(row?.error || 'Erasure failed') }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    summary: row,
    message:
      'Your personal data in Wayfarer has been redacted where supported. Your sign-in may still exist until you delete your account separately.',
  });
}
