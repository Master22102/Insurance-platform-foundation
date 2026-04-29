'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import EmergencySosSheet from '@/components/emergency/EmergencySosSheet';
import SafetyCardPanel from '@/components/emergency/SafetyCardPanel';
import { useIsMobile, useIsTablet } from '@/lib/hooks/useIsMobile';
import { mobileStyles, tabletStyles } from '@/lib/styles/responsive';

function SafetyInner() {
  const search = useSearchParams();
  const tripId = search?.get('trip_id') || undefined;
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  return (
    <div
      data-testid="safety-page-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...(isMobile ? mobileStyles.appContentMobile : isTablet ? tabletStyles.appContent : { paddingBottom: 32 }),
        boxSizing: 'border-box',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1A2B4A' }}>Safety</h1>
      <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
        Emergency actions, multilingual safety card, and travel-ready details.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="safety-open-sos-button"
        style={{
          width: isMobile ? '100%' : 'fit-content',
          padding: '12px 16px',
          minHeight: 48,
          borderRadius: 10,
          border: '1px solid #fecaca',
          background: '#fff1f2',
          color: '#9f1239',
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        Open SOS
      </button>
      <SafetyCardPanel tripId={tripId} />
      <EmergencySosSheet open={open} onClose={() => setOpen(false)} tripId={tripId} />
    </div>
  );
}

export default function SafetyPage() {
  return (
    <Suspense>
      <SafetyInner />
    </Suspense>
  );
}
