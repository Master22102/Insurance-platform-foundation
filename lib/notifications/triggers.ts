import type { SupabaseClient } from '@supabase/supabase-js';
import { queueNotification } from './send';

async function q(
  admin: SupabaseClient,
  accountId: string,
  channel: 'push' | 'email' | 'sms',
  category: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  extra?: { idempotencyKey?: string; phoneNumber?: string; emailAddress?: string },
) {
  await queueNotification(admin, {
    accountId,
    channel,
    category,
    title,
    body,
    data,
    idempotencyKey: extra?.idempotencyKey,
    phoneNumber: extra?.phoneNumber,
    emailAddress: extra?.emailAddress,
  });
}

export async function notifyTravelShieldCheckin(
  admin: SupabaseClient,
  accountId: string,
  partnerName: string,
  groupId: string,
): Promise<void> {
  await q(admin, accountId, 'push', 'travelshield_checkin', 'TravelShield check-in', `${partnerName} requested a check-in.`, {
    group_id: groupId,
    url: '/account/travelshield',
  });
}

export async function notifyTravelShieldCheckinReminder(
  admin: SupabaseClient,
  accountId: string,
  partnerName: string,
  groupId: string,
  checkinId: string,
): Promise<void> {
  await q(
    admin,
    accountId,
    'push',
    'travelshield_checkin',
    'Still waiting on your check-in',
    `${partnerName} is still waiting — please confirm you’re OK.`,
    { group_id: groupId, url: '/account/travelshield', checkin_id: checkinId },
    { idempotencyKey: `ts:chk:remind:${checkinId}` },
  );
}

export async function notifyTravelShieldEscalationToGroup(
  admin: SupabaseClient,
  params: {
    groupId: string;
    targetAccountId: string;
    targetName: string;
    requesterName: string;
    checkinId: string;
  },
): Promise<void> {
  const { groupId, targetAccountId, targetName, requesterName, checkinId } = params;
  const { data: members } = await admin
    .from('travelshield_members')
    .select('account_id')
    .eq('group_id', groupId)
    .eq('status', 'active');
  const ids = (members ?? []).map((m) => String((m as { account_id: string }).account_id));
  const title = 'TravelShield check-in overdue';
  const body = `${targetName} hasn’t responded to a safety check-in from ${requesterName}.`;
  for (const uid of ids) {
    await queueNotification(admin, {
      accountId: uid,
      channel: 'in_app',
      category: 'travelshield_checkin',
      title,
      body,
      data: { group_id: groupId, checkin_id: checkinId, requested_of: targetAccountId },
      idempotencyKey: `ts:esc:grp:inapp:${checkinId}:${uid}`,
    });
    await queueNotification(admin, {
      accountId: uid,
      channel: 'push',
      category: 'travelshield_checkin',
      title,
      body,
      data: { group_id: groupId, url: '/account/travelshield', checkin_id: checkinId },
      idempotencyKey: `ts:esc:grp:push:${checkinId}:${uid}`,
    });
  }
}

export async function notifyTravelShieldEscalationSmsToContact(
  admin: SupabaseClient,
  params: {
    travelerAccountId: string;
    phoneE164: string;
    targetName: string;
    requesterName: string;
    groupId: string;
    checkinId: string;
    lat?: number;
    lng?: number;
  },
): Promise<void> {
  const { travelerAccountId, phoneE164, targetName, requesterName, groupId, checkinId, lat, lng } = params;
  const loc =
    lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng)
      ? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      : 'unavailable';
  const body = `${targetName} hasn't responded to a safety check-in from their travel partner ${requesterName}. Last known location: ${loc}. This is an automated message from Wayfarer TravelShield.`;
  await queueNotification(admin, {
    accountId: travelerAccountId,
    channel: 'sms',
    category: 'travelshield_emergency',
    title: 'TravelShield escalation',
    body,
    data: { group_id: groupId, checkin_id: checkinId },
    phoneNumber: phoneE164,
    idempotencyKey: `ts:esc:sms:${checkinId}`,
  });
}

export async function notifyTravelShieldEmergency(
  admin: SupabaseClient,
  accountId: string,
  partnerName: string,
  location: { lat: number; lng: number },
  groupId: string,
): Promise<void> {
  await q(
    admin,
    accountId,
    'sms',
    'travelshield_emergency',
    'TravelShield emergency',
    `${partnerName} may need help. Open Wayfarer for details.`,
    { group_id: groupId, lat: location.lat, lng: location.lng, url: '/account/travelshield' },
    { idempotencyKey: `ts-emergency:${groupId}:${Date.now()}` },
  );
}

export async function notifyBorderCrossing(
  admin: SupabaseClient,
  accountId: string,
  countryName: string,
  tripId: string,
): Promise<void> {
  await q(admin, accountId, 'push', 'presence_border', 'Border crossing', `You entered ${countryName}. Open Wayfarer for coverage tips.`, {
    trip_id: tripId,
    url: `/trips/${tripId}?tab=Overview`,
  });
}

export async function notifyMissedConnectionRisk(
  admin: SupabaseClient,
  accountId: string,
  flightInfo: string,
  tripId: string,
): Promise<void> {
  await q(admin, accountId, 'push', 'presence_alert', 'Tight connection', `${flightInfo} — you may be short on time.`, {
    trip_id: tripId,
    url: `/trips/${tripId}?tab=Route`,
  });
}

export async function notifyFilingDeadline(
  admin: SupabaseClient,
  accountId: string,
  policyLabel: string,
  daysRemaining: number,
  claimId: string,
): Promise<void> {
  await q(
    admin,
    accountId,
    'email',
    'filing_deadline',
    'Filing deadline approaching',
    `${policyLabel}: about ${daysRemaining} day(s) remaining to file.`,
    { claim_id: claimId, url: `/claims` },
    { idempotencyKey: `filing-deadline:${claimId}:${daysRemaining}` },
  );
}

export async function notifyCoverageGap(
  admin: SupabaseClient,
  accountId: string,
  gapDescription: string,
  tripId: string,
): Promise<void> {
  await q(admin, accountId, 'push', 'coverage_gap', 'Coverage gap flagged', gapDescription, {
    trip_id: tripId,
    url: `/trips/${tripId}?tab=Coverage`,
  });
}

export async function notifyDisruptionDetected(
  admin: SupabaseClient,
  accountId: string,
  flightInfo: string,
  delayMinutes: number,
  tripId: string,
): Promise<void> {
  await q(
    admin,
    accountId,
    'push',
    'disruption_detected',
    'Disruption detected',
    `${flightInfo}: about ${delayMinutes} min delay reported.`,
    { trip_id: tripId, url: `/trips/${tripId}?tab=Overview` },
  );
}
