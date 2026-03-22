'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VoiceCaptureContext } from '@/lib/voice/parse-context';

export type VoiceArtifactRow = {
  account_id: string;
  trip_id?: string | null;
  incident_id?: string | null;
  capture_context: VoiceCaptureContext;
  transcript_raw: string;
  transcript_normalized?: string | null;
  parse_attempt?: Record<string, unknown> | null;
  confirmation_state: 'proposed' | 'confirmed' | 'rejected' | 'expired';
  confirmed_fields?: Record<string, unknown> | null;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
  duration_seconds?: number | null;
  model_used?: string | null;
  parse_latency_ms?: number | null;
  parse_attempt_number?: number;
};

/** Best-effort audit row; fails quietly if migration not applied. */
export async function insertVoiceArtifact(
  supabase: SupabaseClient,
  row: VoiceArtifactRow,
): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('voice_artifacts').insert(row);
  if (error) {
    console.warn('[voice] voice_artifacts insert:', error.message);
    return { ok: false };
  }
  return { ok: true };
}
