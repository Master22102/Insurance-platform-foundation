import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { processQueuedNotification, type QueueRow } from '@/lib/notifications/deliver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toRow(r: Record<string, unknown>): QueueRow {
  return {
    notification_id: String(r.notification_id),
    account_id: String(r.account_id),
    channel: String(r.channel),
    category: String(r.category),
    title: String(r.title),
    body: String(r.body),
    data: (r.data && typeof r.data === 'object' ? r.data : {}) as Record<string, unknown>,
    attempt_count: Number(r.attempt_count) || 0,
    max_attempts: Number(r.max_attempts) || 3,
    phone_number: r.phone_number != null ? String(r.phone_number) : null,
    email_address: r.email_address != null ? String(r.email_address) : null,
  };
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === 'production' && !secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (secret) {
    const h = request.headers.get('x-cron-secret');
    if (h !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const { data: rows, error } = await admin
    .from('notification_queue')
    .select('*')
    .in('delivery_status', ['queued', 'failed'])
    .order('created_at', { ascending: true })
    .limit(40);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  for (const raw of rows || []) {
    const r = raw as Record<string, unknown>;
    if (r.delivery_status === 'failed' && Number(r.attempt_count) >= Number(r.max_attempts)) {
      continue;
    }
    if (['suppressed', 'rate_limited'].includes(String(r.delivery_status))) {
      continue;
    }
    await processQueuedNotification(admin, toRow(r));
    processed += 1;
  }

  return NextResponse.json({ ok: true, processed });
}
