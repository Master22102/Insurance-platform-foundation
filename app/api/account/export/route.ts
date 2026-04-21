import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [tripsRes, incidentsRes, policiesRes, evidenceRes] = await Promise.all([
    supabase.from('trips').select('*').eq('account_id', user.id),
    supabase.from('incidents').select('*').eq('account_id', user.id),
    supabase.from('policies').select('policy_id, policy_label, provider_name, trip_id, lifecycle_state, created_at'),
    supabase.from('evidence').select('*').eq('account_id', user.id),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    user_id: user.id,
    email: user.email,
    trips: tripsRes.data || [],
    incidents: incidentsRes.data || [],
    policies: policiesRes.data || [],
    evidence: evidenceRes.data || [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="wayfarer-export-${new Date().toISOString().split('T')[0]}.json"`,
    },
  });
}
