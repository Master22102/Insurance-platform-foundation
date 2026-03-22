import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const authSupabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    });
    const { data: auth, error: authError } = await authSupabase.auth.getUser();
    if (authError || !auth?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data: profile } = await authSupabase
      .from('user_profiles')
      .select('membership_tier')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if ((profile as { membership_tier?: string } | null)?.membership_tier !== 'FOUNDER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase
      .from('retention_policies')
      .select('policy_name, target_table, jurisdiction, retention_days, legal_basis, legal_citation, auto_delete, notes')
      .order('jurisdiction', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Could not load retention policies right now.' }, { status: 500 });
    }

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      policies: data ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
