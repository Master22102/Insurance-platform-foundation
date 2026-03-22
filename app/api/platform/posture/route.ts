import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
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
        set: (name, value, options) => {
          response.cookies.set({ name, value, ...options });
        },
        remove: (name, options) => {
          response.cookies.set({ name, value: '', ...options, maxAge: 0 });
        },
      },
    });
    const { data: auth, error: authError } = await authSupabase.auth.getUser();
    if (authError || !auth?.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const service = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await service
      .from('region_operational_state')
      .select('region_id, mode, updated_at')
      .eq('region_id', '00000000-0000-0000-0000-000000000000')
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      region_id: data?.region_id || '00000000-0000-0000-0000-000000000000',
      mode: data?.mode || 'PROTECTIVE',
      updated_at: data?.updated_at || null,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load platform posture.' }, { status: 500 });
  }
}
