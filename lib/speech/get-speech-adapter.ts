import type { SpeechCaptureAdapter } from './speech-adapter';
import { createWebSpeechAdapter } from './web-speech-adapter';

export function getSpeechAdapter(): SpeechCaptureAdapter {
  // Single point of control: swap implementations here later (e.g. Wispr).
  return createWebSpeechAdapter();
}

