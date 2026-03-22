import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { computeCoverageGraphWithIntelligence } from '@/lib/pipeline/coverage-and-routing';
import { userRateLimitedJsonResponse } from '@/lib/rate-limit/simple-memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/coverage-graph/compute
 * Body: { trip_id: string }
 */
export async function POST(request: NextRequest) {
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
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = userRateLimitedJsonResponse(user.id, 'coverage-graph-compute', 10, 15 * 60 * 1000);
  if (limited) return limited;

  let body: { trip_id?: string };
  try {
    body = (await request.json()) as { trip_id?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const tripId = typeof body.trip_id === 'string' ? body.trip_id.trim() : '';
  if (!tripId || !/^[0-9a-f-]{36}$/i.test(tripId)) {
    return NextResponse.json({ error: 'trip_id must be a UUID' }, { status: 400 });
  }

  const result = await computeCoverageGraphWithIntelligence(supabase, tripId, user.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    ...result.data,
  });
}
