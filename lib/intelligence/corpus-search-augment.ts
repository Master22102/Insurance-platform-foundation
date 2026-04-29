/**
 * Corpus search augmentation — optional web freshness layer on top of corpus.
 * Results are labeled web-sourced, not corpus-verified.
 */

export interface AugmentTopic {
  pattern: RegExp;
  query: string;
  corpus_doc: string | null;
}

export interface AugmentResult {
  topic: string;
  corpus_doc: string | null;
  web_summary: string | null;
  web_sources: string[];
  freshness_note: string;
  searched_at: string;
}

const HIGH_STAKES_TOPICS: AugmentTopic[] = [
  { pattern: /japan.*pet|pet.*japan/i, query: 'Japan pet import requirements 2025', corpus_doc: 'MAFF_AQS_Japan_Pet_Import' },
  { pattern: /australia.*pet|pet.*australia/i, query: 'Australia pet import requirements 2025', corpus_doc: null },
  { pattern: /hawaii.*pet|pet.*hawaii/i, query: 'Hawaii pet quarantine requirements 2025', corpus_doc: null },
  { pattern: /cdc.*dog|dog.*import.*us/i, query: 'CDC dog import requirements 2025', corpus_doc: 'CDC_Dog_Import_Requirements' },
  { pattern: /eu261|european.*flight.*cancel/i, query: 'EU261 flight compensation 2025', corpus_doc: 'EU261_Regulation_2004' },
  { pattern: /united.*pet|pet.*united/i, query: 'United Airlines pet policy 2025', corpus_doc: 'United_Airlines_Pet_Policy' },
  { pattern: /delta.*pet|pet.*delta/i, query: 'Delta pet policy 2025', corpus_doc: 'Delta_Pet_Policy' },
];

export function detectHighStakesTopics(text: string): AugmentTopic[] {
  return HIGH_STAKES_TOPICS.filter((t) => t.pattern.test(text));
}

export async function augmentWithWebSearch(
  topic: { query: string; corpus_doc: string | null },
  openRouterKey: string,
): Promise<AugmentResult> {
  const base: AugmentResult = {
    topic: topic.query,
    corpus_doc: topic.corpus_doc,
    web_summary: null,
    web_sources: [],
    freshness_note: 'Web search unavailable — using corpus only',
    searched_at: new Date().toISOString(),
  };
  if (!openRouterKey) return base;

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openRouterKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wayfarer.app',
        'X-Title': 'Wayfarer Regulatory Freshness Check',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_VOICE_PARSE_MODEL ?? 'anthropic/claude-haiku-4-5',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: `Search for current information about: ${topic.query}

Return a JSON object with:
- summary: 2-3 sentence plain summary of current requirements (string)
- key_facts: array of up to 3 specific facts with dates/numbers (string[])
- sources: array of source URLs found (string[])
- last_updated: most recent date mentioned in results (string or null)

Return ONLY valid JSON.`,
          },
        ],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      }),
    });

    if (!resp.ok) return { ...base, freshness_note: `OpenRouter HTTP ${resp.status}` };

    const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '{}';
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(content.replace(/```json|```/g, '').trim()) as Record<string, unknown>;
    } catch {
      parsed = {};
    }

    return {
      topic: topic.query,
      corpus_doc: topic.corpus_doc,
      web_summary: (parsed.summary as string) ?? null,
      web_sources: (parsed.sources as string[]) ?? [],
      freshness_note: `Web search: ${new Date().toLocaleDateString()}`,
      searched_at: new Date().toISOString(),
    };
  } catch {
    return base;
  }
}
