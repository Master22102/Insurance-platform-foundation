import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const VALID_PATHS = new Set(['first_trip', 'returning', 'imported', 'browsing', 'anchor_pending']);

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('account_anchor_state')
      .select('anchor_path, first_anchored_at, updated_at')
      .eq('account_id', user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? { anchor_path: null });
  } catch (err) {
    console.error('[anchor-state:get]', err);
    return NextResponse.json({ error: 'Failed to load anchor state' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const path: string = body?.anchor_path;
    if (!path || !VALID_PATHS.has(path)) {
      return NextResponse.json({ error: 'invalid_anchor_path' }, { status: 400 });
    }

    const { error } = await supabase.rpc('upsert_anchor_state', {
      p_account_id: user.id,
      p_anchor_path: path,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ anchor_path: path, written_at: new Date().toISOString() });
  } catch (err) {
    console.error('[anchor-state:post]', err);
    return NextResponse.json({ error: 'Failed to write anchor state' }, { status: 500 });
  }
}
