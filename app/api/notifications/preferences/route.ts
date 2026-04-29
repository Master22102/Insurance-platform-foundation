import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { mergeNotificationPrefs, type NotificationPrefs } from '@/lib/notifications/prefs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseFromRequest(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get: (name) => req.cookies.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseFromRequest(request);
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const prefs = mergeNotificationPrefs(
    profile && typeof profile.preferences === 'object'
      ? (profile.preferences as Record<string, unknown>).notifications
      : undefined,
  );
  return NextResponse.json({ notifications: prefs });
}

export async function PUT(request: NextRequest) {
  const supabase = getSupabaseFromRequest(request);
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { notifications?: Partial<NotificationPrefs> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const nextPartial = body.notifications;
  if (!nextPartial || typeof nextPartial !== 'object') {
    return NextResponse.json({ error: 'notifications object required' }, { status: 400 });
  }

  const { data: profile, error: loadErr } = await supabase
    .from('user_profiles')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle();
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }

  const basePrefs =
    profile?.preferences && typeof profile.preferences === 'object'
      ? { ...(profile.preferences as Record<string, unknown>) }
      : {};
  const current = mergeNotificationPrefs(basePrefs.notifications);
  const nextCats = nextPartial.categories || {};
  const mergedCategories = { ...current.categories };
  for (const [key, raw] of Object.entries(nextCats)) {
    const ch = raw as { push?: boolean; email?: boolean; sms?: boolean } | undefined;
    const prev = mergedCategories[key] || { push: false, email: false, sms: false };
    mergedCategories[key] = {
      push: typeof ch?.push === 'boolean' ? ch.push : prev.push,
      email: typeof ch?.email === 'boolean' ? ch.email : prev.email,
      sms: typeof ch?.sms === 'boolean' ? ch.sms : prev.sms,
    };
  }
  const merged: NotificationPrefs = {
    ...current,
    ...nextPartial,
    categories: mergedCategories,
  };

  const preferences = { ...basePrefs, notifications: merged };
  const { error: saveErr } = await supabase.from('user_profiles').update({ preferences }).eq('user_id', user.id);
  if (saveErr) {
    return NextResponse.json({ error: saveErr.message }, { status: 500 });
  }

  return NextResponse.json({ notifications: merged });
}
