/**
 * Server-only: append-only AI interaction audit (service role).
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';

export type AiInteractionType =
  | 'voice_parse'
  | 'quick_scan'
  | 'deep_scan'
  | 'policy_extraction'
  | 'itinerary_extraction'
  | 'coverage_qa'
  | 'signal_categorize'
  | 'activity_suggest';

export type LogAiInteractionInput = {
  userId: string;
  interactionType: AiInteractionType;
  modelUsed?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd?: number | null;
  promptCategory?: string | null;
  flagged?: boolean;
  flagReason?: string | null;
  responseTruncated?: boolean;
};

function extractUsageTokens(usage: unknown): { inTok?: number; outTok?: number } {
  if (!usage || typeof usage !== 'object') return {};
  const u = usage as Record<string, number | undefined>;
  return {
    inTok: u.prompt_tokens ?? u.input_tokens,
    outTok: u.completion_tokens ?? u.output_tokens,
  };
}

export function estimateCostUsd(model: string | undefined, inTok?: number, outTok?: number): number | null {
  if (inTok == null && outTok == null) return null;
  // Rough Haiku-tier defaults for monitoring only (not billing).
  const perIn = 0.000001;
  const perOut = 0.000003;
  return ((inTok ?? 0) * perIn + (outTok ?? 0) * perOut) / 1000;
}

export async function logAiInteraction(row: LogAiInteractionInput): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) return;
  try {
    await admin.from('ai_interaction_log').insert({
      user_id: row.userId,
      interaction_type: row.interactionType,
      model_used: row.modelUsed ?? null,
      input_tokens: row.inputTokens ?? null,
      output_tokens: row.outputTokens ?? null,
      cost_usd: row.costUsd ?? null,
      prompt_category: row.promptCategory ?? null,
      flagged: row.flagged ?? false,
      flag_reason: row.flagReason ?? null,
      response_truncated: row.responseTruncated ?? false,
    });
  } catch (e) {
    console.warn('[ai_interaction_log] insert skipped:', e);
  }
}

export { extractUsageTokens };

export const AI_ABUSE_PATTERNS = [
  /ignore.*instructions/i,
  /forget.*previous/i,
  /you are now/i,
  /act as/i,
  /pretend you/i,
  /system prompt/i,
  /jailbreak/i,
];

export function detectPromptInjection(inputText: string): boolean {
  return AI_ABUSE_PATTERNS.some((p) => p.test(inputText));
}
