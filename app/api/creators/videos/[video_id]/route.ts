import { NextRequest, NextResponse } from 'next/server';
import { createCookieSupabase, isCreatorDiscoveryEnabled, hasPaidCreatorMembership } from '@/lib/creators/governance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, ctx: { params: Promise<{ video_id: string }> }) {
  const supabase = createCookieSupabase(request);
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const enabled = await isCreatorDiscoveryEnabled(supabase);
  if (!enabled) return NextResponse.json({ disabled: true }, { status: 200 });

  const { video_id } = await ctx.params;
  if (!video_id) return NextResponse.json({ error: 'video_id required' }, { status: 400 });

  const paid = await hasPaidCreatorMembership(supabase, user.id);

  let can_add_to_trip: boolean | null = null;
  const tripIdParam = request.nextUrl.searchParams.get('trip_id');
  if (tripIdParam) {
    const { data: tripRow } = await supabase
      .from('trips')
      .select('trip_id, paid_unlock')
      .eq('trip_id', tripIdParam)
      .maybeSingle();
    can_add_to_trip = Boolean((tripRow as { paid_unlock?: boolean } | null)?.paid_unlock);
  }

  const { data: video, error: vErr } = await supabase
    .from('creator_videos')
    .select('*')
    .eq('video_id', video_id)
    .eq('is_active', true)
    .maybeSingle();
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
  if (!video) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: creator } = await supabase
    .from('creators')
    .select('creator_id, creator_name, platform, platform_handle, platform_url, avatar_url, subscriber_count, region_focus, travel_style, is_verified')
    .eq('creator_id', (video as any).creator_id)
    .eq('is_active', true)
    .maybeSingle();

  const { data: tags } = await supabase
    .from('video_location_tags')
    .select('*')
    .eq('video_id', video_id)
    .order('sort_order', { ascending: true })
    .limit(paid ? 200 : 2);

  const { data: activities } = await supabase
    .from('video_activity_extractions')
    .select('*')
    .eq('video_id', video_id)
    .order('created_at', { ascending: true })
    .limit(paid ? 200 : 2);

  const safeActivities = paid
    ? activities || []
    : (activities || []).map((a: any) => ({
        activity_name: a.activity_name,
        activity_description: a.activity_description,
        estimated_cost_usd: a.estimated_cost_usd,
        estimated_duration_minutes: a.estimated_duration_minutes,
        confidence_score: a.confidence_score,
        extraction_method: a.extraction_method,
      }));

  return NextResponse.json({
    paid,
    can_add_to_trip,
    creator,
    video,
    location_tags: tags || [],
    activities: safeActivities,
    free_tier_tag_limit_applied: !paid,
  });
}

