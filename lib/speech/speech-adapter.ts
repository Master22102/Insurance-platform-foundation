export type SpeechAdapterStatus = 'idle' | 'listening';

export type SpeechTranscriptCallback = (text: string, isFinal: boolean) => void;
export type SpeechErrorCallback = (message: string) => void;

export type SpeechStartOptions = {
  lang?: string;
  interimResults?: boolean;
  /** When true, recognition runs until stop() or maxDurationMs (better for long narration). */
  continuous?: boolean;
  maxDurationMs?: number;
  onTranscript: SpeechTranscriptCallback;
  onError: SpeechErrorCallback;
  onEnd?: () => void;
};

export interface SpeechCaptureAdapter {
  supported: boolean;
  status: SpeechAdapterStatus;
  start(opts: SpeechStartOptions): void;
  stop(): void;
}

