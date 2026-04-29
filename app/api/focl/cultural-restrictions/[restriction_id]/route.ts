import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mustEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return null;
  return { url, anon, service };
}

async function requireFounder(request: NextRequest): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
  const env = mustEnv();
  if (!env) return { ok: false, res: NextResponse.json({ error: 'Server configuration missing' }, { status: 500 }) };
  const auth = createServerClient(env.url, env.anon, {
    cookies: {
      get: (name) => request.cookies.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });
  const { data } = await auth.auth.getUser();
  const user = data.user;
  if (!user?.id) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: prof } = await auth.from('user_profiles').select('membership_tier').eq('user_id', user.id).maybeSingle();
  if (prof?.membership_tier !== 'FOUNDER') {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, userId: user.id };
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ restriction_id: string }> }) {
  const env = mustEnv();
  if (!env) return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
  const gate = await requireFounder(request);
  if (!gate.ok) return gate.res;

  const { restriction_id } = await ctx.params;
  if (!restriction_id) return NextResponse.json({ error: 'restriction_id required' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const admin = createClient(env.url, env.service);
  const { data, error } = await admin
    .from('cultural_legal_restrictions')
    .update(body)
    .eq('restriction_id', restriction_id)
    .select('*')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

