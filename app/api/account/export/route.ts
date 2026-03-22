import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get: (name) => request.cookies.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: entitlement, error: entitlementError } = await supabase.rpc('check_membership_entitlement', {
    p_user_id: user.id,
    p_feature_check: 'export_data',
    p_trip_id: null,
  });
  if (entitlementError || !entitlement?.allowed) {
    return NextResponse.json({ error: 'Export is not available for this account tier.' }, { status: 403 });
  }

  const [tripsRes, incidentsRes, policiesRes, evidenceRes] = await Promise.all([
    supabase.from('trips').select('*').eq('account_id', user.id),
    supabase.from('incidents').select('*').eq('account_id', user.id),
    supabase.from('policies').select('policy_id, policy_label, provider_name, trip_id, lifecycle_state, created_at').eq('account_id', user.id),
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
