import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { getJoinUrl } from '@/lib/travelshield/qr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(request: NextRequest, { params }: { params: { group_id: string } }) {
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

  const { data: group } = await admin
    .from('travelshield_groups')
    .select('group_status, dissolved_at, max_members')
    .eq('group_id', groupId)
    .maybeSingle();

  if (!group || group.dissolved_at || group.group_status === 'dissolved') {
    return NextResponse.json({ error: 'Group not active' }, { status: 410 });
  }

  const nowIso = new Date().toISOString();
  const { data: existing } = await admin
    .from('travelshield_join_tokens')
    .select('token, expires_at, uses_count, max_uses')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.token) {
    return NextResponse.json({
      token: existing.token,
      qr_url: getJoinUrl(existing.token as string),
      expires_at: existing.expires_at,
      uses_count: existing.uses_count,
      max_uses: existing.max_uses,
      reused: true,
    });
  }

  const maxUses = (group.max_members as number) ?? 8;
  const { data: tokRow, error } = await admin
    .from('travelshield_join_tokens')
    .insert({
      group_id: groupId,
      created_by: user.id,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
      max_uses: maxUses,
      uses_count: 0,
    })
    .select('token, expires_at, uses_count, max_uses')
    .single();

  if (error || !tokRow) {
    console.warn('[travelshield/token]', error?.message);
    return NextResponse.json({ error: 'Could not create token' }, { status: 500 });
  }

  return NextResponse.json({
    token: tokRow.token,
    qr_url: getJoinUrl(tokRow.token as string),
    expires_at: tokRow.expires_at,
    uses_count: tokRow.uses_count,
    max_uses: tokRow.max_uses,
    reused: false,
  });
}
