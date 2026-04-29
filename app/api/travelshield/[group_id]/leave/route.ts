import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOCKOUT_MINUTES = 30;
const MAX_ATTEMPTS = 5;

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

  let body: { lock_code?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const { data: member } = await admin
    .from('travelshield_members')
    .select('*')
    .eq('group_id', groupId)
    .eq('account_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: 'Not a member' }, { status: 404 });
  }

  const lockedUntil = member.lock_code_locked_until ? new Date(member.lock_code_locked_until as string) : null;
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    return NextResponse.json(
      { error: 'Lock code temporarily locked', retry_after: member.lock_code_locked_until },
      { status: 429 },
    );
  }

  const requires =
    Boolean(member.deactivation_requires_code) && typeof member.lock_code_hash === 'string' && member.lock_code_hash.length > 0;

  if (requires) {
    const code = typeof body.lock_code === 'string' ? body.lock_code : '';
    if (!code) {
      return NextResponse.json({ error: 'Lock code required', lock_code_required: true }, { status: 403 });
    }
    const ok = await bcrypt.compare(code, member.lock_code_hash as string);
    if (!ok) {
      const attempts = ((member.lock_code_attempts as number) ?? 0) + 1;
      const updates: Record<string, unknown> = {
        lock_code_attempts: attempts,
        updated_at: new Date().toISOString(),
      };
      if (attempts >= MAX_ATTEMPTS) {
        updates.lock_code_locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      }
      await admin.from('travelshield_members').update(updates).eq('member_id', member.member_id as string);
      return NextResponse.json(
        {
          error: 'Invalid lock code',
          lock_code_attempts_remaining: Math.max(0, MAX_ATTEMPTS - attempts),
          locked_until: attempts >= MAX_ATTEMPTS ? updates.lock_code_locked_until : undefined,
        },
        { status: 403 },
      );
    }
  }

  const now = new Date().toISOString();
  const { error: leaveErr } = await admin
    .from('travelshield_members')
    .update({
      status: 'left',
      left_at: now,
      lock_code_attempts: 0,
      lock_code_locked_until: null,
      updated_at: now,
    })
    .eq('member_id', member.member_id as string);

  if (leaveErr) {
    console.warn('[travelshield/leave]', leaveErr.message);
    return NextResponse.json({ error: 'Could not leave group' }, { status: 500 });
  }

  const { count: remaining } = await admin
    .from('travelshield_members')
    .select('member_id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('status', 'active');

  if ((remaining ?? 0) === 0) {
    await admin
      .from('travelshield_groups')
      .update({
        group_status: 'dissolved',
        dissolved_at: now,
        dissolved_reason: 'last_member_left',
        updated_at: now,
      })
      .eq('group_id', groupId);
  }

  return NextResponse.json({ ok: true, group_dissolved: (remaining ?? 0) === 0 });
}
