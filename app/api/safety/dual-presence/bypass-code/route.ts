import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const emergencyId = String(body?.emergency_mode_id || '').trim();
    const expiresInHours = Number(body?.expires_in_hours || 24);
    const reasonCode = String(body?.reason_code || 'manual_bypass_request').trim();

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
    const { data, error } = await service.rpc('create_dual_presence_bypass_code', {
      p_account_id: auth.user.id,
      p_actor_id: auth.user.id,
      p_action_type: reasonCode || 'manual_bypass_request',
      p_expires_in_hours: Number.isFinite(expiresInHours) ? expiresInHours : 24,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: 'Bypass code request failed. Please try again.' }, { status: 500 });
    }
    if (!data?.success) {
      return NextResponse.json({ ok: false, error: 'Bypass code could not be created.' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      bypass_code: data?.bypass_code,
      expires_at: data?.expires_at || null,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to create bypass code.' }, { status: 500 });
  }
}
