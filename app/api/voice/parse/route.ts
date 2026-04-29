import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@supabase/ssr';
import {
  detectPromptInjection,
  estimateCostUsd,
  extractUsageTokens,
  logAiInteraction,
} from '@/lib/security/ai-interaction-log';
import {
  clientIpFromRequest,
  rateLimitedJsonResponse,
  userRateLimitedJsonResponse,
} from '@/lib/rate-limit/simple-memory';

export const runtime = 'nodejs';

// ── Model selection (§7.4.14 + MISMATCH-ONBOARD-001)
function normalizeOpenRouterModel(id: string): string {
  const m = id.trim();
  if (m.includes('/')) return m;
  if (/^claude-/i.test(m)) return `anthropic/${m}`;
  return m;
}

const ONBOARDING_MODEL = normalizeOpenRouterModel(
  process.env.OPENROUTER_ONBOARDING_MODEL ?? 'claude-sonnet-4',
);
const VOICE_MODEL = normalizeOpenRouterModel(
  process.env.OPENROUTER_VOICE_PARSE_MODEL ?? 'anthropic/claude-haiku-4.5',
);
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wayfarer.app';

const CONTEXT_TYPES = [
  'signal_capture',
  'incident_create',
  'incident_update',
  'route_segment',
  'carrier_response',
  'evidence_description',
  'signal_categorize',
] as const;

type ContextType = (typeof CONTEXT_TYPES)[number];

// ── Request schema (new API). round_number allows >3 at Zod level; signal_capture enforces ceiling in handler.
const RequestSchema = z.object({
  context_type: z.enum(CONTEXT_TYPES),
  transcript: z.string().min(1, 'Transcript must not be empty').max(10000),
  round_number: z.number().int().min(1).optional(),
  accumulated_parts: z.array(z.unknown()).optional(),
});

const LegacyBodySchema = z.object({
  context: z.enum(CONTEXT_TYPES),
  transcript: z.string().min(1).max(10000),
  tripId: z.string().optional(),
  incidentId: z.string().optional(),
});

// ── Output schemas
const SignalCaptureSchema = z.object({
  places: z.array(z.string()),
  my_thing: z.array(z.string()),
  food: z.array(z.string()),
  companions: z.array(z.string()),
  avoid: z.array(z.string()),
  venue_intents: z.array(
    z.object({
      name: z.string(),
      context: z.string(),
      resolved: z.literal(false),
    }),
  ),
  pet_travel: z.boolean(),
  pet_type: z.string().nullable(),
  pet_destination_type: z.enum(['domestic', 'international']).nullable(),
  catch_bucket: z.array(z.string()),
  ambiguity_question: z.string().nullable(),
  wayfarer_response: z.string().min(1),
});

const IncidentParseSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  disruption_type: z
    .enum(['delay', 'cancellation', 'missed_connection', 'denied_boarding', 'baggage', 'other'])
    .nullable(),
  carrier: z.string().nullable(),
  flight_number: z.string().nullable(),
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  disruption_time: z.string().nullable(),
  estimated_expenses: z.number().nullable(),
  currency: z.string().nullable(),
  causality_notes: z.string().nullable(),
  summary: z.string().min(1),
});

const IncidentUpdateSchema = z.object({
  additional_details: z.string().nullable(),
  timeline_events: z.array(
    z.object({
      time: z.string(),
      description: z.string(),
    }),
  ),
  resolution_info: z.string().nullable(),
  new_expenses: z.number().nullable(),
  summary: z.string().min(1),
});

const CarrierResponseSchema = z.object({
  offer_type: z
    .enum([
      'rebooking_offered',
      'rebooking_completed',
      'voucher_issued',
      'meal_voucher',
      'hotel_accommodation',
      'cash_compensation',
      'refund_offered',
      'no_response',
      'other',
    ])
    .nullable(),
  offer_amount: z.number().nullable(),
  offer_currency: z.string().nullable(),
  carrier_agent_name: z.string().nullable(),
  offer_expiry: z.string().nullable(),
  summary: z.string().min(1),
});

