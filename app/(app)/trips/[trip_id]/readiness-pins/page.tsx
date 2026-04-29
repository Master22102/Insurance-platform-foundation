'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/auth/supabase-client';
import { useAuth } from '@/lib/auth/auth-context';
import { normalizeCountryToCode, summarizeVisaRules } from '@/lib/readiness/entry-requirements';
import AppPageRoot from '@/components/layout/AppPageRoot';

const CHECK_ITEMS = [
  { key: 'passport', label: 'Passport readiness', detail: 'Check validity and blank pages for each destination.' },
  { key: 'visa', label: 'Visa / entry requirements', detail: 'Verify entry rules by destination country and transit stops.' },
  { key: 'health', label: 'Vaccinations / health entry', detail: 'Check destination-specific vaccination and health documentation requirements.' },
  { key: 'contacts', label: 'Emergency contacts (optional)', detail: 'Add local emergency and personal fallback contacts.' },
  { key: 'vault', label: 'Document vault (optional)', detail: 'Store copies of passport, itinerary, and policy artifacts for quick retrieval.' },
];

type ItemStatus = 'not_started' | 'in_progress' | 'ready';

function statusStyle(status: ItemStatus): { label: string; color: string; bg: string; border: string } {
  if (status === 'ready') return { label: 'Ready', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' };
  if (status === 'in_progress') return { label: 'In progress', color: '#92400e', bg: '#fffbeb', border: '#fde68a' };
  return { label: 'Not started', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' };
}

export default function ReadinessPinsPage() {
  const { user } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const tripId = params?.trip_id as string;
  const [loading, setLoading] = useState(true);
  const [originCountryRaw, setOriginCountryRaw] = useState<string>('');
  const [destinations, setDestinations] = useState<Array<{ name: string; code: string | null }>>([]);
  const [itemStatusByKey, setItemStatusByKey] = useState<Record<string, ItemStatus>>({});
  const [assistMode, setAssistMode] = useState<'self' | 'guided' | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [expandedDestination, setExpandedDestination] = useState<string | null>(null);
  const [signalProfile, setSignalProfile] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!user || !tripId) return;
    let active = true;

    Promise.all([
      supabase
        .from('user_profiles')
        .select('primary_nationality, country_of_residence, preferences')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('trips')
        .select('destination_summary')
        .eq('trip_id', tripId)
        .maybeSingle(),
      supabase
        .from('route_segments')
        .select('origin, destination')
        .eq('trip_id', tripId),
    ]).then(([profileRes, tripRes, segmentsRes]) => {
      if (!active) return;
      const profile = profileRes.data as any;
      const prefs = profile?.preferences as Record<string, unknown> | undefined;
      const sp = prefs?.signal_profile as Record<string, unknown> | undefined;
      setSignalProfile(sp && typeof sp === 'object' ? sp : null);
      const origin = String(
        profile?.primary_nationality ||
        profile?.country_of_residence ||
        '',
      ).trim();
      setOriginCountryRaw(origin);

      const values: string[] = [];
      const tripDest = String((tripRes.data as any)?.destination_summary || '').trim();
      if (tripDest) values.push(...tripDest.split(/[;,]/).map((s) => s.trim()).filter(Boolean));
      for (const seg of (segmentsRes.data || [])) {
        const v = String((seg as any)?.destination || '').trim();
        if (v) values.push(v);
      }

      const unique = Array.from(new Set(values)).slice(0, 8);
      setDestinations(unique.map((name) => ({ name, code: normalizeCountryToCode(name) })));
      setLoading(false);
    }).catch(() => setLoading(false));

    return () => {
      active = false;
    };
  }, [user, tripId]);

  const originCode = useMemo(
    () => normalizeCountryToCode(originCountryRaw),
    [originCountryRaw],
  );
  const visaSignals = useMemo(
    () => summarizeVisaRules(originCode, destinations),
    [originCode, destinations],
  );
  const hasJapanDestination = useMemo(() => {
    const blob = [...destinations.map((d) => d.name), ...destinations.map((d) => d.code || '')].join(' ');
    return /japan|tokyo|osaka|nrt|kix|fukuoka|okinawa|cts/i.test(blob);
  }, [destinations]);

  useEffect(() => {
    if (searchParams?.get('section') !== 'pet') return;
    const t = setTimeout(() => {
      document.getElementById('pet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
    return () => clearTimeout(t);
  }, [searchParams]);

  const destinationCards = useMemo(() => {
    return destinations.map((d, idx) => {
      const signal = visaSignals[idx] || { label: `${d.name}: review entry requirements manually.`, severity: 'info' as const };
      return { destination: d, signal };
    });
  }, [destinations, visaSignals]);
  const storageKey = useMemo(() => `wayfarer_readiness_pins_${tripId}`, [tripId]);

  useEffect(() => {
    if (!tripId || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.itemStatusByKey && typeof parsed.itemStatusByKey === 'object') {
        setItemStatusByKey(parsed.itemStatusByKey);
      }
      if (parsed?.assistMode === 'self' || parsed?.assistMode === 'guided') {
        setAssistMode(parsed.assistMode);
      }
      if (typeof parsed?.lastUpdatedAt === 'string') {
        setLastUpdatedAt(parsed.lastUpdatedAt);
      }
    } catch {
      // ignore local storage parse issues
    }
  }, [storageKey, tripId]);

  useEffect(() => {
    if (!user || !tripId) return;
    let active = true;
    supabase
      .from('readiness_pin_states')
      .select('item_key, status, assist_mode, updated_at')
      .eq('trip_id', tripId)
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!active || !data) return;
        const statusMap: Record<string, ItemStatus> = {};
        let nextAssistMode: 'self' | 'guided' | null = null;
        let newestUpdatedAt: string | null = null;
        for (const row of data as any[]) {
          const key = String(row?.item_key || '');
          const status = row?.status;
          if (key && (status === 'not_started' || status === 'in_progress' || status === 'ready')) {
            statusMap[key] = status;
          }
          if (key === '__assist_mode' && (row?.assist_mode === 'self' || row?.assist_mode === 'guided')) {
            nextAssistMode = row.assist_mode;
          }
          if (row?.updated_at && (!newestUpdatedAt || String(row.updated_at) > newestUpdatedAt)) {
            newestUpdatedAt = String(row.updated_at);
          }
        }
        // Conflict handling: server state wins when present.
        if (Object.keys(statusMap).length > 0) setItemStatusByKey(statusMap);
        if (nextAssistMode) setAssistMode(nextAssistMode);
        if (newestUpdatedAt) setLastUpdatedAt(newestUpdatedAt);
      });
    return () => {
      active = false;
    };
  }, [tripId, user]);

  useEffect(() => {
    if (!tripId || typeof window === 'undefined') return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ itemStatusByKey, assistMode, lastUpdatedAt }),
    );
  }, [assistMode, itemStatusByKey, lastUpdatedAt, storageKey, tripId]);

  const cycleStatus = (key: string) => {
    setItemStatusByKey((prev) => {
      const current = prev[key] || 'not_started';
      const next: ItemStatus =
        current === 'not_started' ? 'in_progress' :
        current === 'in_progress' ? 'ready' :
        'not_started';
      const nowIso = new Date().toISOString();
      setLastUpdatedAt(nowIso);
      if (user && tripId) {
        void supabase.from('readiness_pin_states').upsert({
          trip_id: tripId,
          user_id: user.id,
          item_key: key,
          status: next,
          assist_mode: null,
          updated_at: nowIso,
        }, { onConflict: 'trip_id,user_id,item_key' });
      }
      return { ...prev, [key]: next };
    });
  };

  return (
    <AppPageRoot>
    <div style={{ maxWidth: 680, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link
        href={`/trips/${tripId}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', textDecoration: 'none', marginBottom: 14 }}
      >
        <span aria-hidden>←</span> Back to trip
      </Link>

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: '#1A2B4A', letterSpacing: '-0.3px' }}>
          Entry & documentation checklist
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
          Before you lock anything in, here&apos;s what travel-ready looks like.
        </p>
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Nationality-aware entry check
        </p>
        {loading ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
            Checking origin and destination requirements...
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              Using profile nationality/residence: <strong>{originCountryRaw || 'Not set'}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {visaSignals.map((v, i) => (
                <p key={i} style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: v.severity === 'warn' ? '#92400e' : v.severity === 'ok' ? '#166534' : '#475569' }}>
                  • {v.label}
                </p>
              ))}
            </div>
            {destinationCards.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {destinationCards.map(({ destination, signal }) => {
                  const isOpen = expandedDestination === destination.name;
                  return (
                    <div key={destination.name} style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: 'white' }}>
                      <button
                        type="button"
                        onClick={() => setExpandedDestination((prev) => (prev === destination.name ? null : destination.name))}
                        style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{destination.name}</span>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          borderRadius: 20,
                          padding: '2px 8px',
                          border: `1px solid ${signal.severity === 'warn' ? '#fde68a' : signal.severity === 'ok' ? '#bbf7d0' : '#e2e8f0'}`,
                          background: signal.severity === 'warn' ? '#fffbeb' : signal.severity === 'ok' ? '#f0fdf4' : '#f8fafc',
                          color: signal.severity === 'warn' ? '#92400e' : signal.severity === 'ok' ? '#166534' : '#475569',
                        }}>
                          {signal.severity === 'warn' ? 'Action needed' : signal.severity === 'ok' ? 'Likely clear' : 'Review needed'}
                        </span>
                      </button>
                      {isOpen && (
                        <div style={{ borderTop: '1px solid #eef2f7', padding: '8px 12px 10px' }}>
                          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{signal.label}</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#64748b', lineHeight: 1.45 }}>
                            Health/vaccination status: connector-ready. Live feed can be plugged in per destination.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
              This is a readiness aid and may not reflect last-minute policy changes. Confirm with official immigration/health advisories before travel.
            </p>
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {CHECK_ITEMS.map((item) => (
          <div key={item.key} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1f2937' }}>{item.label}</p>
              {(() => {
                const currentStatus = itemStatusByKey[item.key] || 'not_started';
                const s = statusStyle(currentStatus);
                return (
                  <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                    {s.label}
                  </span>
                );
              })()}
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{item.detail}</p>
            <button
              type="button"
              onClick={() => cycleStatus(item.key)}
              style={{ border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              Update status
            </button>
          </div>
        ))}
      </div>

      {signalProfile?.pet_travel === true && (
        <section
          id="pet"
          style={{
            marginBottom: 16,
            padding: '14px 16px',
            borderRadius: 10,
            border: '1px solid #fde68a',
            background: '#fffbeb',
          }}
        >
          <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#92400e' }}>Traveling with a pet</h2>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#78350f', lineHeight: 1.55 }}>
            You mentioned bringing a pet. Rules vary by destination and carrier — start early on paperwork and carrier limits.
          </p>
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #fcd34d',
              background: '#fff7ed',
            }}
          >
            <strong style={{ fontSize: 12, color: '#9a3412' }}>Carrier restrictions</strong>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#7c2d12', lineHeight: 1.5 }}>
              United Airlines and American Airlines do not accept checked pets for most leisure travelers — in-cabin only for eligible
              animals. Large pets may not fit airline rules on those carriers.
            </p>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white' }}>
            <strong style={{ fontSize: 12, color: '#334155' }}>Documentation to plan for</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: '#475569', lineHeight: 1.55 }}>
              <li>Health certificate (often within 10 days of travel — confirm with your carrier)</li>
              <li>Microchip (commonly required for US, EU, and Japan entry)</li>
              <li>Rabies vaccination record and any titer timing rules</li>
              {hasJapanDestination && (
                <li style={{ fontWeight: 700, color: '#92400e' }}>
                  Japan: notify Animal Quarantine Service well before arrival. Without correct advance steps, quarantine holds can be lengthy.
                </li>
              )}
            </ul>
          </div>
          <a
            href="https://www.aphis.usda.gov/aphis/pet-travel"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-block', marginTop: 12, fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}
          >
            USDA APHIS pet travel requirements (official) →
          </a>
        </section>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            setAssistMode('self');
            const nowIso = new Date().toISOString();
            setLastUpdatedAt(nowIso);
            if (user && tripId) {
              void supabase.from('readiness_pin_states').upsert({
                trip_id: tripId,
                user_id: user.id,
                item_key: '__assist_mode',
                status: null,
                assist_mode: 'self',
                updated_at: nowIso,
              }, { onConflict: 'trip_id,user_id,item_key' });
            }
          }}
          style={{ border: '1px solid #e2e8f0', background: 'white', color: '#334155', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          I&apos;ll handle this myself
        </button>
        <button
          type="button"
          onClick={() => {
            setAssistMode('guided');
            const nowIso = new Date().toISOString();
            setLastUpdatedAt(nowIso);
            if (user && tripId) {
              void supabase.from('readiness_pin_states').upsert({
                trip_id: tripId,
                user_id: user.id,
                item_key: '__assist_mode',
                status: null,
                assist_mode: 'guided',
                updated_at: nowIso,
              }, { onConflict: 'trip_id,user_id,item_key' });
            }
          }}
          style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1e3a8a', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Help me organize this
        </button>
        <Link
          href={`/trips/${tripId}`}
          style={{ border: 'none', background: '#1A2B4A', color: 'white', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
        >
          Continue
        </Link>
      </div>
      {assistMode && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
          Mode selected: <strong>{assistMode === 'self' ? "I'll handle this myself" : 'Help me organize this'}</strong>
        </p>
      )}
      {lastUpdatedAt && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
          Last updated: {new Date(lastUpdatedAt).toLocaleString()}
        </p>
      )}
    </div>
    </AppPageRoot>
  );
}

