import { NextRequest, NextResponse } from 'next/server';
import { createCookieSupabase, isCreatorDiscoveryEnabled } from '@/lib/creators/governance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, ctx: { params: Promise<{ video_id: string }> }) {
  const supabase = createCookieSupabase(request);
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const enabled = await isCreatorDiscoveryEnabled(supabase);
  if (!enabled) return NextResponse.json({ error: 'disabled' }, { status: 403 });

  const { video_id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as null | {
    trip_id?: string;
    activity_name?: string;
    city?: string;
    country_code?: string;
    notes?: string;
    booking_url?: string;
    date_hint?: string;
    source_tag_id?: string | null;
    source_extraction_id?: string | null;
    timestamp_seconds?: number | null;
  };

  if (!body?.trip_id) return NextResponse.json({ error: 'trip_id required' }, { status: 400 });
  if (!body?.activity_name) return NextResponse.json({ error: 'activity_name required' }, { status: 400 });

  // Paid tier check is trip-scoped by design in this product.
  const { data: trip } = await supabase
    .from('trips')
    .select('trip_id, paid_unlock')
    .eq('trip_id', body.trip_id)
    .maybeSingle();
  if (!trip) return NextResponse.json({ error: 'trip_not_found' }, { status: 404 });
  if (!(trip as any).paid_unlock) return NextResponse.json({ error: 'paid_required' }, { status: 402 });

  const { data: video } = await supabase
    .from('creator_videos')
    .select('video_id, creator_id, title, thumbnail_url, video_url')
    .eq('video_id', video_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!video) return NextResponse.json({ error: 'video_not_found' }, { status: 404 });

  const { data: creator } = await supabase
    .from('creators')
    .select('creator_id, creator_name, platform, platform_handle')
    .eq('creator_id', (video as any).creator_id)
    .eq('is_active', true)
    .maybeSingle();

  const attribution = creator
    ? `From ${(creator as any).creator_name}`
    : 'From creator video';

  const creatorContextLines = [
    attribution,
    creator ? `${(creator as any).platform}:${(creator as any).platform_handle}` : null,
    (video as any).title ? `Video: ${(video as any).title}` : null,
    body.source_tag_id ? `Tag: ${body.source_tag_id}` : null,
    body.source_extraction_id ? `Extraction: ${body.source_extraction_id}` : null,
    typeof body.timestamp_seconds === 'number' ? `Timestamp: ${body.timestamp_seconds}s` : null,
    (video as any).video_url ? `Watch: ${(video as any).video_url}` : null,
  ].filter(Boolean) as string[];

  // Hosted DBs tie activity_candidates to draft home (NOT NULL draft_version_id).
  let draftVersionId: string | null = null;
  const { data: ensured, error: ensureErr } = await supabase.rpc('ensure_trip_draft_version', {
    p_trip_id: body.trip_id,
    p_actor_id: user.id,
    p_draft_state: null,
    p_narration_text: null,
  });
  if (!ensureErr && ensured && typeof ensured === 'object' && ensured !== null) {
    const wid = (ensured as { draft_version_id?: string }).draft_version_id;
    if (wid) draftVersionId = wid;
  }
  if (!draftVersionId) {
    const { data: trow } = await supabase
      .from('trips')
      .select('active_draft_version_id, current_draft_version_id')
      .eq('trip_id', body.trip_id)
      .maybeSingle();
    draftVersionId =
      ((trow as { active_draft_version_id?: string | null } | null)?.active_draft_version_id ?? null) ||
      ((trow as { current_draft_version_id?: string | null } | null)?.current_draft_version_id ?? null) ||
      null;
  }

  const insertRow: Record<string, unknown> = {
    trip_id: body.trip_id,
    activity_name: body.activity_name,
    city: body.city ?? null,
    country_code: body.country_code ?? null,
    notes: `${creatorContextLines.join('\n')}${body.notes ? `\n\n${body.notes}` : ''}`,
    booking_url: body.booking_url ?? null,
    date_hint: body.date_hint ?? null,
    source: 'creator_linked',
    source_reference_id: (video as any).video_id,
    status: 'suggested',
  };
  if (draftVersionId) insertRow.draft_version_id = draftVersionId;

  const { data: inserted, error } = await supabase
    .from('activity_candidates')
    .insert(insertRow as any)
    .select('candidate_id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, candidate_id: (inserted as any)?.candidate_id });
}

