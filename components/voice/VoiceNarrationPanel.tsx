'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSpeechCapture } from '@/lib/speech/useSpeechCapture';
import type { VoiceParseContext } from '@/lib/voice/parse-context';
import { insertVoiceArtifact } from '@/lib/voice/insert-voice-artifact';
import { supabase } from '@/lib/auth/supabase-client';

const BAR_COUNT = 32;
const WARN_AT_S = 4 * 60;
const DEFAULT_MAX_MS = 5 * 60 * 1000;
const MAX_PARSE_ATTEMPTS = 3;

function normalizeTranscript(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function isSensitiveKey(key: string): boolean {
  return /amount|expense|money|price|cost|denied|decline|refund|compensation|date|time|voucher/i.test(
    key,
  );
}

function useMicWaveform(active: boolean): [number[], () => number[]] {
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0));
  const snapshotRef = useRef<number[]>(Array(BAR_COUNT).fill(0));

  useEffect(() => {
    if (!active) {
      setLevels(Array(BAR_COUNT).fill(0));
      return;
    }
    let cancelled = false;
    let disposer: (() => void) | undefined;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        let raf = 0;
        const tick = () => {
          if (cancelled) return;
          analyser.getByteFrequencyData(data);
          const step = Math.max(1, Math.floor(data.length / BAR_COUNT));
          const next: number[] = [];
          for (let i = 0; i < BAR_COUNT; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) sum += data[Math.min(i * step + j, data.length - 1)] ?? 0;
            next.push((sum / step / 255) * 1.15);
          }
          snapshotRef.current = next;
          setLevels(next);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        disposer = () => {
          cancelAnimationFrame(raf);
          stream.getTracks().forEach((t) => t.stop());
          void ctx.close();
        };
      } catch {
        const pulse = Array(BAR_COUNT)
          .fill(0)
          .map((_, i) => 0.08 + Math.sin(Date.now() / 200 + i * 0.3) * 0.05);
        snapshotRef.current = pulse;
        setLevels(pulse);
      }
    })();

    return () => {
      cancelled = true;
      disposer?.();
    };
  }, [active]);

  const getSnapshot = useCallback(() => [...snapshotRef.current], []);
  return [levels, getSnapshot];
}

export type VoiceNarrationPanelProps = {
  context: VoiceParseContext;
  accountId: string;
  tripId?: string;
  incidentId?: string;
  onFieldsConfirmed: (
    fields: Record<string, unknown>,
    meta: {
      transcriptRaw: string;
      transcriptNormalized: string;
      parseAttempt: Record<string, unknown> | null;
    },
  ) => void;
  onCancel: () => void;
  existingFields?: Record<string, unknown>;
  maxDurationMs?: number;
};

type Phase =
  | 'chooser'
  | 'recording'
  | 'transcribing'
  | 'parsing'
  | 'confirmation'
  | 'error';

