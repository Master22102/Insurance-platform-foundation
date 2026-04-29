import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

test.describe('Breach protocol (Section 8.8)', () => {
  test('create_breach_incident creates row and timeline (service role)', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY, 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for breach RPC test.');

    const admin = createClient(url, key);
    const title = `E2E breach ${Date.now()}`;
    const { data, error } = await admin.rpc('create_breach_incident', {
      p_severity: 'p3_medium',
      p_breach_type: 'misconfiguration',
      p_title: title,
      p_description: 'Playwright automated test',
      p_detected_method: 'automated_monitor',
      p_affected_systems: ['api'],
      p_affected_data_types: ['pii'],
      p_actor_id: null,
    });

    expect(error, String(error)).toBeNull();
    expect(data?.ok).toBeTruthy();
    const breachId = data?.breach_id as string;
    expect(breachId).toBeTruthy();

    const { data: row } = await admin.from('breach_incidents').select('incident_id, title').eq('incident_id', breachId).maybeSingle();
    expect(row?.title).toBe(title);

    const { data: tl, error: tlErr } = await admin.from('breach_timeline').select('entry_id').eq('breach_id', breachId);
    expect(tlErr).toBeNull();
    expect((tl || []).length).toBeGreaterThanOrEqual(1);
  });

  test('acknowledge_breach_incident rejects non-founder actor', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY, 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');

    const admin = createClient(url, key);
    const { data: created } = await admin.rpc('create_breach_incident', {
      p_severity: 'p4_low',
      p_breach_type: 'unknown',
      p_title: `E2E ack gate ${Date.now()}`,
      p_description: null,
      p_detected_method: 'automated_monitor',
      p_affected_systems: [],
      p_affected_data_types: [],
      p_actor_id: null,
    });
    const breachId = created?.breach_id as string;
    expect(breachId).toBeTruthy();

    const fakeUser = '00000000-0000-0000-0000-000000000001';
    const { data: ack } = await admin.rpc('acknowledge_breach_incident', {
      p_breach_id: breachId,
      p_actor_id: fakeUser,
    });
    expect(ack?.ok).toBe(false);
    expect(String(ack?.error || '')).toMatch(/founder/i);
  });
});
