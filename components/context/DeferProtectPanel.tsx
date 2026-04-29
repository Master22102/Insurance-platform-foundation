'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/auth/supabase-client';
import { useSpeechCapture } from '@/lib/speech/useSpeechCapture';

export interface DeferProtectPanelProps {
  tripId: string;
  incidentId: string;
  actorId: string;
  uncategorizedCount: number;
  onCaptured: () => void;
}

export default function DeferProtectPanel({
  tripId,
  incidentId,
  actorId,
  uncategorizedCount,
  onCaptured,
}: DeferProtectPanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const shotRef = useRef<HTMLInputElement>(null);

  const registerBlob = useCallback(
    async (label: string, file: File | null, description: string) => {
      if (!file && !description.trim()) return;
      setBusy(true);
      setError(null);
      const idem = `ctx-capture-${incidentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { data, error: rpcErr } = await supabase.rpc('register_evidence', {
        p_incident_id: incidentId,
        p_type: 'other',
        p_name: label,
        p_description: description || label,
        p_metadata: { evidence_category: 'uncategorized', contextual_capture: true },
        p_actor_id: actorId,
        p_idempotency_key: idem,
      });
      setBusy(false);
      if (rpcErr || !(data as { success?: boolean })?.success) {
        setError('Could not save that item. Try again from the incident page.');
        return;
      }
      onCaptured();
    },
    [actorId, incidentId, onCaptured],
  );

  const onPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    await registerBlob(`Photo — ${f.name}`, f, '');
  };

  const onScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    await registerBlob(`Screenshot — ${f.name}`, f, '');
  };

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px' }}>
        {uncategorizedCount} item{uncategorizedCount === 1 ? '' : 's'} captured, uncategorized
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => photoRef.current?.click()}
          style={bigCapture}
        >
          Take photo
        </button>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => void onPhotoChange(e)}
        />
        <button type="button" disabled={busy} onClick={() => setVoiceOpen(true)} style={bigCapture}>
          Voice note
        </button>
        {voiceOpen ? (
          <DeferProtectVoiceBlock
            onDismiss={() => setVoiceOpen(false)}
            onSave={async (text) => {
              await registerBlob('Voice note', null, text);
              setVoiceOpen(false);
            }}
            setParentError={setError}
          />
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => shotRef.current?.click()}
          style={bigCapture}
        >
          Screenshot / image
        </button>
        <input
          ref={shotRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => void onScreenshotChange(e)}
        />
        <button
          type="button"
          onClick={() => router.push(`/trips/${tripId}/incidents/${incidentId}`)}
          style={{ ...btnPrimary, marginTop: 4 }}
        >
          I&apos;m ready to organize
        </button>
      </div>
      {error ? <p style={{ fontSize: 12, color: '#b91c1c', margin: '10px 0 0' }}>{error}</p> : null}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: 'none',
  background: '#1A2B4A',
  color: 'white',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif',
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: '#e2e8f0',
  color: '#1e293b',
};

const btnGhost: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  background: 'white',
  fontSize: 13,
  cursor: 'pointer',
};

function DeferProtectVoiceBlock({
  onDismiss,
  onSave,
  setParentError,
}: {
  onDismiss: () => void;
  onSave: (text: string) => Promise<void>;
  setParentError: (m: string | null) => void;
}) {
  const [live, setLive] = useState('');
  const { supported, status, error: capErr, start, stop, reset } = useSpeechCapture({
    continuous: true,
    maxDurationMs: 120_000,
    onTranscript: (t) => setLive(t),
    onError: (m) => setParentError(m),
  });

  const finishVoice = async () => {
    stop();
    const text = live.trim();
    reset();
    if (!text) {
      onDismiss();
      return;
    }
    await onSave(text);
  };

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 10,
        border: '1px solid #e2e8f0',
        background: '#f8fafc',
      }}
    >
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>Voice note</p>
      {!supported ? (
        <p style={{ fontSize: 12, color: '#64748b' }}>Speech capture isn&apos;t available in this browser.</p>
      ) : (
        <>
          <p style={{ fontSize: 12, color: '#475569', minHeight: 40, margin: '0 0 8px' }}>{live || '…'}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {status === 'idle' ? (
              <button
                type="button"
                onClick={() => {
                  setParentError(null);
                  start();
                }}
                style={btnSecondary}
              >
                Start recording
              </button>
            ) : (
              <button type="button" onClick={() => void finishVoice()} style={btnPrimary}>
                Stop & save
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stop();
                reset();
                onDismiss();
              }}
              style={btnGhost}
            >
              Cancel
            </button>
          </div>
          {capErr ? <p style={{ fontSize: 11, color: '#b91c1c', margin: '8px 0 0' }}>{capErr}</p> : null}
        </>
      )}
    </div>
  );
}

const bigCapture: React.CSSProperties = {
  padding: '16px 18px',
  borderRadius: 12,
  border: '2px dashed #cbd5e1',
  background: '#fff',
  fontSize: 15,
  fontWeight: 600,
  color: '#0f172a',
  cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif',
  textAlign: 'center',
};