const EvidenceDescriptionSchema = z.object({
  evidence_category: z
    .enum([
      'receipt',
      'boarding_pass',
      'delay_notice',
      'carrier_confirmation',
      'expense',
      'screenshot',
      'email',
      'other',
    ])
    .nullable(),
  description: z.string().min(1),
  estimated_amount: z.number().nullable(),
  currency: z.string().nullable(),
  date_of_expense: z.string().nullable(),
});

const RouteSegmentSchema = z.object({
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  segment_type: z.enum(['flight', 'rail', 'sea', 'road', 'hotel', 'car']).nullable(),
  carrier: z.string().nullable(),
  depart_date: z.string().nullable(),
  arrive_date: z.string().nullable(),
  flight_number: z.string().nullable(),
  notes: z.string().nullable(),
  summary: z.string().min(1),
});

const SignalCategorizeSchema = z.object({
  places: z.array(z.string()),
  activities: z.array(z.string()),
  food_interests: z.array(z.string()),
  travel_style: z.string().nullable(),
  interests_other: z.array(z.string()),
  summary: z.string().min(1),
});

function getOutputSchema(contextType: ContextType): z.ZodType<unknown> {
  switch (contextType) {
    case 'signal_capture':
      return SignalCaptureSchema;
    case 'incident_create':
      return IncidentParseSchema;
    case 'incident_update':
      return IncidentUpdateSchema;
    case 'carrier_response':
      return CarrierResponseSchema;
    case 'evidence_description':
      return EvidenceDescriptionSchema;
    case 'route_segment':
      return RouteSegmentSchema;
    case 'signal_categorize':
      return SignalCategorizeSchema;
  }
}

