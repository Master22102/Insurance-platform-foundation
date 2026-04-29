import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const token = request.nextUrl.searchParams.get('token')?.trim() ?? '';
  if (!token) {
    return NextResponse.json({ valid: false, reason: 'missing_token' });
  }

  const { data: row, error } = await admin
    .from('travelshield_join_tokens')
    .select('token_id, group_id, expires_at, is_active, uses_count, max_uses, created_by')
    .eq('token', token)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ valid: false, reason: 'not_found' });
  }

  const expiresAt = new Date(row.expires_at as string);
  const expired = expiresAt.getTime() <= Date.now();
  if (!row.is_active || expired) {
    return NextResponse.json({
      valid: false,
      reason: expired ? 'expired' : 'inactive',
      expires_at: row.expires_at,
    });
  }

  const { data: group } = await admin
    .from('travelshield_groups')
    .select('group_id, group_status, max_members, dissolved_at')
    .eq('group_id', row.group_id)
    .maybeSingle();

  if (!group || group.dissolved_at || group.group_status === 'dissolved') {
    return NextResponse.json({ valid: false, reason: 'group_inactive' });
  }

  const { count: activeCount } = await admin
    .from('travelshield_members')
    .select('member_id', { count: 'exact', head: true })
    .eq('group_id', row.group_id)
    .eq('status', 'active');

  const memberCount = activeCount ?? 0;
  const maxMembers = (group.max_members as number) ?? 8;

  if (memberCount >= maxMembers) {
    return NextResponse.json({
      valid: false,
      reason: 'group_full',
      member_count: memberCount,
      max_members: maxMembers,
      expires_at: row.expires_at,
    });
  }

  if ((row.uses_count as number) >= (row.max_uses as number)) {
    return NextResponse.json({ valid: false, reason: 'token_max_uses', expires_at: row.expires_at });
  }

  const creatorId = row.created_by as string;
  let creatorName = 'Someone';
  const { data: creatorProf } = await admin
    .from('user_profiles')
    .select('display_name')
    .eq('user_id', creatorId)
    .maybeSingle();
  if (creatorProf?.display_name && String(creatorProf.display_name).trim()) {
    creatorName = String(creatorProf.display_name).trim();
  }

  return NextResponse.json({
    valid: true,
    group_id: row.group_id,
    creator_name: creatorName,
    referrer_account_id: creatorId,
    member_count: memberCount,
    max_members: maxMembers,
    expires_at: row.expires_at,
    uses_count: row.uses_count,
    max_uses: row.max_uses,
  });
}
