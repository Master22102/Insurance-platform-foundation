import { AxisProvider, AxisResult, ConnectorContext } from '../types';

function countSignals(signals: Array<{ type?: string }> | undefined, t: string) {
  if (!signals?.length) return 0;
  return signals.filter((s) => String(s.type || '').toLowerCase() === t).length;
}

/** Summarizes server deep-scan output (policies vs itinerary) as a first-class axis. */
export const coverageItineraryMatchProvider: AxisProvider = {
  id: 'coverage-itinerary-match',
  axis: 'coverage_itinerary_match',
  enabled: true,
  async fetch(ctx: ConnectorContext): Promise<AxisResult> {
    const snap = ctx.deepScanSnapshot;
    const policiesAnalyzed = snap?.policiesAnalyzed;
    const signals = snap?.signals;

    if (policiesAnalyzed === undefined && !signals?.length) {
      return {
        axis: 'coverage_itinerary_match',
        source: 'deep-scan-pending',
        status: 'degraded',
        summary:
          'Coverage-to-itinerary alignment appears after a completed Deep Scan with trip and policy context.',
        fetchedAt: new Date().toISOString(),
      };
    }

    const pa = typeof policiesAnalyzed === 'number' ? policiesAnalyzed : 0;
    const gaps = countSignals(signals, 'gap');
    const risks = countSignals(signals, 'risk');
    const positives = countSignals(signals, 'positive');

    if (pa === 0) {
      return {
        axis: 'coverage_itinerary_match',
        source: 'scan_results',
        status: 'degraded',
        summary:
          'No policies were analyzed against this itinerary in the last scan. Attach policies and run Deep Scan.',
        details: { policiesAnalyzed: pa, gapCount: gaps, riskCount: risks, positiveCount: positives },
        fetchedAt: new Date().toISOString(),
      };
    }

    return {
      axis: 'coverage_itinerary_match',
      source: 'scan_results',
      status: 'ok',
      summary: `Cross-reference: ${pa} polic${pa === 1 ? 'y' : 'ies'} vs itinerary — ${gaps} gap signal(s), ${risks} risk(s), ${positives} confirmed coverage signal(s).`,
      details: { policiesAnalyzed: pa, gapCount: gaps, riskCount: risks, positiveCount: positives },
      fetchedAt: new Date().toISOString(),
    };
  },
};
