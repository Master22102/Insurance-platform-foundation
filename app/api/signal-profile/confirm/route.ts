import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const version_id: string | undefined = body?.version_id;
    if (!version_id) return NextResponse.json({ error: 'version_id_required' }, { status: 400 });

    const { data, error } = await supabase.rpc('confirm_signal_profile', {
      p_version_id: version_id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ version_id: data, status: 'confirmed' });
  } catch (err) {
    console.error('[signal-profile:confirm]', err);
    return NextResponse.json({ error: 'Failed to confirm signal profile' }, { status: 500 });
  }
}
