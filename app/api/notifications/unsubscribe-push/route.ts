import { NextRequest, NextResponse } from 'next/server';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { emitNotificationEvent } from '@/lib/notifications/ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { endpoint?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const endpoint = String(body.endpoint || '').trim();
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const { error } = await admin
    .from('push_subscriptions')
    .update({ is_active: false })
    .eq('account_id', user.id)
    .eq('endpoint', endpoint);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await emitNotificationEvent(
    admin,
    'push_subscription_expired',
    { account_id: user.id, endpoint },
    `push_subscription_expired:${user.id}:${endpoint.slice(0, 80)}`,
  );

  return NextResponse.json({ ok: true });
}
