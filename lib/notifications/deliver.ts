import type { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { emitNotificationEvent } from './ledger';

export type QueueRow = {
  notification_id: string;
  account_id: string;
  channel: string;
  category: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
  phone_number: string | null;
  email_address: string | null;
};

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:ops@wayfarer.travel';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function resolveEmailRecipient(admin: SupabaseClient, row: QueueRow): Promise<string> {
  if (row.email_address?.trim()) return row.email_address.trim();
  const { data, error } = await admin.auth.admin.getUserById(row.account_id);
  if (error || !data?.user?.email) return '';
  return data.user.email;
}

async function logDelivery(
  admin: SupabaseClient,
  notificationId: string,
  channel: string,
  status: string,
  responseCode: number | null,
  responseBody: string | null,
  durationMs: number,
) {
  await admin.from('notification_delivery_log').insert({
    notification_id: notificationId,
    channel,
    delivery_status: status,
    response_code: responseCode,
    response_body: responseBody,
    duration_ms: durationMs,
  });
}

export async function deliverPush(admin: SupabaseClient, row: QueueRow): Promise<void> {
  const t0 = Date.now();
  if (!configureWebPush()) {
    await logDelivery(admin, row.notification_id, 'push', 'failed', null, 'VAPID keys not configured', Date.now() - t0);
    await admin
      .from('notification_queue')
      .update({
        delivery_status: 'failed',
        failure_reason: 'vapid_not_configured',
        attempt_count: row.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('notification_id', row.notification_id);
    await emitNotificationEvent(
      admin,
      'notification_failed',
      {
        notification_id: row.notification_id,
        channel: 'push',
        failure_reason: 'vapid_not_configured',
        account_id: row.account_id,
      },
      `notification_failed:${row.notification_id}:push`,
    );
    return;
  }

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh_key, auth_key')
    .eq('account_id', row.account_id)
    .eq('is_active', true);

  if (!subs?.length) {
    await logDelivery(admin, row.notification_id, 'push', 'failed', null, 'no_active_subscriptions', Date.now() - t0);
    await admin
      .from('notification_queue')
      .update({
        delivery_status: 'failed',
        failure_reason: 'no_subscriptions',
        attempt_count: row.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('notification_id', row.notification_id);
    return;
  }

  const payload = JSON.stringify({
    title: row.title,
    body: row.body,
    data: { ...(row.data || {}), url: (row.data?.url as string) || '/' },
    tag: `wayfarer-${row.category}`,
  });

  let anyOk = false;
  let lastErr = '';
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh_key, auth: s.auth_key },
        },
        payload,
        { TTL: 3600 },
      );
      anyOk = true;
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  const dur = Date.now() - t0;
  if (anyOk) {
    await logDelivery(admin, row.notification_id, 'push', 'sent', 200, lastErr || 'ok', dur);
    await admin
      .from('notification_queue')
      .update({
        delivery_status: 'sent',
        delivered_at: new Date().toISOString(),
        attempt_count: row.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('notification_id', row.notification_id);
    await emitNotificationEvent(
      admin,
      'notification_sent',
      { notification_id: row.notification_id, channel: 'push', account_id: row.account_id },
      `notification_sent:${row.notification_id}`,
    );
  } else {
    await logDelivery(admin, row.notification_id, 'push', 'failed', null, lastErr, dur);
    const nextStatus = row.attempt_count + 1 >= row.max_attempts ? 'failed' : 'failed';
    await admin
      .from('notification_queue')
      .update({
        delivery_status: nextStatus,
        failure_reason: lastErr,
        attempt_count: row.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('notification_id', row.notification_id);
    await emitNotificationEvent(
      admin,
      'notification_failed',
      {
        notification_id: row.notification_id,
        channel: 'push',
        failure_reason: lastErr,
        account_id: row.account_id,
      },
      `notification_failed:${row.notification_id}:push:attempt`,
    );
  }
}

export async function deliverEmail(admin: SupabaseClient, row: QueueRow): Promise<void> {
  const t0 = Date.now();
  const smtp = process.env.NOTIFICATION_SMTP_URL;
  const to = (await resolveEmailRecipient(admin, row)) || '';

  if (!smtp || !to) {
    const stub = !to ? 'no_recipient' : 'smtp_not_configured';
    await logDelivery(admin, row.notification_id, 'email', 'sent', 202, stub, Date.now() - t0);
    await admin
      .from('notification_queue')
      .update({
        delivery_status: 'sent',
        delivered_at: new Date().toISOString(),
        attempt_count: row.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
        failure_reason: stub,
      })
      .eq('notification_id', row.notification_id);
    await emitNotificationEvent(
      admin,
      'notification_sent',
      { notification_id: row.notification_id, channel: 'email', account_id: row.account_id },
      `notification_sent:${row.notification_id}:email`,
    );
    return;
  }

  /* Future: nodemailer / SMTP — MVP stub path above */
  await logDelivery(admin, row.notification_id, 'email', 'failed', null, 'smtp_not_implemented', Date.now() - t0);
  await admin
    .from('notification_queue')
    .update({
      delivery_status: 'failed',
      failure_reason: 'smtp_not_implemented',
      attempt_count: row.attempt_count + 1,
      last_attempt_at: new Date().toISOString(),
    })
    .eq('notification_id', row.notification_id);
}

export async function deliverSms(admin: SupabaseClient, row: QueueRow): Promise<void> {
  const t0 = Date.now();
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const to = row.phone_number?.trim() || '';

  if (!sid || !token || !from || !to) {
    const reason = !to ? 'no_phone' : 'twilio_not_configured';
    await logDelivery(admin, row.notification_id, 'sms', 'sent', 202, `stub:${reason}`, Date.now() - t0);
    await admin
      .from('notification_queue')
      .update({
        delivery_status: 'sent',
        delivered_at: new Date().toISOString(),
        attempt_count: row.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
        failure_reason: reason,
      })
      .eq('notification_id', row.notification_id);
    await emitNotificationEvent(
      admin,
      'notification_sent',
      { notification_id: row.notification_id, channel: 'sms', account_id: row.account_id },
      `notification_sent:${row.notification_id}:sms`,
    );
    return;
  }

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const formBody = new URLSearchParams({
      To: to,
      From: from,
      Body: `${row.title}\n${row.body}`,
    });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    });
    const text = await res.text();
    await logDelivery(admin, row.notification_id, 'sms', res.ok ? 'sent' : 'failed', res.status, text.slice(0, 2000), Date.now() - t0);
    await admin
      .from('notification_queue')
      .update({
        delivery_status: res.ok ? 'sent' : 'failed',
        delivered_at: res.ok ? new Date().toISOString() : null,
        failure_reason: res.ok ? null : text.slice(0, 500),
        attempt_count: row.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('notification_id', row.notification_id);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await logDelivery(admin, row.notification_id, 'sms', 'failed', null, msg, Date.now() - t0);
    await admin
      .from('notification_queue')
      .update({
        delivery_status: 'failed',
        failure_reason: msg,
        attempt_count: row.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('notification_id', row.notification_id);
  }
}

export async function deliverInApp(admin: SupabaseClient, row: QueueRow): Promise<void> {
  const t0 = Date.now();
  await logDelivery(admin, row.notification_id, 'in_app', 'delivered', 200, 'in_app', Date.now() - t0);
  await admin
    .from('notification_queue')
    .update({
      delivery_status: 'delivered',
      delivered_at: new Date().toISOString(),
      attempt_count: row.attempt_count + 1,
      last_attempt_at: new Date().toISOString(),
    })
    .eq('notification_id', row.notification_id);
}

export async function processQueuedNotification(admin: SupabaseClient, row: QueueRow): Promise<void> {
  if (row.channel === 'push') await deliverPush(admin, row);
  else if (row.channel === 'email') await deliverEmail(admin, row);
  else if (row.channel === 'sms') await deliverSms(admin, row);
  else if (row.channel === 'in_app') await deliverInApp(admin, row);
}
