import { NextRequest, NextResponse } from 'next/server';
import { getRouteUser } from '@/lib/travelshield/supabase-route';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { queueNotification } from '@/lib/notifications/send';
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from '@/lib/notifications/prefs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHANNELS = new Set(['push', 'email', 'sms', 'in_app']);
const CATS: Set<string> = new Set(NOTIFICATION_CATEGORIES as readonly string[]);

export async function POST(request: NextRequest) {
  const { user } = await getRouteUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const internalKey = process.env.NOTIFICATION_INTERNAL_KEY;
  const headerKey = request.headers.get('x-notification-internal-key');
  const allowAnyAccount = Boolean(internalKey && headerKey === internalKey);

  let body: {
    account_id?: string;
    channel?: string;
    category?: string;
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
    idempotency_key?: string;
    phone_number?: string;
    email_address?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const accountId = String(body.account_id || '').trim();
  if (!accountId) {
    return NextResponse.json({ error: 'account_id required' }, { status: 400 });
  }
  if (!allowAnyAccount && accountId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const channel = String(body.channel || '');
  const categoryRaw = String(body.category || '');
  if (!CHANNELS.has(channel)) {
    return NextResponse.json({ error: 'invalid channel' }, { status: 400 });
  }
  if (!CATS.has(categoryRaw)) {
    return NextResponse.json({ error: 'invalid category' }, { status: 400 });
  }
  const category = categoryRaw as NotificationCategory;
  const title = String(body.title || '').trim();
  const text = String(body.body || '').trim();
  if (!title || !text) {
    return NextResponse.json({ error: 'title and body required' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const result = await queueNotification(admin, {
    accountId,
    channel: channel as 'push' | 'email' | 'sms' | 'in_app',
    category,
    title,
    body: text,
    data: body.data || {},
    idempotencyKey: body.idempotency_key,
    phoneNumber: body.phone_number,
    emailAddress: body.email_address,
  });

  return NextResponse.json(result);
}
