import type { ClaimSummaryClipboardInput } from './types';

export function formatClaimSummaryText(data: ClaimSummaryClipboardInput): string {
  const ref = (data.packetId || '').replace(/-/g, '').slice(0, 8).toUpperCase();
  const evLines =
    data.evidence.length > 0
      ? data.evidence.map((e) => `• ${e.name} (${e.category})`).join('\n')
      : '• (none listed)';
  const steps =
    data.sequenceSteps.length > 0
      ? data.sequenceSteps.map((s, i) => `${i + 1}. ${s.action}${s.note ? ` — ${s.note}` : ''}`).join('\n')
      : '1. Follow your provider’s instructions and retain confirmations.';

  const align =
    data.alignmentCategory || data.alignmentConfidence
      ? `\nAlignment mapping: ${data.alignmentCategory || '—'} (confidence: ${data.alignmentConfidence || '—'})`
      : '';

  return `
WAYFARER — Claim Preparation Summary
Wayfarer Reference: WFR-${ref}

Trip: ${data.tripName}
Dates: ${data.departureDate} – ${data.returnDate}

Incident: ${data.incidentTitle}
Type: ${data.disruptionType}
Date: ${data.incidentDate}

Coverage information (reference only): ${data.matchedBenefitType}
Filing target recorded: ${data.primaryProvider}${align}

Evidence collected:
${evLines}

Recommended filing sequence (decision-support):
${steps}

This summary was prepared by Wayfarer as a decision-support tool.
It does not constitute a claim submission, legal advice, or a guarantee of coverage or reimbursement.
Coverage determinations are made solely by the applicable insurance provider or card issuer.
  `.trim();
}
