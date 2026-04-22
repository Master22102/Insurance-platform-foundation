import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('user_signal_profile_versions')
      .select('version_id, parsed_payload, proposed_at, confirmed_at, source_voice_artifact_id')
      .eq('account_id', user.id)
      .order('proposed_at', { ascending: false })
      .limit(5);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const confirmed = (data ?? []).find((r: any) => r.confirmed_at) || null;
    return NextResponse.json({ latest: data?.[0] ?? null, confirmed, history: data ?? [] });
  } catch (err) {
    console.error('[signal-profile:get]', err);
    return NextResponse.json({ error: 'Failed to load signal profile' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const parsed_payload = body?.parsed_payload ?? {};
    const voice_artifact_id = body?.voice_artifact_id ?? null;

    const { data, error } = await supabase.rpc('propose_signal_profile', {
      p_account_id: user.id,
      p_parsed_payload: parsed_payload,
      p_source_voice_artifact_id: voice_artifact_id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ version_id: data, status: 'proposed' });
  } catch (err) {
    console.error('[signal-profile:post]', err);
    return NextResponse.json({ error: 'Failed to propose signal profile' }, { status: 500 });
  }
}
