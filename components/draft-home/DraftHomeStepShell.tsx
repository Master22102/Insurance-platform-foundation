'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/auth/supabase-client';
import { useAuth } from '@/lib/auth/auth-context';

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 3,
            flex: 1,
            borderRadius: 2,
            background: i + 1 <= step ? '#1A2B4A' : '#e5e7eb',
          }}
        />
      ))}
    </div>
  );
}

const DRAFT_STEPS: Array<{ step: number; href: (tripId: string) => string; label: string; short: string }> = [
  { step: 1, href: (id) => `/trips/${id}/draft`, label: 'Home', short: 'Home' },
  { step: 2, href: (id) => `/trips/${id}/draft/voice`, label: 'Capture', short: 'Voice' },
  { step: 3, href: (id) => `/trips/${id}/draft/route`, label: 'Route', short: 'Route' },
  { step: 4, href: (id) => `/trips/${id}/draft/activities`, label: 'Activities', short: 'Act.' },
  { step: 5, href: (id) => `/trips/${id}/draft/unresolved`, label: 'Blockers', short: 'Block' },
  { step: 6, href: (id) => `/trips/${id}/draft/readiness`, label: 'Readiness', short: 'Ready' },
];

function DraftFlowSubNav({ tripId, activeStep }: { tripId: string; activeStep: number }) {
  const { user } = useAuth();
  const [openBlockers, setOpenBlockers] = useState(0);
  const [userOpenBlockers, setUserOpenBlockers] = useState(0);
  const [maturity, setMaturity] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    supabase
      .from('trips')
      .select('maturity_state')
      .eq('trip_id', tripId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setMaturity(data?.maturity_state ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  useEffect(() => {
    if (!tripId || !user) {
      setOpenBlockers(0);
      setUserOpenBlockers(0);
      return;
    }
    let cancelled = false;
    Promise.all([
      supabase
        .from('unresolved_items')
        .select('item_id', { count: 'exact', head: true })
        .eq('trip_id', tripId)
        .eq('is_resolved', false)
        .eq('item_type', 'blocker'),
      supabase
        .from('unresolved_items')
        .select('item_id', { count: 'exact', head: true })
        .eq('trip_id', tripId)
        .eq('is_resolved', false)
        .eq('item_type', 'blocker')
        .eq('source', 'user'),
    ]).then(([all, usr]) => {
      if (!cancelled) {
        setOpenBlockers(all.count ?? 0);
        setUserOpenBlockers(usr.count ?? 0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tripId, user]);

  const isDraft = !maturity || maturity === 'DRAFT';
  const lockReadiness = isDraft && userOpenBlockers > 0;

  return (
    <nav
      aria-label="Draft workflow steps"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 16,
        padding: '10px 0',
        borderBottom: '1px solid #eef2f7',
      }}
    >
      {DRAFT_STEPS.map(({ step, href, short }) => {
        const isActive = step === activeStep;
        const isBlockers = step === 5;
        const isReady = step === 6;
        return (
          <Link
            key={step}
            href={href(tripId)}
            title={DRAFT_STEPS.find((s) => s.step === step)?.label}
            style={{
              fontSize: 11,
              fontWeight: isActive ? 900 : 600,
              padding: '6px 10px',
              borderRadius: 8,
              textDecoration: 'none',
              border: `1px solid ${isActive ? '#1A2B4A' : '#e5e7eb'}`,
              background: isActive ? '#eff4fc' : 'white',
              color: isActive ? '#1A2B4A' : '#6b7280',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {short}
            {isBlockers && openBlockers > 0 ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  background: '#f97316',
                  color: 'white',
                  borderRadius: 999,
                  padding: '1px 6px',
                  minWidth: 18,
                  textAlign: 'center',
                }}
              >
                {openBlockers}
              </span>
            ) : null}
            {isReady && lockReadiness ? <span aria-hidden>🔒</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export default function DraftHomeStepShell({
  screenId,
  tripId,
  title,
  step,
  total,
  backHref,
  children,
}: {
  screenId: string;
  tripId: string;
  title: string;
  step: number;
  total: number;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-screen-id={screenId}
      style={{ maxWidth: 620, margin: '0 auto', padding: '28px 16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1A2B4A', letterSpacing: '-0.3px' }}>{title}</h1>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Trip: {tripId}</div>
          </div>
          {backHref ? (
            <Link
              href={backHref}
              style={{
                fontSize: 13,
                color: '#888',
                textDecoration: 'none',
                border: '1px solid #e5e7eb',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'white',
                flexShrink: 0,
              }}
            >
              Back
            </Link>
          ) : (
            <Link
              href="/trips"
              style={{
                fontSize: 13,
                color: '#888',
                textDecoration: 'none',
                border: '1px solid #e5e7eb',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'white',
                flexShrink: 0,
              }}
            >
              All trips
            </Link>
          )}
        </div>
        <StepIndicator step={step} total={total} />
        {tripId ? <DraftFlowSubNav tripId={tripId} activeStep={step} /> : null}
      </div>

      {children}
    </div>
  );
}
