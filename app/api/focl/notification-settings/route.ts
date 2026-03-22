import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function getSupabaseFromRequest(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get: (name) => req.cookies.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseFromRequest(req);
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('membership_tier')
    .eq('user_id', user.id)
    .maybeSingle();

  if ((profile as { membership_tier?: string } | null)?.membership_tier !== 'FOUNDER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('focl_notification_destinations')
    .select('primary_ops_email, backup_emails, weekly_digest_enabled, incident_alerts_enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Could not load notification settings right now.' }, { status: 500 });

  return NextResponse.json({
    settings: data ?? {
      primary_ops_email: user.email ?? '',
      backup_emails: [],
      weekly_digest_enabled: true,
      incident_alerts_enabled: true,
    },
  });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseFromRequest(req);
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('membership_tier')
    .eq('user_id', user.id)
    .maybeSingle();

  if ((profile as { membership_tier?: string } | null)?.membership_tier !== 'FOUNDER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as {
    primary_ops_email?: string;
    backup_emails?: string[];
    weekly_digest_enabled?: boolean;
    incident_alerts_enabled?: boolean;
  } | null;

  const primaryOpsEmail = (body?.primary_ops_email ?? '').trim();
  const backupEmails = Array.isArray(body?.backup_emails)
    ? body!.backup_emails.map((e) => e.trim()).filter(Boolean)
    : [];
  const weeklyDigestEnabled = Boolean(body?.weekly_digest_enabled);
  const incidentAlertsEnabled = Boolean(body?.incident_alerts_enabled);

  if (!primaryOpsEmail || !primaryOpsEmail.includes('@')) {
    return NextResponse.json({ error: 'Primary operations email is required.' }, { status: 400 });
  }

  const dedupedBackups = Array.from(
    new Set(backupEmails.filter((e) => e.includes('@') && e !== primaryOpsEmail)),
  );

  const { error } = await supabase
    .from('focl_notification_destinations')
    .upsert({
      user_id: user.id,
      primary_ops_email: primaryOpsEmail,
      backup_emails: dedupedBackups,
      weekly_digest_enabled: weeklyDigestEnabled,
      incident_alerts_enabled: incidentAlertsEnabled,
    });

  if (error) return NextResponse.json({ error: 'Could not save notification settings right now.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
