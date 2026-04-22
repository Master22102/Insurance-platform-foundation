import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const version = typeof body?.version === 'string' ? body.version : 'v1';

    const { data, error } = await supabase.rpc('record_privacy_acceptance', {
      p_account_id: user.id,
      p_version: version,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ event_id: data, accepted_at: new Date().toISOString(), version });
  } catch (err) {
    console.error('[accept-privacy]', err);
    return NextResponse.json({ error: 'Failed to record acceptance' }, { status: 500 });
  }
}
