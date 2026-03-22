import { AxisProvider, AxisResult, ConnectorContext, IntelligenceAxis } from './types';

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

const providers: Record<IntelligenceAxis, AxisProvider> = {
  transit_reliability: staticFallbackProvider('transit_reliability', 'internal-fallback'),
  coverage_itinerary_match: staticFallbackProvider('coverage_itinerary_match', 'internal-fallback'),
  regional_risk: staticFallbackProvider('regional_risk', 'internal-fallback'),
  hyperlocal_weather: staticFallbackProvider('hyperlocal_weather', 'internal-fallback'),
  hidden_opportunity: staticFallbackProvider('hidden_opportunity', 'internal-fallback'),
  local_signals: staticFallbackProvider('local_signals', 'internal-fallback'),
  disruption_probability: staticFallbackProvider('disruption_probability', 'internal-fallback'),
  transport_practice: staticFallbackProvider('transport_practice', 'internal-fallback'),
  cultural_legal: staticFallbackProvider('cultural_legal', 'internal-fallback'),
  financial_currency: staticFallbackProvider('financial_currency', 'internal-fallback'),
  international_regulatory: staticFallbackProvider('international_regulatory', 'internal-fallback'),
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

