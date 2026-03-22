import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ClaimPacketPdfData, RouteSegmentRow } from './types';

const colors = {
  navy: '#1e3a5f',
  body: '#374151',
  muted: '#6b7280',
  line: '#e5e7eb',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: colors.body,
  },
  brand: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.navy,
    letterSpacing: 1.2,
  },
  subbrand: {
    fontSize: 9,
    color: colors.muted,
    marginTop: 2,
    marginBottom: 14,
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.navy,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginVertical: 10,
  },
  metaRow: { marginBottom: 3, fontSize: 9 },
  metaKey: { color: colors.muted },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.navy,
    marginTop: 12,
    marginBottom: 6,
  },
  bodyText: { lineHeight: 1.45, marginBottom: 4, fontSize: 9 },
  bullet: { marginLeft: 10, marginBottom: 3, fontSize: 9, lineHeight: 1.4 },
  cite: { fontSize: 8, color: colors.muted, marginLeft: 10, marginBottom: 6 },
  watermarkWrap: {
    position: 'absolute',
    top: '32%',
    left: '12%',
    opacity: 0.07,
  },
  watermarkText: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#000000',
    transform: 'rotate(-35deg)',
  },
  disclaimerBox: {
    marginTop: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#f9fafb',
  },
  disclaimerTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.navy,
    marginBottom: 4,
  },
  disclaimerText: { fontSize: 8, lineHeight: 1.45, color: colors.body },
  footer: { marginTop: 8, fontSize: 8, color: colors.muted },
});

function SegmentBlock({ seg }: { seg: RouteSegmentRow }) {
  const notes = seg.notes || '';
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.bodyText}>
        {(seg.origin || '—').toUpperCase()} → {(seg.destination || '—').toUpperCase()}
      </Text>
      <Text style={styles.bodyText}>Segment type: {seg.segment_type || '—'}</Text>
      <Text style={styles.bodyText}>
        Carrier / operator (if captured in notes): {notes ? notes.split('\n')[0] : 'Not captured in Wayfarer for this segment'}
      </Text>
      <Text style={styles.bodyText}>Scheduled departure: {seg.depart_at ? seg.depart_at : '—'}</Text>
      <Text style={styles.bodyText}>Booking reference (if on file): {seg.reference || '—'}</Text>
    </View>
  );
}

