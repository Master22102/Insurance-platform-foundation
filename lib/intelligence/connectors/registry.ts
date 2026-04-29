import { AxisProvider, AxisResult, ConnectorContext, IntelligenceAxis } from './types';

const internationalRegulatoryProvider: AxisProvider = {
  id: 'international_regulatory.corpus',
  axis: 'international_regulatory',
  enabled: true,
  async fetch(context: ConnectorContext): Promise<AxisResult> {
    try {
      const destinations =
        context.route_segments
          ?.map((s) => [s.destination, s.origin].filter(Boolean).join(' '))
          .filter(Boolean) ?? [];
      const destText = destinations.join(' ');
      const relevantDocs: string[] = [];
      const notes: string[] = [];

      const petTravel = (context.signal_profile as Record<string, unknown> | undefined)?.pet_travel;
      if (petTravel) {
        relevantDocs.push('CDC Dog Import Requirements', 'USDA APHIS Pet Travel Requirements');
        notes.push(
          'Pet travel noted — USDA APHIS and CDC dog import rules often apply to US-bound dogs; confirm your route.',
        );
      }

      if (destinations.some((d) => /japan|tokyo|osaka|nrt|kix/i.test(d))) {
        relevantDocs.push('Japan Animal Quarantine Service');
        notes.push('Japan on itinerary — AQS typically requires advance steps for pets; confirm notification timing on maff.go.jp.');
      }

      const euDest = destinations.some((d) =>
        /paris|amsterdam|berlin|madrid|rome|lisbon|cdg|ams|fra|mad|fco|manchester/i.test(d),
      );
      if (euDest) {
        relevantDocs.push('EU Regulation 261/2004', 'EU Pet Movement Rules');
        notes.push('EU-style destination detected — EU261-style passenger rights may apply on qualifying itineraries; pet movement has separate health rules.');
      }

      if (destinations.some((d) => /london|edinburgh|lhr|man|lgw/i.test(d))) {
        relevantDocs.push('UK CAA Passenger Rights');
        notes.push('UK destination — UK passenger rights framework may apply separately from EU261.');
      }

      if (relevantDocs.length === 0) {
        return {
          axis: 'international_regulatory',
          source: 'corpus',
          status: 'ok',
          summary: 'No specific international regulatory hints from this itinerary snapshot.',
          fetchedAt: new Date().toISOString(),
        };
      }

      return {
        axis: 'international_regulatory',
        source: 'corpus',
        status: 'ok',
        summary: notes.join(' '),
        details: { relevant_documents: relevantDocs, destination_sample: destText.slice(0, 500) },
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return {
        axis: 'international_regulatory',
        source: 'corpus-fallback',
        status: 'degraded',
        summary: 'Regulatory requirements could not be evaluated.',
        fetchedAt: new Date().toISOString(),
      };
    }
  },
};

const culturalLegalProvider: AxisProvider = {
  id: 'cultural_legal.corpus+web',
  axis: 'cultural_legal',
  enabled: true,
  async fetch(context: ConnectorContext): Promise<AxisResult> {
    const { detectHighStakesTopics, augmentWithWebSearch } = await import('../corpus-search-augment');
    const openRouterKey = process.env.OPENROUTER_API_KEY ?? '';

    const petTravel = (context.signal_profile as Record<string, unknown> | undefined)?.pet_travel;
    const destBlob = [
      ...(context.locations ?? []),
      ...(context.route_segments?.map((s) => [s.destination, s.origin].filter(Boolean).join(' ')) ?? []),
    ].join(' ');

    const notes: string[] = [];
    const augments: string[] = [];

    if (petTravel) {
      const topics = detectHighStakesTopics(`pet ${destBlob}`);
      for (const topic of topics.slice(0, 2)) {
        if (openRouterKey) {
          const result = await augmentWithWebSearch(
            { query: topic.query, corpus_doc: topic.corpus_doc },
            openRouterKey,
          );
          if (result.web_summary) {
            augments.push(`[Web, ${result.freshness_note}] ${result.web_summary}`);
          }
        }
        if (topic.corpus_doc) {
          notes.push(`Corpus baseline: ${topic.corpus_doc} is in the document library for verified rules.`);
        }
      }
    }

    const summary = [
      ...notes,
      ...augments,
      augments.length === 0 && notes.length === 0
        ? 'No specific cultural or legal add-ons detected for this itinerary snapshot.'
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      axis: 'cultural_legal',
      source: 'corpus+web',
      status: 'ok',
      summary,
      details: { web_augment_count: augments.length },
      fetchedAt: new Date().toISOString(),
    };
  },
};

function staticFallbackProvider(axis: IntelligenceAxis, source: string): AxisProvider {
  return {
    id: `${axis}.fallback`,
    axis,
    enabled: true,
    async fetch(): Promise<AxisResult> {
      return {
        axis,
        source,
        status: 'degraded',
        summary: 'Provider not configured yet. Fallback guidance shown.',
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}

/** Axis 5 — experiential only; aligned with `docs/DEEP_SCAN_AXIS_DOCTRINE.md` §2 / §2a. */
const hiddenOpportunityFallbackProvider: AxisProvider = {
  id: 'hidden_opportunity.fallback',
  axis: 'hidden_opportunity',
  enabled: true,
  async fetch(): Promise<AxisResult> {
    return {
      axis: 'hidden_opportunity',
      source: 'internal-fallback',
      status: 'degraded',
      summary:
        'Experiential intelligence (astronomy, nature, local culture, season at destination) is not connected yet. This is not policy benefits, reimbursements, or coverage — see coverage signals and Coverage vs itinerary match.',
      fetchedAt: new Date().toISOString(),
    };
  },
};

const providers: Record<IntelligenceAxis, AxisProvider> = {
  transit_reliability: staticFallbackProvider('transit_reliability', 'internal-fallback'),
  coverage_itinerary_match: staticFallbackProvider('coverage_itinerary_match', 'internal-fallback'),
  regional_risk: staticFallbackProvider('regional_risk', 'internal-fallback'),
  hyperlocal_weather: staticFallbackProvider('hyperlocal_weather', 'internal-fallback'),
  hidden_opportunity: hiddenOpportunityFallbackProvider,
  local_signals: staticFallbackProvider('local_signals', 'internal-fallback'),
  disruption_probability: staticFallbackProvider('disruption_probability', 'internal-fallback'),
  transport_practice: staticFallbackProvider('transport_practice', 'internal-fallback'),
  cultural_legal: culturalLegalProvider,
  financial_currency: staticFallbackProvider('financial_currency', 'internal-fallback'),
  international_regulatory: internationalRegulatoryProvider,
  authority_disruption: staticFallbackProvider('authority_disruption', 'internal-fallback'),
};

export function registerAxisProvider(provider: AxisProvider) {
  providers[provider.axis] = provider;
}

export function getAxisProvider(axis: IntelligenceAxis): AxisProvider {
  return providers[axis];
}

export function selectAxesForContext(context: ConnectorContext): IntelligenceAxis[] {
  // Deep-scan axis gating: 1-8 always, 9-10 international, 11 signal-triggered.
  const base: IntelligenceAxis[] = [
    'transit_reliability',
    'coverage_itinerary_match',
    'regional_risk',
    'hyperlocal_weather',
    'hidden_opportunity',
    'local_signals',
    'disruption_probability',
    'transport_practice',
    'cultural_legal',
  ];
  if (context.isInternational) {
    base.push('financial_currency', 'international_regulatory');
  } else if (context.signal_profile?.pet_travel === true) {
    base.push('international_regulatory');
  }
  if (context.hasAuthoritySignal) {
    base.push('authority_disruption');
  }
  return base;
}

export async function runAxisConnectors(context: ConnectorContext): Promise<AxisResult[]> {
  const axes = selectAxesForContext(context);
  const results = await Promise.all(axes.map(async (axis) => {
    const provider = getAxisProvider(axis);
    if (!provider.enabled) {
      return {
        axis,
        source: provider.id,
        status: 'unavailable' as const,
        summary: 'Provider disabled.',
        fetchedAt: new Date().toISOString(),
      };
    }
    try {
      return await provider.fetch(context);
    } catch {
      return {
        axis,
        source: provider.id,
        status: 'degraded' as const,
        summary: 'Provider failed. Fallback behavior applied.',
        fetchedAt: new Date().toISOString(),
      };
    }
  }));
  return results;
}

