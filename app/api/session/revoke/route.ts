import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  /** Current browser logical session (kept active when revoking others). */
  clientSessionId?: string;
  /** Revoke one session by id. */
  sessionId?: string;
  /** When true, revoke every session except clientSessionId. */
  revokeOthers?: boolean;
};

/**
 * POST — soft-revoke rows in user_sessions (tokens may remain valid until expiry).
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anon) {
    return NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 });
  }

  const supabase = createServerClient(supabaseUrl, anon, {
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
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service role not configured' }, { status: 503 });
  }

  const now = new Date().toISOString();

  if (body.revokeOthers) {
    const keep = typeof body.clientSessionId === 'string' ? body.clientSessionId.trim() : '';
    if (!keep || !/^[0-9a-f-]{36}$/i.test(keep)) {
      return NextResponse.json({ ok: false, error: 'clientSessionId required' }, { status: 400 });
    }
    const { error } = await admin
      .from('user_sessions')
      .update({ is_revoked: true, revoked_at: now })
      .eq('user_id', user.id)
      .eq('is_revoked', false)
      .neq('session_id', keep);
    if (error) {
      console.warn('[session/revoke] revokeOthers', error.message);
      return NextResponse.json({ ok: false, error: 'Could not revoke sessions' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const sid = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!sid || !/^[0-9a-f-]{36}$/i.test(sid)) {
    return NextResponse.json({ ok: false, error: 'sessionId required' }, { status: 400 });
  }

  const { data: row, error: selErr } = await admin
    .from('user_sessions')
    .select('session_id, user_id')
    .eq('session_id', sid)
    .maybeSingle();

  if (selErr || !row || row.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
  }

  const { error } = await admin
    .from('user_sessions')
    .update({ is_revoked: true, revoked_at: now })
    .eq('session_id', sid)
    .eq('user_id', user.id);

  if (error) {
    console.warn('[session/revoke]', error.message);
    return NextResponse.json({ ok: false, error: 'Could not revoke session' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
