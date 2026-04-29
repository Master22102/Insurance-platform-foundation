import type { SupabaseClient } from '@supabase/supabase-js';
import { queueNotification } from '@/lib/notifications/send';
import {
  notifyTravelShieldCheckin,
  notifyTravelShieldCheckinReminder,
  notifyTravelShieldEscalationToGroup,
  notifyTravelShieldEscalationSmsToContact,
} from '@/lib/notifications/triggers';
import { emitTravelShieldEvent } from '@/lib/travelshield/emit-travelshield-event';

export type CheckinRow = {
  checkin_id: string;
  group_id: string;
  requested_by: string;
  requested_of: string;
  status: string;
  created_at: string;
  responded_at: string | null;
  reminder_sent_at: string | null;
  second_reminder_sent_at: string | null;
  escalation_level: number;
  emergency_contact_notified_at: string | null;
  emergency_contact_id: string | null;
  cancelled_at: string | null;
  metadata: Record<string, unknown>;
};

async function memberDisplayName(admin: SupabaseClient, groupId: string, accountId: string): Promise<string> {
  const { data } = await admin
    .from('travelshield_members')
    .select('display_name')
    .eq('group_id', groupId)
    .eq('account_id', accountId)
    .eq('status', 'active')
    .maybeSingle();
  return ((data?.display_name as string) || 'Partner').trim() || 'Partner';
}

async function activeMemberIds(admin: SupabaseClient, groupId: string): Promise<string[]> {
  const { data } = await admin
    .from('travelshield_members')
    .select('account_id')
    .eq('group_id', groupId)
    .eq('status', 'active');
  return (data ?? []).map((r) => String((r as { account_id: string }).account_id));
}

