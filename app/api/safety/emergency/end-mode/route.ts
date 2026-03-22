import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const emergencyId = String(body?.emergency_mode_id || '').trim();
    if (!emergencyId) {
      return NextResponse.json({ ok: false, error: 'emergency_mode_id is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 });
    }

    let response = NextResponse.json({ ok: true });
    const authSupabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    });
    const { data: auth, error: authError } = await authSupabase.auth.getUser();
    if (authError || !auth?.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const service = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await service.rpc('end_emergency_mode_guardian_confirm', {
      p_emergency_id: emergencyId,
      p_actor_id: auth.user.id,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: 'Unable to end emergency mode right now.' }, { status: 500 });
    }
    if (!data?.success) {
      return NextResponse.json({ ok: false, error: 'Emergency mode could not be ended.' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      status: data?.status || 'ended',
      emergency_mode_id: emergencyId,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to end emergency mode.' }, { status: 500 });
  }
}
