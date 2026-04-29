'use client';

import { useEffect } from 'react';
import CreatorSearchPanel from './CreatorSearchPanel';

export default function CreatorDiscoveryModal({
  open,
  onClose,
  tripId,
}: {
  open: boolean;
  onClose: () => void;
  tripId?: string;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 50,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ width: 'min(980px, 100%)', maxHeight: '90vh', overflow: 'auto', background: 'white', borderRadius: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#111827' }}>Discover activities from creators</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Manual curation (MVP). Creator attribution is always preserved.</div>
          </div>
          <button
            onClick={onClose}
            style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 10, padding: '8px 10px', fontWeight: 800 }}
          >
            Close
          </button>
        </div>
        <div style={{ padding: 16 }}>
          <CreatorSearchPanel tripId={tripId} />
        </div>
      </div>
    </div>
  );
}

