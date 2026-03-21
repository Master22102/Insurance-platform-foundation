'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SpeechAdapterStatus, SpeechTranscriptCallback } from './speech-adapter';
import { getSpeechAdapter } from './get-speech-adapter';
import type { SpeechCaptureAdapter } from './speech-adapter';

type UseSpeechCaptureOptions = {
  lang?: string;
  interimResults?: boolean;
  maxDurationMs?: number;
  onTranscript?: SpeechTranscriptCallback;
  onError?: (message: string) => void;
  onEnd?: () => void;
};

export function useSpeechCapture(options: UseSpeechCaptureOptions = {}) {
  const adapter: SpeechCaptureAdapter = useMemo(() => getSpeechAdapter(), []);

  const [status, setStatus] = useState<SpeechAdapterStatus>('idle');
  const [supported, setSupported] = useState(adapter.supported);
  const [error, setError] = useState('');

  const lastTranscriptRef = useRef('');

  useEffect(() => {
    setSupported(adapter.supported);
  }, [adapter.supported]);

  const stopRef = useRef<() => void>(() => {});

  const start = useCallback(() => {
    if (!adapter.supported) {
      const msg = 'Speech-to-text is not available in this browser. Please type your expectations.';
      setError(msg);
      options.onError?.(msg);
      return;
    }
    setError('');

    let stopped = false;

    adapter.start({
      lang: options.lang,
      interimResults: options.interimResults ?? true,
      maxDurationMs: options.maxDurationMs,
      onTranscript: (text, isFinal) => {
        if (stopped) return;
        lastTranscriptRef.current = text;
        setStatus('listening');
        options.onTranscript?.(text, isFinal);
        // We keep status as listening; the UI can treat isFinal as "captured".
      },
      onError: (message) => {
        if (stopped) return;
        setError(message);
        setStatus('idle');
        options.onError?.(message);
      },
      onEnd: () => {
        if (stopped) return;
        setStatus('idle');
        options.onEnd?.();
      },
    });

    stopRef.current = () => {
      stopped = true;
      try {
        adapter.stop();
      } finally {
        setStatus('idle');
      }
    };
  }, [adapter, options]);

  const stop = useCallback(() => {
    stopRef.current();
  }, []);

  const reset = useCallback(() => {
    setError('');
    lastTranscriptRef.current = '';
    setStatus('idle');
  }, []);

  // Ensure we stop recognition when unmounting.
  useEffect(() => {
    return () => {
      try {
        adapter.stop();
      } catch {}
    };
  }, [adapter]);

  return { supported, status, error, start, stop, reset, lastTranscriptRef };
}

