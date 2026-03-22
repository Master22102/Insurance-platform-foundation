import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const delegateName = String(body?.delegate_name || '').trim();
    const phoneE164 = String(body?.phone_e164 || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const roleTag = String(body?.role_tag || 'backup_contact').trim();
    const priorityLevel = Number(body?.priority_level || 1);

    if (!delegateName) {
      return NextResponse.json({ ok: false, error: 'delegate_name is required' }, { status: 400 });
    }
    if (!phoneE164 || !email) {
      return NextResponse.json({ ok: false, error: 'phone_e164 and email are required' }, { status: 400 });
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
    const { data, error } = await service.rpc('add_emergency_delegate', {
      p_owner_account_id: auth.user.id,
      p_delegate_name: delegateName,
      p_phone_e164: phoneE164,
      p_email: email,
      p_role_tag: roleTag || 'backup_contact',
      p_priority_level: Number.isFinite(priorityLevel) ? priorityLevel : 1,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: 'Unable to add emergency delegate right now.' }, { status: 500 });
    }
    if (!data?.success) {
      return NextResponse.json({ ok: false, error: 'Delegate could not be added.' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      delegate_id: data?.delegate_id || null,
      verification_status: data?.verification_status || null,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to add emergency delegate.' }, { status: 500 });
  }
}