export default function VoiceNarrationPanel({
  context,
  accountId,
  tripId,
  incidentId,
  onFieldsConfirmed,
  onCancel,
  existingFields = {},
  maxDurationMs = DEFAULT_MAX_MS,
}: VoiceNarrationPanelProps) {
  const [phase, setPhase] = useState<Phase>('chooser');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [frozenWave, setFrozenWave] = useState<number[] | null>(null);
  const [waveColor, setWaveColor] = useState<'live' | 'done'>('live');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [warnLong, setWarnLong] = useState(false);
  const [parseFields, setParseFields] = useState<Record<string, unknown>>({});
  const [editedJson, setEditedJson] = useState<Record<string, unknown>>({});
  const [parseMeta, setParseMeta] = useState<{
    parsed: boolean;
    model?: string;
    latency?: number;
    message?: string;
  }>({ parsed: false });
  const [errorMsg, setErrorMsg] = useState('');
  const parseAttempts = useRef(0);
  const recordingStartedAt = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [waveLevels, getWaveSnapshot] = useMicWaveform(phase === 'recording');

  const { supported, status, error, start, stop, reset, lastTranscriptRef } = useSpeechCapture({
    continuous: true,
    maxDurationMs,
    onTranscript: (text) => {
      setLiveTranscript(text);
    },
    onError: (msg) => {
      setErrorMsg(msg);
      setPhase('error');
    },
  });

  useEffect(() => {
    if (phase !== 'recording') return;
    recordingStartedAt.current = Date.now();
    setElapsedMs(0);
    setWarnLong(false);
    timerRef.current = setInterval(() => {
      const e = Date.now() - recordingStartedAt.current;
      setElapsedMs(e);
      if (e >= WARN_AT_S * 1000) setWarnLong(true);
    }, 250);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [phase]);

  const mmss = useMemo(() => {
    const s = Math.floor(elapsedMs / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  }, [elapsedMs]);

  const beginRecording = () => {
    setErrorMsg('');
    setLiveTranscript('');
    setFinalTranscript('');
    setFrozenWave(null);
    setWaveColor('live');
    reset();
    parseAttempts.current = 0;
    setPhase('recording');
    start();
  };

  const endRecording = async () => {
    stop();
    setWaveColor('done');
    setFrozenWave(getWaveSnapshot());
    const raw = (lastTranscriptRef.current || liveTranscript).trim();
    setFinalTranscript(raw);
    if (!raw) {
      setErrorMsg('No speech captured. Try again or type instead.');
      setPhase('error');
      return;
    }
    setPhase('transcribing');
    await new Promise((r) => setTimeout(r, 400));
    await runParse(raw);
  };

  const runParse = async (raw: string) => {
    if (parseAttempts.current >= MAX_PARSE_ATTEMPTS) {
      setErrorMsg('Too many parse attempts. Type your details instead.');
      setPhase('error');
      return;
    }
    parseAttempts.current += 1;
    setPhase('parsing');
    try {
      const res = await fetch('/api/voice/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: raw,
          context,
          tripId,
          incidentId,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        parsed?: boolean;
        fields?: Record<string, unknown>;
        model_used?: string;
        parse_latency_ms?: number;
        message?: string;
      };
      if (!data.ok) throw new Error('Parse request failed');

      const merged = { ...existingFields, ...(data.fields || {}) };
      const withFallback =
        Object.keys(merged).length === 0 && raw.trim()
          ? { description: raw.trim(), ...merged }
          : merged;
      setParseFields(withFallback);
      setEditedJson(withFallback);
      setParseMeta({
        parsed: Boolean(data.parsed),
        model: data.model_used,
        latency: data.parse_latency_ms,
        message: data.message,
      });

      await insertVoiceArtifact(supabase, {
        account_id: accountId,
        trip_id: tripId ?? null,
        incident_id: incidentId ?? null,
        capture_context: context,
        transcript_raw: raw,
        transcript_normalized: normalizeTranscript(raw),
        parse_attempt: data.fields || null,
        confirmation_state: 'proposed',
        parse_attempt_number: parseAttempts.current,
        model_used: data.model_used ?? null,
        parse_latency_ms: data.parse_latency_ms ?? null,
        duration_seconds: Math.round(elapsedMs / 1000) || null,
      });

      setPhase('confirmation');
    } catch {
      setErrorMsg('Could not reach the parser. Try again or type instead.');
      setPhase('error');
    }
  };

  const handleConfirm = async () => {
    const raw = finalTranscript;
    const norm = normalizeTranscript(raw);
    await insertVoiceArtifact(supabase, {
      account_id: accountId,
      trip_id: tripId ?? null,
      incident_id: incidentId ?? null,
      capture_context: context,
      transcript_raw: raw,
      transcript_normalized: norm,
      parse_attempt: parseFields,
      confirmation_state: 'confirmed',
      confirmed_fields: editedJson,
      confirmed_at: new Date().toISOString(),
      confirmed_by: accountId,
      parse_attempt_number: parseAttempts.current,
    });
    onFieldsConfirmed(editedJson, {
      transcriptRaw: raw,
      transcriptNormalized: norm,
      parseAttempt: parseFields,
    });
  };

  const sheetStyle: CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 80,
    background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 12%)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    boxShadow: '0 -8px 32px rgba(15,23,42,0.12)',
    padding: '12px 18px 22px',
    maxHeight: 'min(92vh, 720px)',
    overflow: 'auto',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const bars = phase === 'recording' ? waveLevels : frozenWave || waveLevels;

  return (
    <div style={sheetStyle}>
      <div
        style={{
          width: 40,
          height: 4,
          borderRadius: 4,
          background: '#e2e8f0',
          margin: '0 auto 14px',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1A2B4A' }}>Voice narration</p>
        <button
          type="button"
          onClick={onCancel}
          style={{ border: 'none', background: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {phase === 'chooser' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button
            type="button"
            onClick={() => (supported ? beginRecording() : setPhase('error'))}
            style={{
              padding: '20px 14px',
              borderRadius: 12,
              border: '1px solid #fecaca',
              background: '#fff1f2',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎙</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#9f1239' }}>Voice narration</div>
            <div style={{ fontSize: 12, color: '#881337', marginTop: 4 }}>Speak freely — we&apos;ll summarize</div>
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '20px 14px',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              background: 'white',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>✏️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>Type instead</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Use keyboard input</div>
          </button>
        </div>
      )}

      {(phase === 'recording' || phase === 'transcribing') && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: waveColor === 'live' ? '#b91c1c' : '#15803d' }}>
              {waveColor === 'live' ? '● Recording' : '✓ Captured'}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', fontVariantNumeric: 'tabular-nums' }}>
              {mmss}
            </span>
          </div>
          {warnLong && waveColor === 'live' && (
            <p style={{ fontSize: 12, color: '#b45309', margin: '0 0 8px' }}>
              About a minute left — wrap up when you can.
            </p>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: 3,
              height: 72,
              padding: '8px 4px',
              background: '#0f172a',
              borderRadius: 12,
            }}
          >
            {bars.map((v, i) => (
              <div
                key={i}
                style={{
                  width: 5,
                  height: `${8 + v * 56}px`,
                  minHeight: 4,
                  borderRadius: 2,
                  background: waveColor === 'live' ? '#fb7185' : '#4ade80',
                  transition: waveColor === 'done' ? 'none' : 'height 0.05s linear',
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, minHeight: 36 }}>
            {liveTranscript || (status === 'listening' ? 'Listening…' : '')}
          </p>
          {phase === 'recording' && (
            <button
              type="button"
              onClick={() => void endRecording()}
              style={{
                width: '100%',
                marginTop: 10,
                padding: '12px 0',
                background: '#1A2B4A',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Stop & process
            </button>
          )}
          {phase === 'transcribing' && (
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13 }}>Processing what you said…</p>
          )}
        </div>
      )}

      {phase === 'parsing' && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ color: '#475569' }}>Understanding the details…</p>
        </div>
      )}

      {phase === 'confirmation' && (
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px' }}>Here&apos;s what we heard</p>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
            Review and edit if needed, then confirm the whole summary.
          </p>
          {!parseMeta.parsed && parseMeta.message && (
            <div
              style={{
                fontSize: 12,
                color: '#92400e',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                padding: '8px 10px',
                borderRadius: 8,
                marginBottom: 10,
              }}
            >
              {parseMeta.message}
            </div>
          )}
          <details style={{ marginBottom: 12 }}>
            <summary style={{ fontSize: 12, color: '#2E5FA3', cursor: 'pointer' }}>Original transcript</summary>
            <p style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{finalTranscript}</p>
          </details>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {Object.keys(editedJson).length === 0 ? (
              <p style={{ fontSize: 13, color: '#64748b' }}>No structured fields — add details manually after closing.</p>
            ) : (
              Object.entries(editedJson).map(([key, val]) => {
                const str = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
                const sens = isSensitiveKey(key);
                return (
                  <label key={key} style={{ display: 'block' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: sens ? '#b45309' : '#64748b',
                        textTransform: 'capitalize',
                      }}
                    >
                      {key.replace(/_/g, ' ')}
                      {sens ? ' · check carefully' : ''}
                    </span>
                    <textarea
                      value={str}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditedJson((prev) => ({ ...prev, [key]: v }));
                      }}
                      rows={key === 'description' || key === 'additional_details' || key === 'notes' ? 3 : 2}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        marginTop: 4,
                        padding: '8px 10px',
                        fontSize: 13,
                        border: `1px solid ${sens ? '#fcd34d' : '#e2e8f0'}`,
                        borderRadius: 8,
                        background: sens ? '#fffbeb' : 'white',
                        fontFamily: 'inherit',
                      }}
                    />
                  </label>
                );
              })
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleConfirm}
              style={{
                flex: 1,
                minWidth: 120,
                padding: '11px 0',
                background: 'linear-gradient(180deg, #2E5FA3 0%, #1A2B4A 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Confirm & apply
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase('chooser');
                setEditedJson({});
              }}
              style={{
                padding: '11px 16px',
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Start over
            </button>
            <button type="button" onClick={onCancel} style={{ padding: '11px 16px', border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div>
          <p style={{ color: '#b91c1c', fontSize: 14, marginBottom: 10 }}>{errorMsg || error}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setPhase('chooser');
                setErrorMsg('');
                reset();
              }}
              style={{
                flex: 1,
                padding: '10px 0',
                background: '#1A2B4A',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{ padding: '10px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}
            >
              Type instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