function buildSystemPrompt(
  contextType: ContextType,
  roundNumber: number,
  accumulatedParts: unknown[],
): string {
  const priorContext = accumulatedParts?.length
    ? `Prior rounds captured: ${JSON.stringify(accumulatedParts)}\n\n`
    : '';

  if (contextType === 'signal_capture') {
    const roundNote =
      roundNumber === 3
        ? 'This is the FINAL round. Adopt a warm closing tone in wayfarer_response. Invite one last addition rather than implying more rounds are available.'
        : `This is round ${roundNumber} of 3.`;

    return `${priorContext}${roundNote}

You are parsing a traveler's onboarding narration to extract structured travel preferences.
Return ONLY valid JSON matching this exact schema. No markdown. No preamble. No explanation.

{
  "places": [],
  "my_thing": [],
  "food": [],
  "companions": [],
  "avoid": [],
  "venue_intents": [
    { "name": string, "context": string, "resolved": false }
  ],
  "pet_travel": boolean,
  "pet_type": string | null,
  "pet_destination_type": "domestic" | "international" | null,
  "catch_bucket": [],
  "ambiguity_question": string | null,
  "wayfarer_response": string
}

Rules:
- venue_intents: flag ONLY specific named places/events (e.g. "the Uffizi", "Coachella"). NOT generic types like "museums".
- catch_bucket: use for vague or uncategorizable signals. Never show as errors.
- ambiguity_question: maximum ONE question. Only ask if the ambiguity has high downstream value.
- wayfarer_response: warm, specific, references real things heard. If round 3, invite final addition.
- PROHIBITED: background API calls, web searches, external lookups of any kind.`;
  }

  if (contextType === 'incident_create') {
    return `${priorContext}You are parsing a traveler's incident narration. Extract structured disruption data.
Return ONLY valid JSON. No markdown. No preamble.

{
  "title": string | null,
  "description": string | null,
  "disruption_type": "delay"|"cancellation"|"missed_connection"|"denied_boarding"|"baggage"|"other"|null,
  "carrier": string | null,
  "flight_number": string | null,
  "origin": string | null,
  "destination": string | null,
  "disruption_time": string | null,
  "estimated_expenses": number | null,
  "currency": string | null,
  "causality_notes": string | null,
  "summary": string
}

Never predict coverage outcomes. Never say anything is covered or not covered.
Preserve causality ambiguity — if the traveler says "they said weather but I think it was crew",
note both in causality_notes exactly as stated.`;
  }

  if (contextType === 'incident_update') {
    return `${priorContext}You are parsing updates to an existing travel incident.
Return ONLY valid JSON. No markdown. No preamble.

{
  "additional_details": string | null,
  "timeline_events": [ { "time": string, "description": string } ],
  "resolution_info": string | null,
  "new_expenses": number | null,
  "summary": string
}

Do not state coverage outcomes or legal entitlements.`;
  }

  if (contextType === 'carrier_response') {
    return `${priorContext}You are parsing a traveler's description of what a carrier offered.
This data is used to generate precise legal narrative for claims — imprecise language can cause claim denial.
Return ONLY valid JSON. No markdown. No preamble.

{
  "offer_type": "rebooking_offered"|"rebooking_completed"|"voucher_issued"|"meal_voucher"|"hotel_accommodation"|"cash_compensation"|"refund_offered"|"no_response"|"other"|null,
  "offer_amount": number | null,
  "offer_currency": string | null,
  "carrier_agent_name": string | null,
  "offer_expiry": string | null,
  "summary": string
}

Be precise. "Declined" is not a structured offer type — if the traveler declined something,
capture what was offered (the offer_type) and note the declination in summary.`;
  }

  if (contextType === 'evidence_description') {
    return `${priorContext}You are parsing a traveler's description of evidence they want to capture.
Return ONLY valid JSON. No markdown. No preamble.

{
  "evidence_category": "receipt"|"boarding_pass"|"delay_notice"|"carrier_confirmation"|"expense"|"screenshot"|"email"|"other"|null,
  "description": string,
  "estimated_amount": number | null,
  "currency": string | null,
  "date_of_expense": string | null
}`;
  }

  if (contextType === 'route_segment') {
    return `${priorContext}You are parsing a travel route segment from traveler narration.
Return ONLY valid JSON. No markdown. No preamble.

{
  "origin": string | null,
  "destination": string | null,
  "segment_type": "flight"|"rail"|"sea"|"road"|"hotel"|"car"|null,
  "carrier": string | null,
  "depart_date": string | null,
  "arrive_date": string | null,
  "flight_number": string | null,
  "notes": string | null,
  "summary": string
}`;
  }

  if (contextType === 'signal_categorize') {
    return `${priorContext}The user message is a comma- or space-separated list of short tokens/chips from voice capture. Sort each into JSON arrays:
- places: capitalized place-like tokens
- activities: activities and experiences
- food_interests: food and dining
- travel_style: single string phrase if inferable, else null
- interests_other: leftovers
- summary: one short line summarizing the batch

Return ONLY valid JSON.`;
  }

  return `${priorContext}Parse the following narration and return structured JSON with at minimum a "summary" field. Return only valid JSON.`;
}

/** Map doctrine offer_type strings to `carrier_responses.action_type` values used in-app. */
function carrierOfferToActionType(offer: string | null): string {
  if (!offer) return 'no_response';
  const map: Record<string, string> = {
    meal_voucher: 'meal_voucher_issued',
    hotel_accommodation: 'hotel_accommodation_offered',
    cash_compensation: 'cash_compensation_offered',
  };
  return map[offer] ?? offer;
}

