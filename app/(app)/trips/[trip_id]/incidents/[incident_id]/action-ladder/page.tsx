'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

interface LadderStep {
  key: string;
  title: string;
  body: string;
  href?: string;
  cta: string;
  urgency: 'now' | 'soon' | 'later';
  disabled?: boolean;
}

const URGENCY_STYLES: Record<string, { bg: string; border: string; fg: string; label: string }> = {
  now:   { bg: '#fef2f2', border: '#fecaca', fg: '#991b1b', label: 'Now' },
  soon:  { bg: '#fef9f0', border: '#fde68a', fg: '#92400e', label: 'Soon' },
  later: { bg: '#f0f4ff', border: '#dbeafe', fg: '#1e40af', label: 'Later' },
};

export default function ActionLadderPage() {
  const { trip_id, incident_id } = useParams<{ trip_id: string; incident_id: string }>();
  const { user } = useAuth();
  const [incident, setIncident] = useState<any>(null);
  const [timers, setTimers] = useState<any[]>([]);
  const [packet, setPacket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !incident_id) return;
    (async () => {
      const [{ data: inc }, { data: tm }, { data: pk }] = await Promise.all([
        supabase.from('incidents').select('*').eq('id', incident_id).maybeSingle(),
        supabase.from('clause_timers').select('*').eq('account_id', user.id).is('elapsed_at', null).order('due_at', { ascending: true }).limit(5),
        supabase.from('claim_packets').select('packet_status, updated_at').eq('incident_id', incident_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setIncident(inc);
      setTimers(tm || []);
      setPacket(pk);
      setLoading(false);
    })();
  }, [user, incident_id]);

  if (loading) return <div style={{ padding: 24, color: '#888', fontSize: 14 }}>Loading...</div>;
  if (!incident) return <div style={{ padding: 24, color: '#888', fontSize: 14 }}>Incident not found.</div>;

  const hasSelection = !!incident.selected_option_id;
  const hasPacket = !!packet;
  const status = incident.canonical_status || 'OPEN';

  const ladder: LadderStep[] = [];

  if (timers.length > 0) {
    const soonest = timers[0];
    const dueMs = new Date(soonest.due_at).getTime() - Date.now();
    const urg: LadderStep['urgency'] = dueMs < 1000 * 60 * 60 * 24 ? 'now' : 'soon';
    ladder.push({
      key: 'timers',
      title: `Clause timer due ${new Date(soonest.due_at).toLocaleString()}`,
      body: `${timers.length} filing deadline${timers.length === 1 ? '' : 's'} tracked. Don't miss the window.`,
      urgency: urg,
      cta: 'Review timers',
      href: `/trips/${trip_id}/incidents/${incident_id}`,
    });
  }

  ladder.push({
    key: 'options',
    title: hasSelection ? 'Your option is recorded' : 'Pick your path',
    body: hasSelection
      ? `You chose "${incident.selected_option_id}". Change it any time before filing.`
      : 'Rebook, refund, accommodation, or statutory compensation — pick what fits your situation.',
    urgency: hasSelection ? 'later' : 'now',
    cta: hasSelection ? 'Review options' : 'Explore options',
    href: `/trips/${trip_id}/incidents/${incident_id}/options`,
  });

  ladder.push({
    key: 'rights',
    title: 'Check statutory rights',
    body: 'Evaluate EU261, UK261, US DOT tarmac, and US DOT refund rules against this incident. Each run stores a reasoning trace.',
    urgency: 'soon',
    cta: 'Open rights evaluator',
    href: `/trips/${trip_id}/incidents/${incident_id}/rights`,
  });

  ladder.push({
    key: 'packet',
    title: hasPacket ? `Packet ready (${packet.packet_status})` : 'Build your claim packet',
    body: hasPacket
      ? 'Your incident, evidence, and policy context are bundled. Rebuild to refresh with new evidence.'
      : 'We sequence your documentation so filing is a single linear path.',
    urgency: hasPacket ? 'later' : 'soon',
    cta: hasPacket ? 'Open packet' : 'Build packet',
    href: `/trips/${trip_id}/incidents/${incident_id}/packet`,
  });

  if (status === 'CLAIM_ROUTING_READY' || hasPacket) {
    ladder.push({
      key: 'route',
      title: 'Route this claim',
      body: 'Submit through the recommended provider chain.',
      urgency: 'soon',
      cta: 'Route now',
      href: `/trips/${trip_id}/incidents/${incident_id}/route`,
    });
  }

  return (
    <div style={{ maxWidth: 820, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href={`/trips/${trip_id}/incidents/${incident_id}`} style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back to incident
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px' }}>Action ladder</h1>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px', lineHeight: 1.55 }}>
        Ordered by what matters now. Each step feeds the next; nothing is skipped silently.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ladder.map((step, i) => {
          const s = URGENCY_STYLES[step.urgency];
          return (
            <div key={step.key} style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.05em', margin: 0, textTransform: 'uppercase' }}>
                  Step {i + 1}
                </p>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: s.fg,
                  background: s.bg, border: `1px solid ${s.border}`,
                  borderRadius: 20, padding: '2px 9px', textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {s.label}
                </span>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '0 0 4px' }}>{step.title}</p>
              <p style={{ fontSize: 13, color: '#555', margin: '0 0 12px', lineHeight: 1.55 }}>{step.body}</p>
              {step.href && (
                <Link href={step.href} style={{
                  display: 'inline-block', padding: '8px 16px',
                  background: '#1A2B4A', color: 'white',
                  borderRadius: 7, fontSize: 12, fontWeight: 600,
                  textDecoration: 'none',
                }}>
                  {step.cta}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
