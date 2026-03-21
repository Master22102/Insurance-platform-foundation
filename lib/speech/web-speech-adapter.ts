import type { SpeechCaptureAdapter, SpeechStartOptions } from './speech-adapter';

function normalizeSpeechError(err: any): string {
  const code = err?.error || err?.name || '';
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Microphone permission was blocked.';
  if (code === 'network' || code === 'audio-capture') return 'Speech service is unavailable right now. Please try again.';
  if (code === 'no-speech') return 'No speech detected. Please try again.';
  return 'Could not capture speech. Please type your expectations instead.';
}

export function createWebSpeechAdapter(): SpeechCaptureAdapter {
  const SpeechRecognitionCtor: any =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  if (!SpeechRecognitionCtor) {
    return {
      supported: false,
      status: 'idle',
      start: () => {},
      stop: () => {},
    };
  }

  let recognition: any | null = null;
  let status: 'idle' | 'listening' = 'idle';
  let maxTimer: ReturnType<typeof setTimeout> | null = null;

  const adapter: SpeechCaptureAdapter = {
    supported: true,
    get status() {
      return status;
    },
    start: (opts: SpeechStartOptions) => {
      if (!SpeechRecognitionCtor) {
        opts.onError('Speech-to-text is not supported in this browser.');
        return;
      }

      // Stop any previous session.
      if (recognition) {
        try {
          recognition.stop();
        } catch {}
      }

      status = 'listening';

      const recognitionInstance = new SpeechRecognitionCtor();
      recognition = recognitionInstance;

      recognitionInstance.lang = opts.lang || 'en-US';
      recognitionInstance.interimResults = opts.interimResults ?? true;
      recognitionInstance.continuous = false;
      recognitionInstance.maxAlternatives = 1;

      recognitionInstance.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i]?.[0]?.transcript ?? '';
        }
        transcript = transcript.trim();
        if (!transcript) return;

        const isFinal = Array.from(event.results).some((r: any, idx: number) => {
          // Only treat results starting from resultIndex as candidates for final.
          return idx >= event.resultIndex && r?.isFinal === true;
        });
        opts.onTranscript(transcript, isFinal);
      };

      recognitionInstance.onerror = (event: any) => {
        status = 'idle';
        if (maxTimer) clearTimeout(maxTimer);
        opts.onError(normalizeSpeechError(event));
      };

      recognitionInstance.onend = () => {
        status = 'idle';
        if (maxTimer) clearTimeout(maxTimer);
        opts.onEnd?.();
      };

      maxTimer = opts.maxDurationMs
        ? setTimeout(() => {
            try {
              recognitionInstance.stop();
            } catch {}
          }, opts.maxDurationMs)
        : null;

      recognitionInstance.start();
    },
    stop: () => {
      status = 'idle';
      if (maxTimer) clearTimeout(maxTimer);
      maxTimer = null;
      if (recognition) {
        try {
          recognition.stop();
        } catch {}
      }
    },
  };

  return adapter;
}

