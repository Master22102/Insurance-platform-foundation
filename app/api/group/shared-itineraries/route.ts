import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { isActiveGroupMember } from '@/lib/group/organizer-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

type SharePrefs = { share_mode?: string; shared_item_ids?: string[] };

export async function GET(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tripId = request.nextUrl.searchParams.get('trip_id')?.trim() ?? '';
  if (!isUuid(tripId)) return NextResponse.json({ error: 'trip_id required' }, { status: 400 });

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  if (!(await isActiveGroupMember(admin, tripId, user.id))) {
    return NextResponse.json({ error: 'Not a group participant' }, { status: 403 });
  }

  const { data: parts } = await admin
    .from('group_participants')
    .select('account_id, metadata')
    .eq('trip_id', tripId)
    .eq('status', 'active');

  const ids = Array.from(new Set((parts ?? []).map((p) => p.account_id as string))).filter((id) => id !== user.id);
  const { data: profiles } = await admin.from('user_profiles').select('user_id, display_name').in('user_id', ids);
  const names = new Map((profiles ?? []).map((r) => [r.user_id as string, (r.display_name as string)?.trim() || 'Traveler']));

  const { data: allActivities } = await admin
    .from('activity_candidates')
    .select('candidate_id, activity_name, date_hint, city')
    .eq('trip_id', tripId);

  const byId = new Map((allActivities ?? []).map((a) => [a.candidate_id as string, a]));

  const sharers = (parts ?? [])
    .filter((p) => (p.account_id as string) !== user.id)
    .map((p) => {
      const aid = p.account_id as string;
      const meta = (p.metadata && typeof p.metadata === 'object' ? p.metadata : {}) as Record<string, unknown>;
      const prefs = (meta.sharing_preferences || {}) as SharePrefs;
      const mode = prefs.share_mode || 'all';
      let actIds: string[] = [];
      if (mode === 'all') {
        actIds = (allActivities ?? []).map((a) => a.candidate_id as string);
      } else if (mode === 'selected') {
        actIds = (prefs.shared_item_ids || []).filter((id) => byId.has(id));
      } else {
        actIds = [];
      }
      const activities = actIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((a) => ({
          candidate_id: a!.candidate_id,
          activity_name: a!.activity_name,
          date_hint: a!.date_hint,
          city: a!.city,
        }));
      return {
        account_id: aid,
        display_name: names.get(aid) || 'Traveler',
        share_mode: mode,
        activities,
      };
    })
    .filter((s) => s.activities.length > 0);

  return NextResponse.json({ sharers });
}