export function ClaimPacketDocument({ data }: { data: ClaimPacketPdfData }) {
  const showDraft = data.packetStatus === 'draft';
  const prepared = new Date(data.preparedAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {showDraft && (
          <View style={styles.watermarkWrap} fixed>
            <Text style={styles.watermarkText}>DRAFT</Text>
          </View>
        )}

        <Text style={styles.brand}>WAYFARER</Text>
        <Text style={styles.subbrand}>Travel Protection Intelligence</Text>

        <Text style={styles.title}>Claim preparation packet</Text>

        <View style={styles.metaRow}>
          <Text>
            <Text style={styles.metaKey}>Wayfarer Reference: </Text>WFR-{data.wayfarerRefShort}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text>
            <Text style={styles.metaKey}>Prepared: </Text>
            {prepared}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text>
            <Text style={styles.metaKey}>Packet version: </Text>
            {data.packetVersion}
          </Text>
        </View>

        <View style={styles.hr} />

        <Text style={styles.sectionTitle}>§ Trip summary</Text>
        <Text style={styles.bodyText}>Trip: {data.tripName}</Text>
        <Text style={styles.bodyText}>Destination: {data.destinationSummary}</Text>
        <Text style={styles.bodyText}>
          Travel dates: {data.departureDate} – {data.returnDate}
        </Text>

        <Text style={styles.sectionTitle}>§ Affected travel segment(s)</Text>
        <Text style={[styles.bodyText, { color: colors.muted, marginBottom: 6 }]}>
          Only segment(s) associated with this incident are listed (not necessarily your full itinerary).
        </Text>
        {data.affectedSegments.length === 0 ? (
          <Text style={styles.bodyText}>No route segments on file for this trip.</Text>
        ) : (
          data.affectedSegments.map((seg, i) => <SegmentBlock key={seg.segment_id || String(i)} seg={seg} />)
        )}

        <Text style={styles.sectionTitle}>§ Incident details</Text>
        <Text style={styles.bodyText}>Title: {data.incidentTitle}</Text>
        <Text style={styles.bodyText}>Disruption type (on record): {data.disruptionType}</Text>
        <Text style={styles.bodyText}>Key date (on record): {data.incidentDateLabel}</Text>
        {data.incidentDescription ? (
          <Text style={styles.bodyText}>Description: {data.incidentDescription}</Text>
        ) : null}
        {data.travelerRecordedNotes ? (
          <Text style={styles.bodyText}>Traveler-recorded notes: {data.travelerRecordedNotes}</Text>
        ) : null}

        <Text style={styles.sectionTitle}>§ Coverage analysis (reference only)</Text>
        <Text style={styles.bodyText}>Primary policy provider on trip (if on file): {data.primaryProvider}</Text>
        <Text style={styles.bodyText}>Benefit type (routing reference): {data.matchedBenefitType}</Text>
        <Text style={styles.bodyText}>Structural alignment category: {data.alignmentCategory}</Text>
        <Text style={styles.bodyText}>Model confidence label: {data.alignmentConfidence}</Text>
        {data.coverageLimitSummary ? (
          <Text style={styles.bodyText}>Limit excerpt (policy text on file): {data.coverageLimitSummary}</Text>
        ) : null}

        <Text style={[styles.bodyText, { marginTop: 6, fontStyle: 'italic', color: colors.muted }]}>
          This section summarizes on-file policy language references. It is not a coverage determination.
        </Text>

        <Text style={styles.sectionTitle}>Relevant coverage rules (on file)</Text>
        {data.clauses.length === 0 ? (
          <Text style={styles.bodyText}>No auto-accepted clause rows matched this routing reference.</Text>
        ) : (
          data.clauses.map((c, idx) => (
            <View key={idx} wrap={false}>
              <Text style={styles.bullet}>
                • ({c.clause_type}) {c.canonical_text}
              </Text>
              <Text style={styles.cite}>Source: {c.source_citation}</Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>§ Evidence inventory</Text>
        <Text style={[styles.bodyText, { color: colors.muted, marginBottom: 4 }]}>
          Itemized receipts are typically primary documentation for adjusters; card statements alone are often insufficient.
        </Text>
        {data.evidence.length === 0 ? (
          <Text style={styles.bodyText}>No evidence items are attached in Wayfarer for this incident.</Text>
        ) : (
          data.evidence.map((e) => (
            <Text key={e.id} style={styles.bullet}>
              ☑ {e.name} ({e.evidence_category || 'general'}) — validation: {e.validation_status || 'pending'}
            </Text>
          ))
        )}
        {data.missingEvidenceLabels.map((label, i) => (
          <Text key={`m-${i}`} style={styles.bullet}>
            ☐ {label} (commonly requested — confirm against your provider’s checklist)
          </Text>
        ))}

        <Text style={styles.sectionTitle}>§ Recommended filing sequence</Text>
        {data.sequenceSteps.length === 0 ? (
          <Text style={styles.bodyText}>No sequenced steps on file.</Text>
        ) : (
          data.sequenceSteps.map((s, i) => (
            <Text key={i} style={styles.bullet}>
              {s.step ?? i + 1}. {s.action || 'Step'}
              {s.note ? ` — ${s.note}` : ''}
            </Text>
          ))
        )}

        {data.carrierResponses.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>§ Carrier-recorded actions</Text>
            <Text style={[styles.bodyText, { color: colors.muted, marginBottom: 6 }]}>
              Factual entries from the traveler. Wording avoids interpreting carrier intent beyond what was recorded.
            </Text>
            {data.carrierResponses.map((cr, i) => (
              <Text key={i} style={styles.bullet}>
                • {cr.action_label} ({String(cr.action_type || '').replace(/_/g, ' ')})
                {cr.value_amount != null ? ` — ${cr.currency_code || 'USD'} ${cr.value_amount}` : ''}
                {cr.carrier_ref ? ` — ref ${cr.carrier_ref}` : ''}
              </Text>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>§ Timeline of events (on record)</Text>
        <Text style={[styles.bodyText, { color: colors.muted, marginBottom: 6 }]}>
          Includes carrier actions and incident milestones where dated.
        </Text>
        {data.timeline.map((t, i) => (
          <Text key={i} style={styles.bullet}>
            {t.dateLabel} — {t.description}
          </Text>
        ))}

        <View style={styles.hr} />

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerTitle}>Disclaimer</Text>
          <Text style={styles.disclaimerText}>
            This packet is a decision-support tool prepared by Wayfarer. It does not constitute a claim submission, legal
            advice, or guarantee of coverage or reimbursement. Coverage determinations are made solely by the applicable
            insurance provider or card issuer.
          </Text>
        </View>

        <Text style={styles.footer}>
          Wayfarer Reference: WFR-{data.wayfarerRefShort} · Generated {prepared}
        </Text>
      </Page>
    </Document>
  );
}