function parsedToLegacyFields(
  contextType: ContextType,
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  if (contextType === 'carrier_response') {
    const p = parsed as z.infer<typeof CarrierResponseSchema>;
    const action_type = carrierOfferToActionType(p.offer_type);
    return {
      action_type,
      action_label: p.summary,
      value_amount: p.offer_amount,
      carrier_name: p.carrier_agent_name,
      new_flight: null,
      new_departure: p.offer_expiry,
      notes:
        p.carrier_agent_name || p.offer_expiry
          ? `${p.summary}${p.carrier_agent_name ? ` · Agent: ${p.carrier_agent_name}` : ''}${p.offer_expiry ? ` · Expiry: ${p.offer_expiry}` : ''}`
          : p.summary,
      offer_type: p.offer_type,
      offer_amount: p.offer_amount,
      offer_currency: p.offer_currency,
    };
  }

  if (contextType === 'signal_capture') {
    const p = parsed as z.infer<typeof SignalCaptureSchema>;
    return {
      places: p.places,
      activities: p.my_thing,
      food_interests: p.food,
      food: p.food,
      travel_style: null,
      interests_other: [...p.companions, ...p.avoid, ...p.catch_bucket],
      venue_intents: p.venue_intents,
      pet_travel: p.pet_travel,
      pet_type: p.pet_type,
      pet_destination_type: p.pet_destination_type,
      catch_bucket: p.catch_bucket,
      ambiguity_question: p.ambiguity_question,
      wayfarer_response: p.wayfarer_response,
    };
  }
  return { ...parsed };
}

