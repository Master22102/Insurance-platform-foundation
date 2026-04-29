import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getRouteUser } from '@/lib/travelshield/supabase-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRUST = new Set(['close_friend', 'just_met', 'custom']);
const DURATION = new Set(['time_bounded', 'until_itinerary_ends', 'indefinite']);

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function PUT(request: NextRequest, { params }: { params: { group_id: string } }) {
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

  const { data: member } = await admin
    .from('travelshield_members')
    .select('*')
    .eq('group_id', groupId)
    .eq('account_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.trust_level === 'string' && TRUST.has(body.trust_level)) {
    patch.trust_level = body.trust_level;
  }

  if (typeof body.check_in_interval_hours === 'number' && Number.isFinite(body.check_in_interval_hours)) {
    const h = Math.round(body.check_in_interval_hours);
    if (h > 0 && h <= 168) patch.check_in_interval_hours = h;
  }

  if (typeof body.deactivation_requires_code === 'boolean') {
    patch.deactivation_requires_code = body.deactivation_requires_code;
  }

  if (typeof body.duration_type === 'string' && DURATION.has(body.duration_type)) {
    patch.duration_type = body.duration_type;
  }

  if (body.duration_hours === null) {
    patch.duration_hours = null;
  } else if (typeof body.duration_hours === 'number' && Number.isFinite(body.duration_hours)) {
    patch.duration_hours = Math.max(1, Math.round(body.duration_hours));
  }

  if (body.emergency_contact_id === null) {
    patch.emergency_contact_id = null;
  } else if (typeof body.emergency_contact_id === 'string' && isUuid(body.emergency_contact_id)) {
    const { data: contact } = await admin
      .from('contacts')
      .select('contact_id')
      .eq('contact_id', body.emergency_contact_id)
      .eq('account_id', user.id)
      .eq('contact_type', 'emergency')
      .maybeSingle();
    if (contact) {
      patch.emergency_contact_id = body.emergency_contact_id;
    }
  }

  if ('lock_code' in body) {
    const lc = body.lock_code;
    if (lc === null || lc === '') {
      patch.lock_code_hash = null;
      patch.lock_code_attempts = 0;
      patch.lock_code_locked_until = null;
    } else if (typeof lc === 'string' && lc.length >= 4 && lc.length <= 32) {
      patch.lock_code_hash = await bcrypt.hash(lc, 10);
      patch.lock_code_attempts = 0;
      patch.lock_code_locked_until = null;
    }
  }

  if (body.activate === true) {
    await admin.from('travelshield_groups').update({ group_status: 'active', updated_at: new Date().toISOString() }).eq('group_id', groupId);
  }

  const { data: updated, error } = await admin
    .from('travelshield_members')
    .update(patch)
    .eq('member_id', member.member_id as string)
    .select(
      'member_id, trust_level, check_in_interval_hours, deactivation_requires_code, emergency_contact_id, duration_type, duration_hours, lock_code_hash',
    )
    .single();

  if (error) {
    console.warn('[travelshield/settings]', error.message);
    return NextResponse.json({ error: 'Could not update settings' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    settings: {
      ...updated,
      has_lock_code: Boolean(updated?.lock_code_hash),
      lock_code_hash: undefined,
    },
  });
}
