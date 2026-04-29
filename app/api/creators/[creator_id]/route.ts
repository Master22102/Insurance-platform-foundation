import { NextRequest, NextResponse } from 'next/server';
import { createCookieSupabase, isCreatorDiscoveryEnabled } from '@/lib/creators/governance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, ctx: { params: Promise<{ creator_id: string }> }) {
  const supabase = createCookieSupabase(request);
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const enabled = await isCreatorDiscoveryEnabled(supabase);
  if (!enabled) return NextResponse.json({ disabled: true });

  const { creator_id } = await ctx.params;
  if (!creator_id) return NextResponse.json({ error: 'creator_id required' }, { status: 400 });

  const { data: creator, error: cErr } = await supabase
    .from('creators')
    .select('*')
    .eq('creator_id', creator_id)
    .eq('is_active', true)
    .maybeSingle();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!creator) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: videos, error: vErr } = await supabase
    .from('creator_videos')
    .select('video_id, video_url, platform_video_id, title, description, published_at, view_count, thumbnail_url')
    .eq('creator_id', creator_id)
    .eq('is_active', true)
    .order('published_at', { ascending: false })
    .limit(200);
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

  return NextResponse.json({ creator, videos: videos || [] });
}

