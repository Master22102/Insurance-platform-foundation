import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

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

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('membership_tier')
    .eq('user_id', user.id)
    .maybeSingle();
  if ((profile as { membership_tier?: string } | null)?.membership_tier !== 'FOUNDER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startWeek = new Date();
  startWeek.setDate(startWeek.getDate() - 7);

  const { count: todayCount } = await admin
    .from('notification_queue')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startToday.toISOString());

  const { count: weekCount } = await admin
    .from('notification_queue')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startWeek.toISOString());

  const { data: byChannel } = await admin.from('notification_queue').select('channel, delivery_status').gte('created_at', startWeek.toISOString());

  const channelTotals: Record<string, { sent: number; failed: number; total: number }> = {};
  for (const row of byChannel || []) {
    const ch = String((row as { channel?: string }).channel || 'unknown');
    if (!channelTotals[ch]) channelTotals[ch] = { sent: 0, failed: 0, total: 0 };
    channelTotals[ch].total += 1;
    const st = String((row as { delivery_status?: string }).delivery_status || '');
    if (st === 'sent' || st === 'delivered') channelTotals[ch].sent += 1;
    if (st === 'failed') channelTotals[ch].failed += 1;
  }

  const { data: recentFails } = await admin
    .from('notification_queue')
    .select('notification_id, channel, category, failure_reason, created_at')
    .eq('delivery_status', 'failed')
    .order('created_at', { ascending: false })
    .limit(25);

  const { count: rateLimited } = await admin
    .from('notification_queue')
    .select('*', { count: 'exact', head: true })
    .eq('delivery_status', 'rate_limited')
    .gte('created_at', startWeek.toISOString());

  const { data: catRows } = await admin.from('notification_queue').select('category').gte('created_at', startWeek.toISOString());
  const categoryVolume: Record<string, number> = {};
  for (const row of catRows || []) {
    const c = String((row as { category?: string }).category || 'unknown');
    categoryVolume[c] = (categoryVolume[c] || 0) + 1;
  }
  const topCategories = Object.entries(categoryVolume)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([category, count]) => ({ category, count }));

  return NextResponse.json({
    today_total: todayCount ?? 0,
    week_total: weekCount ?? 0,
    channel_success: channelTotals,
    rate_limited_week: rateLimited ?? 0,
    recent_failures: recentFails || [],
    top_categories_week: topCategories,
  });
}
