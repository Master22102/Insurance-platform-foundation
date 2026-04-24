import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type VoiceContext =
  | 'signal_capture'
  | 'trip_narration'
  | 'incident_report'
  | 'evidence_note'
  | 'field_note'
  | 'search_query'
  | 'general';

const VALID_CONTEXTS: VoiceContext[] = [
  'signal_capture', 'trip_narration', 'incident_report',
  'evidence_note', 'field_note', 'search_query', 'general',
];

interface VoiceParseRequest {
  transcript: string;
  context: VoiceContext;
  trip_id?: string;
  incident_id?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: VoiceParseRequest = await req.json();

    if (!body.transcript || typeof body.transcript !== 'string') {
      return NextResponse.json({ error: 'transcript is required' }, { status: 400 });
    }
    if (!body.context || !VALID_CONTEXTS.includes(body.context)) {
      return NextResponse.json({ error: 'Invalid context type' }, { status: 400 });
    }

    const model = body.context === 'signal_capture'
      ? 'anthropic/claude-3.5-sonnet'
      : 'anthropic/claude-3-haiku';

    // Placeholder — wire to OpenRouter when API key is configured
    const response = {
      parsed: {
        context: body.context,
        transcript_length: body.transcript.length,
        trip_id: body.trip_id || null,
        incident_id: body.incident_id || null,
      },
      confidence: 0.0,
      context: body.context,
      model_used: model,
      raw_transcript: body.transcript,
    };

    await supabase.from('event_logs').insert({
      event_type: 'voice_parse_requested',
      actor_id: user.id,
      actor_type: 'user',
      related_entity_type: body.trip_id ? 'trip' : 'account',
      related_entity_id: body.trip_id || user.id,
      event_data: {
        context: body.context,
        model,
        transcript_length: body.transcript.length,
        confidence: response.confidence,
      },
    });

    return NextResponse.json(response);
  } catch (err) {
    console.error('Voice parse error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