async function latestPingLatLng(
  admin: SupabaseClient,
  groupId: string,
  accountId: string,
): Promise<{ lat: number; lng: number } | null> {
  const { data } = await admin
    .from('travelshield_location_pings')
    .select('latitude, longitude')
    .eq('group_id', groupId)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const lat = Number((data as { latitude?: number }).latitude);
  const lng = Number((data as { longitude?: number }).longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export async function requestCheckin(
  admin: SupabaseClient,
  params: { groupId: string; targetAccountId: string; requesterId: string },
): Promise<{ checkinId: string } | { error: string }> {
  const { groupId, targetAccountId, requesterId } = params;
  if (targetAccountId === requesterId) {
    return { error: 'Cannot request check-in from yourself' };
  }

  const members = await activeMemberIds(admin, groupId);
  if (!members.includes(requesterId) || !members.includes(targetAccountId)) {
    return { error: 'Invalid group members' };
  }

  const requesterName = await memberDisplayName(admin, groupId, requesterId);

  const { data: targetMember } = await admin
    .from('travelshield_members')
    .select('emergency_contact_id')
    .eq('group_id', groupId)
    .eq('account_id', targetAccountId)
    .eq('status', 'active')
    .maybeSingle();

  const emergencyContactId = (targetMember?.emergency_contact_id as string | null) ?? null;

  const { data: row, error } = await admin
    .from('travelshield_checkins')
    .insert({
      group_id: groupId,
      requested_by: requesterId,
      requested_of: targetAccountId,
      checkin_type: 'manual',
      status: 'pending',
      escalation_level: 0,
      emergency_contact_id: emergencyContactId,
      metadata: {},
    })
    .select('checkin_id')
    .single();

  if (error || !row) {
    return { error: error?.message || 'Could not create check-in' };
  }

  const checkinId = (row as { checkin_id: string }).checkin_id;

  await emitTravelShieldEvent(admin, {
    eventType: 'travelshield_checkin_requested',
    featureId: 'F-6.6.13-checkin',
    metadata: { group_id: groupId, requested_of: targetAccountId, checkin_id: checkinId },
    scopeType: 'trip',
    scopeId: null,
    actorId: requesterId,
    idempotencyKey: `ts:req:${checkinId}`,
  });

  await notifyTravelShieldCheckin(admin, targetAccountId, requesterName, groupId);

  return { checkinId };
}

export async function respondCheckin(
  admin: SupabaseClient,
  params: { checkinId: string; response: 'safe' | 'needs_help'; accountId: string },
): Promise<{ ok: true } | { error: string }> {
  const { checkinId, response, accountId } = params;

  const { data: c, error: fetchErr } = await admin
    .from('travelshield_checkins')
    .select('*')
    .eq('checkin_id', checkinId)
    .maybeSingle();

  if (fetchErr || !c) {
    return { error: 'Check-in not found' };
  }

  const row = c as CheckinRow;
  if (row.requested_of !== accountId) {
    return { error: 'Forbidden' };
  }
  if (row.status !== 'pending') {
    return { error: 'Already responded' };
  }
  if (row.cancelled_at) {
    return { error: 'Cancelled' };
  }

  const now = new Date().toISOString();
  const status = response === 'safe' ? 'safe' : 'needs_help';

  const { error: upErr } = await admin
    .from('travelshield_checkins')
    .update({
      status,
      responded_at: now,
    })
    .eq('checkin_id', checkinId);

  if (upErr) {
    return { error: upErr.message };
  }

  await emitTravelShieldEvent(admin, {
    eventType: response === 'safe' ? 'travelshield_checkin_safe' : 'travelshield_checkin_help',
    featureId: 'F-6.6.13-checkin',
    metadata: { group_id: row.group_id, account_id: accountId, checkin_id: checkinId },
    actorId: accountId,
    idempotencyKey: `ts:resp:${checkinId}:${response}`,
  });

  if (response === 'needs_help') {
    const targetName = await memberDisplayName(admin, row.group_id, accountId);
    const ids = await activeMemberIds(admin, row.group_id);
    const loc = await latestPingLatLng(admin, row.group_id, accountId);
    for (const uid of ids) {
      await queueNotification(admin, {
        accountId: uid,
        channel: 'push',
        category: 'travelshield_checkin',
        title: 'TravelShield: help requested',
        body: `${targetName} tapped “I need help” in your TravelShield group.`,
        data: { group_id: row.group_id, checkin_id: checkinId, lat: loc?.lat, lng: loc?.lng },
        idempotencyKey: `ts:help:push:${checkinId}:${uid}`,
      });
      await queueNotification(admin, {
        accountId: uid,
        channel: 'in_app',
        category: 'travelshield_checkin',
        title: 'TravelShield: help requested',
        body: `${targetName} may need assistance. Open TravelShield for details.`,
        data: { group_id: row.group_id, checkin_id: checkinId },
        idempotencyKey: `ts:help:inapp:${checkinId}:${uid}`,
      });
    }

    const { data: mem } = await admin
      .from('travelshield_members')
      .select('emergency_contact_id')
      .eq('group_id', row.group_id)
      .eq('account_id', accountId)
      .maybeSingle();
    const ecId = (mem?.emergency_contact_id as string | null) || row.emergency_contact_id;
    if (ecId) {
      const { data: contact } = await admin.from('contacts').select('phone, name').eq('contact_id', ecId).maybeSingle();
      const phone = (contact?.phone as string | null)?.trim();
      if (phone) {
        await queueNotification(admin, {
          accountId,
          channel: 'sms',
          category: 'travelshield_emergency',
          title: 'TravelShield',
          body: `${targetName} requested help via Wayfarer TravelShield. Last known: ${loc ? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : 'unknown'}.`,
          data: { group_id: row.group_id, checkin_id: checkinId },
          phoneNumber: phone,
          idempotencyKey: `ts:help:sms:${checkinId}`,
        });
      }
    }
  }

  return { ok: true };
}

export async function cancelCheckin(
  admin: SupabaseClient,
  params: { checkinId: string; requesterId: string },
): Promise<{ ok: true } | { error: string }> {
  const { data: c, error } = await admin.from('travelshield_checkins').select('*').eq('checkin_id', params.checkinId).maybeSingle();
  if (error || !c) return { error: 'Not found' };
  const row = c as CheckinRow;
  if (row.requested_by !== params.requesterId) return { error: 'Forbidden' };
  if (row.status !== 'pending') return { error: 'Not pending' };
  if (row.emergency_contact_notified_at) return { error: 'Too late to cancel' };

  const now = new Date().toISOString();
  await admin
    .from('travelshield_checkins')
    .update({ cancelled_at: now, metadata: { ...row.metadata, cancelled: true } })
    .eq('checkin_id', params.checkinId);
  return { ok: true };
}

/**
 * Time-gated escalation: 15m reminder push → 30m group in-app+push → 45m SMS to emergency contact.
 * Does not skip steps; may advance multiple steps in one run if overdue.
 */
export async function processEscalations(admin: SupabaseClient): Promise<{ escalated: number; notified: number }> {
  const { data: rows, error } = await admin
    .from('travelshield_checkins')
    .select('*')
    .eq('status', 'pending')
    .is('cancelled_at', null);

  if (error || !rows?.length) {
    return { escalated: 0, notified: 0 };
  }

  let escalated = 0;
  let notified = 0;
  const now = Date.now();

  for (const raw of rows as CheckinRow[]) {
    const created = new Date(raw.created_at).getTime();
    const ageMin = (now - created) / 60_000;

    const requesterName = await memberDisplayName(admin, raw.group_id, raw.requested_by);
    const targetName = await memberDisplayName(admin, raw.group_id, raw.requested_of);

    let progressed = true;
    while (progressed) {
      progressed = false;

      const { data: fresh } = await admin.from('travelshield_checkins').select('*').eq('checkin_id', raw.checkin_id).maybeSingle();
      if (!fresh) break;
      const c = fresh as CheckinRow;
      if (c.status !== 'pending' || c.cancelled_at) break;

      const age = (Date.now() - new Date(c.created_at).getTime()) / 60_000;

      if (age >= 15 && !c.reminder_sent_at) {
        const ts = new Date().toISOString();
        await admin.from('travelshield_checkins').update({ reminder_sent_at: ts }).eq('checkin_id', c.checkin_id);
        await notifyTravelShieldCheckinReminder(admin, c.requested_of, requesterName, c.group_id, c.checkin_id);
        notified += 1;
        escalated += 1;
        progressed = true;
        continue;
      }

      if (age >= 30 && c.reminder_sent_at && !c.second_reminder_sent_at) {
        const ts = new Date().toISOString();
        await admin
          .from('travelshield_checkins')
          .update({ second_reminder_sent_at: ts, escalation_level: 1 })
          .eq('checkin_id', c.checkin_id);
        await notifyTravelShieldEscalationToGroup(admin, {
          groupId: c.group_id,
          targetAccountId: c.requested_of,
          targetName,
          requesterName,
          checkinId: c.checkin_id,
        });
        await emitTravelShieldEvent(admin, {
          eventType: 'travelshield_checkin_escalated',
          featureId: 'F-6.6.13-checkin',
          metadata: {
            group_id: c.group_id,
            account_id: c.requested_of,
            escalation_level: 1,
            checkin_id: c.checkin_id,
          },
          actorId: c.requested_by,
          idempotencyKey: `ts:esc30:${c.checkin_id}`,
        });
        notified += 1;
        escalated += 1;
        progressed = true;
        continue;
      }

      if (age >= 45 && c.second_reminder_sent_at && !c.emergency_contact_notified_at) {
        const ts = new Date().toISOString();
        const loc = await latestPingLatLng(admin, c.group_id, c.requested_of);
        const { data: mem } = await admin
          .from('travelshield_members')
          .select('emergency_contact_id')
          .eq('group_id', c.group_id)
          .eq('account_id', c.requested_of)
          .maybeSingle();
        const ecId = (mem?.emergency_contact_id as string | null) || c.emergency_contact_id;

        await admin
          .from('travelshield_checkins')
          .update({ emergency_contact_notified_at: ts, escalation_level: 2 })
          .eq('checkin_id', c.checkin_id);

        if (ecId) {
          const { data: contact } = await admin.from('contacts').select('phone, name').eq('contact_id', ecId).maybeSingle();
          const phone = (contact?.phone as string | null)?.trim();
          if (phone) {
            await notifyTravelShieldEscalationSmsToContact(admin, {
              travelerAccountId: c.requested_of,
              phoneE164: phone,
              targetName,
              requesterName,
              groupId: c.group_id,
              checkinId: c.checkin_id,
              lat: loc?.lat,
              lng: loc?.lng,
            });
            notified += 1;
          }
        }

        await emitTravelShieldEvent(admin, {
          eventType: 'travelshield_emergency_contact_notified',
          featureId: 'F-6.6.13-checkin',
          metadata: {
            group_id: c.group_id,
            account_id: c.requested_of,
            contact_id: ecId,
            checkin_id: c.checkin_id,
          },
          actorId: c.requested_by,
          idempotencyKey: `ts:esc45:${c.checkin_id}`,
        });

        escalated += 1;
        progressed = true;
      }
    }
  }

  return { escalated, notified };
}