function isLegacyBody(body: unknown): body is Record<string, unknown> {
  if (!body || typeof body !== 'object') return false;
  const o = body as Record<string, unknown>;
  return typeof o.context === 'string' && o.context_type === undefined;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const legacy = isLegacyBody(body);
  let context_type: ContextType;
  let transcript: string;
  let round_number: number | undefined;
  let accumulated_parts: unknown[] | undefined;

  if (legacy) {
    const leg = LegacyBodySchema.safeParse(body);
    if (!leg.success) {
      return NextResponse.json(
        { ok: false, error: 'transcript and context required', details: leg.error.issues },
        { status: 400 },
      );
    }
    context_type = leg.data.context;
    transcript = leg.data.transcript.trim();
    round_number = undefined;
    accumulated_parts = undefined;
  } else {
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', details: parsed.error.issues },
        { status: 400 },
      );
    }
    ({ context_type, transcript, round_number, accumulated_parts } = parsed.data);
    transcript = transcript.trim();
  }

  if (context_type === 'signal_capture') {
    const r = round_number ?? 1;
    if (r > 3) {
      return legacy
        ? NextResponse.json({ ok: false, error: 'MAX_ROUNDS_EXCEEDED' }, { status: 400 })
        : NextResponse.json({ error: 'MAX_ROUNDS_EXCEEDED' }, { status: 400 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return legacy
      ? NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 })
      : NextResponse.json({ error: 'SERVER_MISCONFIGURED' }, { status: 500 });
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get: (name) => req.cookies.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const requiresAuth = context_type !== 'signal_capture' || legacy;
  if (requiresAuth && !user?.id) {
    return legacy
      ? NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
      : NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const ip = clientIpFromRequest(req);
  const rateKeyUser = user?.id ?? null;
  const limited = rateKeyUser
    ? userRateLimitedJsonResponse(rateKeyUser, 'voice-parse', 60, 15 * 60 * 1000)
    : rateLimitedJsonResponse(`voice-parse-signal:${ip}`, 60, 15 * 60 * 1000);
  if (limited) {
    if (legacy) {
      const retryAfter = limited.headers.get('Retry-After');
      return NextResponse.json(
        { ok: false, error: 'Too many requests' },
        {
          status: 429,
          ...(retryAfter ? { headers: { 'Retry-After': retryAfter } } : {}),
        },
      );
    }
    return limited;
  }

  if (!OPENROUTER_KEY) {
    if (legacy) {
      return NextResponse.json({
        ok: true,
        parsed: false,
        transcript_raw: transcript,
        fields: {},
        message: 'Voice parsing unavailable — please fill in the details manually.',
      });
    }
    return NextResponse.json({ error: 'MODEL_NOT_CONFIGURED' }, { status: 503 });
  }

  const model = context_type === 'signal_capture' ? ONBOARDING_MODEL : VOICE_MODEL;
  const roundForPrompt = context_type === 'signal_capture' ? (round_number ?? 1) : 1;
  const acc = accumulated_parts ?? [];

  const started = Date.now();
  const flaggedInput = detectPromptInjection(transcript);

  let openRouterRes: Response;
  try {
    openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': SITE_URL,
        'X-Title': 'Wayfarer Voice Parse',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(context_type, roundForPrompt, acc),
          },
          { role: 'user', content: transcript },
        ],
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        signal: AbortSignal.timeout(15000),
      }),
    });
  } catch (fetchErr) {
    const isTimeout = fetchErr instanceof Error && fetchErr.name === 'TimeoutError';
    if (legacy) {
      return NextResponse.json({
        ok: true,
        parsed: false,
        transcript_raw: transcript,
        fields: {},
        message: 'Could not parse transcript — please fill in the details manually.',
        parse_latency_ms: Date.now() - started,
      });
    }
    return NextResponse.json(
      { error: isTimeout ? 'MODEL_TIMEOUT' : 'MODEL_UNREACHABLE' },
      { status: 502 },
    );
  }

  if (!openRouterRes.ok) {
    const errText = await openRouterRes.text().catch(() => '');
    if (legacy) {
      return NextResponse.json({
        ok: true,
        parsed: false,
        transcript_raw: transcript,
        fields: {},
        message: 'Could not parse transcript — please fill in the details manually.',
        parse_latency_ms: Date.now() - started,
      });
    }
    return NextResponse.json(
      {
        error: 'MODEL_ERROR',
        status_code: openRouterRes.status,
        details: errText.slice(0, 200),
      },
      { status: 502 },
    );
  }

  const orData = (await openRouterRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: unknown;
    model?: string;
  };
  const rawContent: string = orData.choices?.[0]?.message?.content ?? '';

  let parsedOutput: unknown;
  try {
    const cleaned = rawContent
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    parsedOutput = JSON.parse(cleaned);
  } catch {
    if (legacy) {
      return NextResponse.json({
        ok: true,
        parsed: false,
        transcript_raw: transcript,
        fields: {},
        message: 'Could not parse transcript — please fill in the details manually.',
        parse_latency_ms: Date.now() - started,
      });
    }
    return NextResponse.json(
      { error: 'PARSE_FAILED', raw: rawContent.slice(0, 500) },
      { status: 422 },
    );
  }

  const outputSchema = getOutputSchema(context_type);
  const validation = outputSchema.safeParse(parsedOutput);
  if (!validation.success) {
    if (legacy) {
      return NextResponse.json({
        ok: true,
        parsed: false,
        transcript_raw: transcript,
        fields: {},
        message: 'Could not parse transcript — please fill in the details manually.',
        parse_latency_ms: Date.now() - started,
      });
    }
    return NextResponse.json(
      { error: 'PARSE_VALIDATION_FAILED', details: validation.error.issues, raw: parsedOutput },
      { status: 422 },
    );
  }

  const data = validation.data as Record<string, unknown>;
  const { inTok, outTok } = extractUsageTokens(orData.usage);
  const modelUsed = orData.model ?? model;

  if (user?.id) {
    await logAiInteraction({
      userId: user.id,
      interactionType: 'voice_parse',
      modelUsed,
      inputTokens: inTok ?? null,
      outputTokens: outTok ?? null,
      costUsd: estimateCostUsd(modelUsed, inTok, outTok),
      promptCategory: context_type,
      flagged: flaggedInput,
      flagReason: flaggedInput ? 'injection_attempt' : null,
    });
  }

  const latency = Date.now() - started;

  if (legacy) {
    const fields = parsedToLegacyFields(context_type, data);
    return NextResponse.json({
      ok: true,
      parsed: true,
      transcript_raw: transcript,
      fields,
      model_used: modelUsed,
      usage: orData.usage,
      parse_latency_ms: latency,
    });
  }

  return NextResponse.json({
    success: true,
    context_type,
    round_number: round_number ?? null,
    model_used: modelUsed,
    parsed: data,
    parse_latency_ms: latency,
  });
}
