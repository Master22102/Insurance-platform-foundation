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

  let body: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    userAgent?: string;
    deviceLabel?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const endpoint = String(body.endpoint || '').trim();
  const p256dh = String(body.keys?.p256dh || '').trim();
  const auth = String(body.keys?.auth || '').trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'endpoint and keys.p256dh, keys.auth required' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const { data, error } = await admin
    .from('push_subscriptions')
    .upsert(
      {
        account_id: user.id,
        endpoint,
        p256dh_key: p256dh,
        auth_key: auth,
        user_agent: body.userAgent || null,
        device_label: body.deviceLabel || null,
        is_active: true,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,endpoint' },
    )
    .select('subscription_id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await emitNotificationEvent(
    admin,
    'push_subscription_created',
    { account_id: user.id, endpoint },
    `push_subscription_created:${user.id}:${endpoint.slice(0, 80)}`,
  );

  return NextResponse.json({ ok: true, subscription_id: data?.subscription_id });
}
