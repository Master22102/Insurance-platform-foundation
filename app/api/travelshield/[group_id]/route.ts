import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { getJoinUrl } from '@/lib/travelshield/qr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(request: NextRequest, { params }: { params: { group_id: string } }) {
  const groupId = params.group_id;
  if (!isUuid(groupId)) {
    return NextResponse.json({ error: 'Invalid group' }, { status: 400 });
  }

  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const { data: membership } = await admin
    .from('travelshield_members')
    .select('member_id')
    .eq('group_id', groupId)
    .eq('account_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: group, error: gErr } = await admin.from('travelshield_groups').select('*').eq('group_id', groupId).maybeSingle();
  if (gErr || !group) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: rawMembers } = await admin
    .from('travelshield_members')
    .select(
      'member_id, account_id, display_name, joined_at, status, trust_level, check_in_interval_hours, deactivation_requires_code, emergency_contact_id, duration_type, duration_hours, lock_code_hash',
    )
    .eq('group_id', groupId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });

  const members = (rawMembers ?? []).map((m) => {
    const self = m.account_id === user.id;
    const base = {
      member_id: m.member_id,
      account_id: m.account_id,
      display_name: m.display_name,
      joined_at: m.joined_at,
      status: m.status,
      is_self: self,
    };
    if (self) {
      return {
        ...base,
        trust_level: m.trust_level,
        check_in_interval_hours: m.check_in_interval_hours,
        deactivation_requires_code: m.deactivation_requires_code,
        emergency_contact_id: m.emergency_contact_id,
        duration_type: m.duration_type,
        duration_hours: m.duration_hours,
        has_lock_code: Boolean(m.lock_code_hash),
      };
    }
    return base;
  });

  const now = new Date().toISOString();
  const { data: tokens } = await admin
    .from('travelshield_join_tokens')
    .select('token, expires_at, uses_count, max_uses, is_active')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1);

  const t = tokens?.[0];
  const active_token = t
    ? {
        token: t.token,
        qr_url: getJoinUrl(t.token as string),
        expires_at: t.expires_at,
        uses_count: t.uses_count,
        max_uses: t.max_uses,
      }
    : null;

  return NextResponse.json({
    group,
    members,
    active_token,
  });
}
