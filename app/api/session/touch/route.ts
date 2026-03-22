import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { clientIpFromRequest } from '@/lib/rate-limit/simple-memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST { clientSessionId: uuid } — upsert logical browser session for Account → Security.
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

  let body: { clientSessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const sessionId = typeof body.clientSessionId === 'string' ? body.clientSessionId.trim() : '';
  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return NextResponse.json({ ok: false, error: 'clientSessionId required' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service role not configured' }, { status: 503 });
  }

  const device = request.headers.get('user-agent')?.slice(0, 500) ?? '';
  const ip = clientIpFromRequest(request);

  await admin.from('user_sessions').update({ is_current: false }).eq('user_id', user.id).eq('is_revoked', false);

  const { error } = await admin.from('user_sessions').upsert(
    {
      session_id: sessionId,
      user_id: user.id,
      device_info: device,
      ip_address: ip,
      last_active_at: new Date().toISOString(),
      is_current: true,
      is_revoked: false,
      revoked_at: null,
    },
    { onConflict: 'session_id' },
  );

  if (error) {
    console.warn('[session/touch]', error.message);
    return NextResponse.json({ ok: false, error: 'Could not update session' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
