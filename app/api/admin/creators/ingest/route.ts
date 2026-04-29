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

async function requireFounder(
  request: NextRequest,
): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
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

type IngestBody = {
  creator: {
    creator_name: string;
    platform_handle?: string | null;
    platform_url?: string | null;
    avatar_url?: string | null;
    subscriber_count?: number | null;
    region_focus?: string[] | null;
    travel_style?: string[] | null;
    is_verified?: boolean;
    is_active?: boolean;
  };
  video: {
    title: string;
    description?: string | null;
    platform_video_id?: string | null;
    video_url: string;
    thumbnail_url?: string | null;
    published_at?: string | null;
    view_count?: number | null;
    is_active?: boolean;
  };
  location_tags?: Array<{
    timestamp_seconds: number;
    sort_order?: number;
    country_code?: string | null;
    city?: string | null;
    place_name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    metadata?: Record<string, unknown>;
  }>;
  activities?: Array<{
    tag_sort_order?: number | null; // resolves tag_id by matching sort_order
    activity_name: string;
    activity_description?: string | null;
    estimated_cost_usd?: number | null;
    estimated_duration_minutes?: number | null;
    confidence_score?: number | null;
    extraction_method?: 'manual';
    metadata?: Record<string, unknown>;
  }>;
};

export async function POST(request: NextRequest) {
  const env = mustEnv();
  if (!env) return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
  const gate = await requireFounder(request);
  if (!gate.ok) return gate.res;

  let body: IngestBody;
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body?.creator?.creator_name || !body?.creator?.platform) {
    return NextResponse.json({ error: 'creator.creator_name and creator.platform required' }, { status: 400 });
  }
  if (!body?.video?.title || !body?.video?.video_url) {
    return NextResponse.json({ error: 'video.title and video.video_url required' }, { status: 400 });
  }

  const admin = createClient(env.url, env.service);

  // 1) Upsert creator (manual idempotency by platform+handle when present)
  let creatorId: string | null = null;
  if (body.creator.platform_handle) {
    const { data: existing } = await admin
      .from('creators')
      .select('creator_id')
      .eq('platform', body.creator.platform)
      .eq('platform_handle', body.creator.platform_handle)
      .maybeSingle();
    creatorId = (existing as any)?.creator_id ?? null;
  }

  if (!creatorId) {
    const { data: inserted, error } = await admin
      .from('creators')
      .insert({
        creator_name: body.creator.creator_name,
        platform: body.creator.platform,
        platform_handle: body.creator.platform_handle ?? null,
        platform_url: body.creator.platform_url ?? null,
        avatar_url: body.creator.avatar_url ?? null,
        subscriber_count: body.creator.subscriber_count ?? null,
        region_focus: body.creator.region_focus ?? [],
        travel_style: body.creator.travel_style ?? [],
        is_verified: body.creator.is_verified ?? false,
        is_active: body.creator.is_active ?? true,
      })
      .select('creator_id')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    creatorId = (inserted as any)?.creator_id ?? null;
  }

  if (!creatorId) return NextResponse.json({ error: 'failed_to_create_creator' }, { status: 500 });

  // 2) Insert video (idempotent by platform_video_id when present)
  let videoId: string | null = null;
  if (body.video.platform_video_id) {
    const { data: existingVideo } = await admin
      .from('creator_videos')
      .select('video_id')
      .eq('platform_video_id', body.video.platform_video_id)
      .eq('creator_id', creatorId)
      .maybeSingle();
    videoId = (existingVideo as any)?.video_id ?? null;
  }

  if (!videoId) {
    const { data: insertedVideo, error: vErr } = await admin
      .from('creator_videos')
      .insert({
        creator_id: creatorId,
        title: body.video.title,
        description: body.video.description ?? null,
        platform_video_id: body.video.platform_video_id ?? null,
        video_url: body.video.video_url,
        thumbnail_url: body.video.thumbnail_url ?? null,
        published_at: body.video.published_at ?? null,
        view_count: body.video.view_count ?? null,
        is_active: body.video.is_active ?? true,
      })
      .select('video_id')
      .maybeSingle();
    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
    videoId = (insertedVideo as any)?.video_id ?? null;
  }

  if (!videoId) return NextResponse.json({ error: 'failed_to_create_video' }, { status: 500 });

  // 3) Insert tags
  const tagsBySort = new Map<number, string>();
  const tags = body.location_tags || [];
  for (let i = 0; i < tags.length; i++) {
    const t = tags[i]!;
    const sortOrder = Number.isFinite(t.sort_order) ? (t.sort_order as number) : i;
    const { data: tagRow, error: tErr } = await admin
      .from('video_location_tags')
      .insert({
        video_id: videoId,
        timestamp_seconds: t.timestamp_seconds,
        sort_order: sortOrder,
        country_code: t.country_code ?? null,
        city: t.city ?? null,
        place_name: t.place_name ?? null,
        latitude: t.latitude ?? null,
        longitude: t.longitude ?? null,
        metadata: t.metadata ?? {},
      })
      .select('tag_id')
      .maybeSingle();
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    if ((tagRow as any)?.tag_id) tagsBySort.set(sortOrder, (tagRow as any).tag_id);
  }

  // 4) Insert activities
  const acts = body.activities || [];
  for (const a of acts) {
    const tagId =
      typeof a.tag_sort_order === 'number' ? (tagsBySort.get(a.tag_sort_order) ?? null) : null;
    const { error: aErr } = await admin.from('video_activity_extractions').insert({
      video_id: videoId,
      tag_id: tagId,
      activity_name: a.activity_name,
      activity_description: a.activity_description ?? null,
      estimated_cost_usd: a.estimated_cost_usd ?? null,
      estimated_duration_minutes: a.estimated_duration_minutes ?? null,
      confidence_score: a.confidence_score ?? 1.0,
      extraction_method: a.extraction_method ?? 'manual',
      metadata: a.metadata ?? {},
    });
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, creator_id: creatorId, video_id: videoId });
}

