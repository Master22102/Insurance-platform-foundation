import type { SupabaseClient } from '@supabase/supabase-js';
import { emitNotificationEvent } from './ledger';
import { isChannelAllowedForCategory, mergeNotificationPrefs, type NotificationCategory } from './prefs';
import { checkRateLimit, type Channel } from './rate-limiter';

export type QueueNotificationParams = {
  accountId: string;
  channel: Channel;
  category: NotificationCategory | string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  idempotencyKey?: string;
  phoneNumber?: string;
  emailAddress?: string;
};

export type QueueNotificationResult = { queued: boolean; reason?: string; notification_id?: string };

export async function queueNotification(
  admin: SupabaseClient,
  params: QueueNotificationParams,
): Promise<QueueNotificationResult> {
  const {
    accountId,
    channel,
    category,
    title,
    body,
    data = {},
    idempotencyKey,
    phoneNumber,
    emailAddress,
  } = params;

  if (idempotencyKey) {
    const { data: existing } = await admin
      .from('notification_queue')
      .select('notification_id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing?.notification_id) {
      return { queued: false, reason: 'duplicate_idempotency_key', notification_id: existing.notification_id };
    }
  }

  if (channel === 'in_app') {
    const { data: row, error } = await admin
      .from('notification_queue')
      .insert({
        account_id: accountId,
        channel: 'in_app',
        category,
        title,
        body,
        data,
        delivery_status: 'queued',
        idempotency_key: idempotencyKey ?? null,
      })
      .select('notification_id')
      .maybeSingle();
    if (error) {
      if (String(error.message || '').includes('duplicate') || String(error.code) === '23505') {
        return { queued: false, reason: 'duplicate_idempotency_key' };
      }
      return { queued: false, reason: error.message };
    }
    const nid = row?.notification_id as string | undefined;
    if (nid) {
      await emitNotificationEvent(
        admin,
        'notification_queued',
        { notification_id: nid, channel: 'in_app', category, account_id: accountId },
        `notification_queued:${nid}`,
      );
    }
    return { queued: true, notification_id: nid };
  }

  const { data: profile, error: profErr } = await admin
    .from('user_profiles')
    .select('preferences')
    .eq('user_id', accountId)
    .maybeSingle();
  if (profErr) {
    return { queued: false, reason: 'profile_load_failed' };
  }
  const prefs = mergeNotificationPrefs(
    profile && typeof profile.preferences === 'object'
      ? (profile.preferences as Record<string, unknown>).notifications
      : undefined,
  );

  const smsPhone = phoneNumber?.trim() || (prefs.sms_phone_e164 || '').trim() || null;
  const phoneForRow: string | null = channel === 'sms' ? smsPhone : phoneNumber ?? null;

  if (!isChannelAllowedForCategory(prefs, channel, category)) {
    const { data: ins, error } = await admin
      .from('notification_queue')
      .insert({
        account_id: accountId,
        channel,
        category,
        title,
        body,
        data,
        delivery_status: 'suppressed',
        failure_reason: 'user_opt_out',
        idempotency_key: idempotencyKey ?? null,
        phone_number: phoneForRow,
        email_address: emailAddress ?? null,
      })
      .select('notification_id')
      .maybeSingle();
    if (error) return { queued: false, reason: error.message };
    return { queued: false, reason: 'suppressed_opt_out', notification_id: ins?.notification_id };
  }

  const rl = await checkRateLimit(admin, accountId, channel);
  if (!rl.allowed) {
    const { data: ins, error } = await admin
      .from('notification_queue')
      .insert({
        account_id: accountId,
        channel,
        category,
        title,
        body,
        data,
        delivery_status: 'rate_limited',
        failure_reason: rl.reason ?? 'rate_limited',
        idempotency_key: idempotencyKey ?? null,
        phone_number: phoneForRow,
        email_address: emailAddress ?? null,
      })
      .select('notification_id')
      .maybeSingle();
    if (!error && ins?.notification_id) {
      await emitNotificationEvent(
        admin,
        'notification_rate_limited',
        { account_id: accountId, channel, category, notification_id: ins.notification_id },
        `notification_rate_limited:${ins.notification_id}`,
      );
    }
    return { queued: false, reason: 'rate_limited', notification_id: ins?.notification_id };
  }

  const { data: row, error } = await admin
    .from('notification_queue')
    .insert({
      account_id: accountId,
      channel,
      category,
      title,
      body,
      data,
      delivery_status: 'queued',
      idempotency_key: idempotencyKey ?? null,
      phone_number: phoneForRow,
      email_address: emailAddress ?? null,
    })
    .select('notification_id')
    .maybeSingle();

  if (error) {
    if (String(error.message || '').includes('duplicate') || String(error.code) === '23505') {
      return { queued: false, reason: 'duplicate_idempotency_key' };
    }
    return { queued: false, reason: error.message };
  }

  const nid = row?.notification_id as string | undefined;
  if (nid) {
    await emitNotificationEvent(
      admin,
      'notification_queued',
      {
        notification_id: nid,
        channel,
        category,
        account_id: accountId,
      },
      `notification_queued:${nid}`,
    );
  }

  return { queued: true, notification_id: nid };
}
