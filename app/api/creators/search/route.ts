import { NextRequest, NextResponse } from 'next/server';
import { remainingCreatorSearchesToday } from '@/lib/creators/rate-limit';
import { createCookieSupabase, isCreatorDiscoveryEnabled, hasPaidCreatorMembership } from '@/lib/creators/governance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export async function GET(request: NextRequest) {
  const supabase = createCookieSupabase(request);
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const enabled = await isCreatorDiscoveryEnabled(supabase);
  if (!enabled) {
    return NextResponse.json({ disabled: true, creators: [], videos: [], total_count: 0 });
  }

  const q = (request.nextUrl.searchParams.get('q') || '').trim();
  const platform = (request.nextUrl.searchParams.get('platform') || '').trim().toLowerCase();
  const region = (request.nextUrl.searchParams.get('region') || '').trim();
  const style = (request.nextUrl.searchParams.get('style') || '').trim();
  const limitParam = Number(request.nextUrl.searchParams.get('limit') || 10);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(25, limitParam)) : 10;

  const { remaining } = await remainingCreatorSearchesToday(supabase, user.id, 100);
  if (remaining <= 0) {
    await supabase.from('creator_search_log').insert({
      account_id: user.id,
      query_text: q || '(empty)',
      result_count: 0,
      filters: { platform, region, style, limited: true },
    });
    return NextResponse.json({ error: 'rate_limited', limit_per_day: 100 }, { status: 429 });
  }

  const paid = await hasPaidCreatorMembership(supabase, user.id);

  // Search creators by name
  let creatorsQuery = supabase
    .from('creators')
    .select('creator_id, creator_name, platform, platform_handle, platform_url, region_focus, travel_style, subscriber_count, avatar_url, is_verified')
    .eq('is_active', true)
    .order('is_verified', { ascending: false })
    .limit(20);
  if (q) creatorsQuery = creatorsQuery.ilike('creator_name', `%${q}%`);
  if (platform) creatorsQuery = creatorsQuery.eq('platform', platform);

  // Search tags for video ids
  let tagVideoIds: string[] = [];
  if (q) {
    const { data: tagRows } = await supabase
      .from('video_location_tags')
      .select('video_id')
      .or(`place_name.ilike.%${q}%,city.ilike.%${q}%`)
      .limit(80);
    tagVideoIds = uniq((tagRows || []).map((r) => String((r as { video_id?: string }).video_id || '')).filter(Boolean));
  }

  // Search videos by title/description (manual MVP: ILIKE)
  let videosQuery = supabase
    .from('creator_videos')
    .select('video_id, creator_id, video_url, platform_video_id, title, description, published_at, view_count, thumbnail_url')
    .eq('is_active', true)
    .order('view_count', { ascending: false })
    .limit(200);
  if (q) videosQuery = videosQuery.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (platform) {
    // Derive from creator platform via join-like filter: filter videos by creator ids matching platform
    const { data: platformCreators } = await supabase
      .from('creators')
      .select('creator_id')
      .eq('platform', platform)
      .eq('is_active', true)
      .limit(2000);
    const ids = (platformCreators || []).map((r) => (r as { creator_id: string }).creator_id);
    if (ids.length) videosQuery = videosQuery.in('creator_id', ids);
    else videosQuery = videosQuery.in('creator_id', ['00000000-0000-0000-0000-000000000000']);
  }

  const [creatorsRes, videosRes] = await Promise.all([creatorsQuery, videosQuery]);
  const creators = (creatorsRes.data || []) as any[];
  let videos = (videosRes.data || []) as any[];

  if (tagVideoIds.length > 0) {
    // Merge in tag hits.
    const { data: tagHitVideos } = await supabase
      .from('creator_videos')
      .select('video_id, creator_id, video_url, platform_video_id, title, description, published_at, view_count, thumbnail_url')
      .in('video_id', tagVideoIds)
      .eq('is_active', true)
      .limit(200);
    videos = [...videos, ...((tagHitVideos || []) as any[])];
  }

  // Apply optional region/style filters at creator level by post-filtering.
  const creatorById = new Map<string, any>();
  if (creators.length) {
    for (const c of creators) creatorById.set(String(c.creator_id), c);
  } else {
    const ids = uniq(videos.map((v) => String(v.creator_id))).filter(Boolean);
    if (ids.length) {
      const { data } = await supabase
        .from('creators')
        .select('creator_id, creator_name, platform, platform_handle, platform_url, region_focus, travel_style, subscriber_count, avatar_url, is_verified')
        .in('creator_id', ids)
        .eq('is_active', true);
      for (const c of data || []) creatorById.set(String((c as any).creator_id), c);
    }
  }

  const passesCreatorFilters = (c: any) => {
    const rf = Array.isArray(c?.region_focus) ? c.region_focus.map(String) : [];
    const ts = Array.isArray(c?.travel_style) ? c.travel_style.map(String) : [];
    if (region && !rf.some((x: string) => x.toLowerCase().includes(region.toLowerCase()))) return false;
    if (style && !ts.some((x: string) => x.toLowerCase().includes(style.toLowerCase()))) return false;
    return true;
  };

  videos = videos
    .map((v) => ({ ...v, creator: creatorById.get(String(v.creator_id)) || null }))
    .filter((v) => v.creator && passesCreatorFilters(v.creator));

  // Dedup videos
  const seen = new Set<string>();
  const dedupVideos: any[] = [];
  for (const v of videos) {
    const id = String(v.video_id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    dedupVideos.push(v);
  }

  const total = dedupVideos.length;
  const tierCap = paid ? limit : Math.min(2, limit);
  const limitedVideos = dedupVideos.slice(0, tierCap);

  await supabase.from('creator_search_log').insert({
    account_id: user.id,
    query_text: q || '(empty)',
    result_count: total,
    filters: { platform, region, style, paid },
  });

  return NextResponse.json({
    creators: creators.filter(passesCreatorFilters).slice(0, 10),
    videos: limitedVideos,
    total_count: total,
    paid,
    free_tier_limit_applied: !paid,
    rate_limit_remaining: remaining - 1,
  });
}

