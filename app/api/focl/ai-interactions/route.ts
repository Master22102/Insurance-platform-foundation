import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FounderGate = { error: NextResponse } | { userId: string };

async function requireFounder(request: NextRequest): Promise<FounderGate> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    return { error: NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 }) };
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
  if (!user?.id) {
    return { error: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  }
  const { data: profile } = await supabase.from('user_profiles').select('membership_tier').eq('user_id', user.id).maybeSingle();
  if (profile?.membership_tier !== 'FOUNDER') {
    return { error: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }) };
  }
  return { userId: user.id };
}

/** GET summary + recent flagged rows for FOCL AI monitor */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireFounder(request);
  if ('error' in gate) {
    return gate.error;
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service role not configured' }, { status: 503 });
  }

  const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: dayRows } = await admin.from('ai_interaction_log').select('interaction_type, cost_usd, flagged').gte('created_at', sinceDay);

  const { data: monthRows } = await admin
    .from('ai_interaction_log')
    .select('interaction_type, cost_usd')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const { data: flagged } = await admin
    .from('ai_interaction_log')
    .select('interaction_id, user_id, interaction_type, flag_reason, created_at, model_used')
    .eq('flagged', true)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: weekUsage } = await admin.from('ai_interaction_log').select('user_id, cost_usd').gte('created_at', sinceWeek);

  const topUsersMap = (weekUsage || []).reduce<Record<string, { count: number; cost: number }>>((acc, r) => {
    const uid = String(r.user_id);
    if (!acc[uid]) acc[uid] = { count: 0, cost: 0 };
    acc[uid].count += 1;
    acc[uid].cost += Number(r.cost_usd || 0);
    return acc;
  }, {});
  const top_users_week = Object.entries(topUsersMap)
    .map(([user_id, v]) => ({ user_id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const sumCost = (rows: { cost_usd?: string | number | null }[] | null) =>
    (rows || []).reduce((s, r) => s + Number(r.cost_usd || 0), 0);

  return NextResponse.json({
    ok: true,
    summary: {
      count_today: (dayRows || []).length,
      count_week: (weekUsage || []).length,
      count_month: (monthRows || []).length,
      cost_today_usd: sumCost(dayRows || []),
      cost_week_usd: sumCost(weekUsage || []),
      cost_month_usd: sumCost(monthRows || []),
      flagged_today: (dayRows || []).filter((r) => r.flagged).length,
    },
    by_type_today: Object.fromEntries(
      Object.entries(
        (dayRows || []).reduce<Record<string, number>>((acc, r) => {
          const k = String(r.interaction_type);
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {}),
      ),
    ),
    flagged_recent: flagged || [],
    top_users_week,
  });
}
