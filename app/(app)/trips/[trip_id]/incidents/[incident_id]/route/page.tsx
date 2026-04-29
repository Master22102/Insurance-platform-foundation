'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AppPageRoot from '@/components/layout/AppPageRoot';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';
import { deriveDecisionGuidance, postureLabel } from '@/lib/decision-language';
import InterpretiveBoundaryNotice from '@/components/InterpretiveBoundaryNotice';
import CoverageMapStatusBanner from '@/components/CoverageMapStatusBanner';
import {
  computeCoverageGraphWithIntelligence,
  normalizeGuidanceSteps,
  routeClaimForIncident,
} from '@/lib/pipeline/coverage-and-routing';
import { formatClaimSummaryText } from '@/lib/claim-packet/format-text-summary';
import { PACKET_VERSION_REGENERATION_BLOCKED_MIN } from '@/lib/claim-packet/constants';

const RECIPIENT_TYPES = [
  { value: 'travel_insurer', label: 'Travel insurance provider' },
  { value: 'credit_card', label: 'Credit card benefit' },
  { value: 'airline', label: 'Airline / carrier' },
  { value: 'home_or_renter', label: 'Home / renter policy' },
  { value: 'hotel', label: 'Hotel / accommodation' },
  { value: 'car_rental', label: 'Car rental company' },
  { value: 'other', label: 'Other' },
];

const ACCEPTANCE_OPTIONS = [
  { value: 'none', label: 'No, nothing accepted yet' },
  { value: 'refund', label: 'Refund accepted' },
  { value: 'rebooking', label: 'Rebooking accepted' },
  { value: 'voucher', label: 'Voucher accepted' },
  { value: 'credit', label: 'Credit accepted' },
  { value: 'partial_comp', label: 'Partial/goodwill compensation accepted' },
];

const CAUSE_OPTIONS = [
  { value: 'airline_clear', label: 'Clear airline responsibility' },
  { value: 'shared_or_ambiguous', label: 'Shared or ambiguous cause' },
  { value: 'external_or_systemic', label: 'External or systemic cause' },
  { value: 'user_or_itinerary', label: 'Traveler or booking factors' },
];

export default function ClaimRoutingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params?.trip_id as string;
  const incidentId = params?.incident_id as string;

  const [incident, setIncident] = useState<any>(null);
  const [policies, setPolicies] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [recipientType, setRecipientType] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimCurrency, setClaimCurrency] = useState('USD');
  const [notes, setNotes] = useState('');
  const [acceptedCompensation, setAcceptedCompensation] = useState('none');
  const [causeClassification, setCauseClassification] = useState('');
  const [arrangeOwnNow, setArrangeOwnNow] = useState<'yes' | 'no' | 'undecided'>('undecided');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [preLockOpen, setPreLockOpen] = useState(false);
  const [submitKey] = useState(() => `claim-route-${incidentId}-${Date.now()}`);
  const [packetId, setPacketId] = useState<string | null>(null);
  const [engineGuidance, setEngineGuidance] = useState<Array<{ step?: number; action?: string; note?: string }>>([]);
  const [routingAlignment, setRoutingAlignment] = useState<string | null>(null);
  const [trip, setTrip] = useState<{
    trip_name?: string | null;
    destination_summary?: string | null;
    departure_date?: string | null;
    return_date?: string | null;
  } | null>(null);
  const [routeSummary, setRouteSummary] = useState<{
    matchedBenefitType?: string | null;
    alignmentCategory?: string | null;
    alignmentConfidence?: string | null;
    primaryProvider?: string | null;
  } | null>(null);
  const [packetMeta, setPacketMeta] = useState<{
    packet_version: number;
    packet_status: string;
    created_at: string;
  } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [carrierResponses, setCarrierResponses] = useState<any[]>([]);

  const amountNum = Number(claimAmount || 0);
  const smallClaimWarningTriggered =
    amountNum > 0 &&
    amountNum <= 300 &&
    ['travel_insurer', 'home_or_renter'].includes(recipientType);

  const decisionGuidance = deriveDecisionGuidance({
    acceptedCompensation,
    causeClassification,
    recipientType,
    amount: amountNum,
  });
  const guidancePosture = decisionGuidance.posture;
  const sequenceNotes = [...decisionGuidance.sequencing_notes];
  if (recipientType === 'credit_card') {
    sequenceNotes.unshift('Credit-card benefits are often evaluated before secondary travel-insurance reimbursement.');
  }
  if (arrangeOwnNow === 'yes') {
    sequenceNotes.push('Self-arranged transport can still be valid, but keep itemized receipts and disruption proof.');
  }

  useEffect(() => {
    if (!incidentId) return;
    if (!user) {
      setLoading(true);
      return;
    }
    Promise.all([
      supabase.from('incidents').select('*').eq('id', incidentId).maybeSingle(),
      supabase
        .from('trips')
        .select('trip_name, destination_summary, departure_date, return_date')
        .eq('trip_id', tripId)
        .maybeSingle(),
      supabase.from('policies').select('policy_id, policy_label, provider_name').eq('trip_id', tripId),
      supabase.from('evidence').select('*').eq('incident_id', incidentId).order('created_at', { ascending: false }),
      supabase.from('carrier_responses').select('*').eq('incident_id', incidentId).order('created_at', { ascending: true }),
    ]).then(([incRes, tripRes, polRes, evRes, carrierRes]) => {
      if (!incRes.data || incRes.data.canonical_status !== 'CLAIM_ROUTING_READY') {
        setLoading(false);
        router.replace(`/trips/${tripId}/incidents/${incidentId}`);
        return;
      }
      setIncident(incRes.data);
      setTrip(tripRes.data || null);
      setPolicies(polRes.data || []);
      setEvidence(evRes.data || []);
      setCarrierResponses(!carrierRes.error && carrierRes.data ? carrierRes.data : []);
      setLoading(false);
    }).catch((err) => { console.error("[fetch] error:", err); setLoading(false); });
  }, [user, incidentId, tripId, router]);

  useEffect(() => {
    if (!submitted || !packetId) return;
    supabase
      .from('claim_packets')
      .select('packet_version, packet_status, created_at')
      .eq('packet_id', packetId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPacketMeta({
            packet_version: Number(data.packet_version) || 1,
            packet_status: String(data.packet_status || ''),
            created_at: String(data.created_at || ''),
          });
        }
      });
  }, [submitted, packetId]);

  const regenBlocked =
    packetMeta != null && packetMeta.packet_version >= PACKET_VERSION_REGENERATION_BLOCKED_MIN;

  const handleCopyClaimSummary = async () => {
    if (!packetId) return;
    const incidentDate =
      incident?.disruption_start_at
        ? new Date(incident.disruption_start_at).toLocaleDateString()
        : incident?.created_at
          ? new Date(incident.created_at).toLocaleDateString()
          : '—';
    const text = formatClaimSummaryText({
      packetId,
      tripName: trip?.trip_name || 'Trip',
      departureDate: trip?.departure_date ? String(trip.departure_date) : '—',
      returnDate: trip?.return_date ? String(trip.return_date) : '—',
      incidentTitle: incident?.title || 'Incident',
      disruptionType: String(incident?.disruption_type || incident?.metadata?.disruption_type || '—'),
      incidentDate,
      matchedBenefitType: String(routeSummary?.matchedBenefitType || '—'),
      primaryProvider: String(routeSummary?.primaryProvider || '—'),
      alignmentCategory: routeSummary?.alignmentCategory ? String(routeSummary.alignmentCategory) : undefined,
      alignmentConfidence: routeSummary?.alignmentConfidence ? String(routeSummary.alignmentConfidence) : undefined,
      evidence: evidence.map((e: { name: string; evidence_category?: string }) => ({
        name: e.name,
        category: e.evidence_category || 'general',
      })),
      sequenceSteps: engineGuidance.map((g) => ({
        action: g.action || 'Step',
        note: g.note,
      })),
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback('Copied to clipboard');
      setTimeout(() => setCopyFeedback(''), 2500);
    } catch {
      setCopyFeedback('Could not copy — select and copy manually');
      setTimeout(() => setCopyFeedback(''), 3500);
    }
  };

  const handleSubmit = async () => {
    if (!recipientType || !recipientName.trim()) {
      setError('Please fill in the claim recipient type and name.');
      return;
    }
    if (!causeClassification) {
      setError('Please choose a cause classification before routing.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      /* 1) Coverage graph (idempotent / cached in DB) — required for route_claim. */
      const graphRes = await computeCoverageGraphWithIntelligence(supabase, tripId, user!.id);
      if (!graphRes.ok) {
        const m = graphRes.message;
        if (m === 'UNAUTHORIZED' || m === 'TRIP_NOT_FOUND') {
          throw new Error('We could not verify this trip for coverage routing.');
        }
        throw new Error(
          `Coverage map could not be built (${m}). Ensure this trip has active policies with auto-accepted clauses, then try again.`,
        );
      }

      /* 2) Routing engine — writes claim_routing_decisions, may advance trip maturity. */
      const routeRes = await routeClaimForIncident(
        supabase,
        incidentId,
        user!.id,
        `${submitKey}-route`,
      );
      if (!routeRes.ok) {
        throw new Error(routeRes.message);
      }

      const routeData = routeRes.data;
      const metadata = {
        ...(incident?.metadata && typeof incident.metadata === 'object' ? incident.metadata : {}),
        acceptance_checkpoint: {
          accepted_compensation: acceptedCompensation,
          arrange_own_now: arrangeOwnNow,
        },
        cause_classification: causeClassification,
        small_claim_warning_triggered: smallClaimWarningTriggered,
        small_claim_warning_threshold: 300,
        decision_guidance: decisionGuidance,
        claim_routing_engine: {
          routing_id: routeData.routing_id,
          alignment_category: routeData.alignment_category,
          matched_benefit_type: routeData.matched_benefit_type,
          alignment_confidence: routeData.alignment_confidence,
          guidance_steps: routeData.guidance_steps,
          coverage_graph_status: graphRes.data.status,
          snapshot_id: graphRes.data.snapshot_id,
        },
      };

      const { error: metadataErr } = await supabase
        .from('incidents')
        .update({ metadata })
        .eq('id', incidentId)
        .eq('trip_id', tripId);
      if (metadataErr) {
        throw new Error('We could not save your routing details right now.');
      }

      if (claimAmount) {
        const { data: evidenceResult, error: evidenceErr } = await supabase.rpc('register_evidence', {
          p_incident_id: incidentId,
          p_type: 'other',
          p_name: `Claim record for ${recipientName}`,
          p_description: `Recipient: ${recipientName} (${recipientType}). Amount: ${claimAmount} ${claimCurrency}. Accepted compensation: ${acceptedCompensation}. Cause: ${causeClassification}. Arrange own transport now: ${arrangeOwnNow}. ${notes}`.trim(),
          p_metadata: { category: 'claim_submission_record' },
          p_actor_id: user!.id,
          p_idempotency_key: `${submitKey}-record`,
        });
        if (evidenceErr || !evidenceResult?.success) {
          throw new Error('We could not save the submission record right now.');
        }
      }

      /* Packet must be created while incident is still CLAIM_ROUTING_READY (DB guard in pass14). */
      const { data: packetResult, error: packetErr } = await supabase.rpc('create_claim_packet_from_incident', {
        p_incident_id: incidentId,
        p_actor_id: user!.id,
        p_idempotency_key: `${submitKey}-packet`,
      });
      if (packetErr || !packetResult?.success) {
        throw new Error('We could not assemble your claim packet right now. Nothing was submitted yet.');
      }
      setPacketId(packetResult.packet_id || null);
      setRouteSummary({
        matchedBenefitType: routeData.matched_benefit_type,
        alignmentCategory: routeData.alignment_category,
        alignmentConfidence: routeData.alignment_confidence,
        primaryProvider: recipientName.trim(),
      });

      const { data: statusResult, error: statusErr } = await supabase.rpc('change_incident_status', {
        p_incident_id: incidentId,
        p_new_status: 'SUBMITTED',
        p_actor_id: user!.id,
        p_reason_code: 'claim_routed',
      });
      if (statusErr || !statusResult?.success) {
        throw new Error('We could not submit this routing step right now.');
      }

      setEngineGuidance(normalizeGuidanceSteps(routeData.guidance_steps));
      setRoutingAlignment(routeData.alignment_category ? String(routeData.alignment_category) : null);
      setSubmitted(true);
    } catch (submitErr) {
      setError(
        submitErr instanceof Error
          ? submitErr.message
          : 'We could not save this right now. Your incident details are still in place. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppPageRoot>
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <div style={{
            width: 28, height: 28, border: '2.5px solid #e5e5e5',
            borderTopColor: '#1A2B4A', borderRadius: '50%',
            margin: '0 auto', animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </AppPageRoot>
    );
  }

  if (!incident) return null;

  if (submitted) {
    const wayfarerRef = packetId
      ? `WFR-${packetId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
      : null;
    const nEvidence = evidence.length;
    const evidenceRegenHint =
      nEvidence >= 4
        ? 'You have several evidence items on file. If you add more documentation later, consider preparing an updated packet before filing (when regeneration is available).'
        : nEvidence >= 2 && nEvidence <= 3
          ? 'Multiple evidence files can often be submitted as a supplemental packet with your carrier—confirm their preferred channel.'
          : nEvidence === 1
            ? 'A single file is often easiest to submit by email; confirm your provider’s intake method.'
            : null;

    return (
      <AppPageRoot>
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 640 }}>
        <div style={{
          background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 16,
          padding: '40px 28px', textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#f0fdf4', border: '1.5px solid #bbf7d0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 8px', letterSpacing: '-0.3px' }}>
            Claim packet prepared
          </h2>
          <div
            style={{
              textAlign: 'left',
              margin: '0 auto 18px',
              maxWidth: 520,
              padding: '14px 16px',
              borderRadius: 12,
              border: '1px solid #c7d2fe',
              background: '#eef2ff',
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 800, color: '#312e81', margin: '0 0 10px', letterSpacing: '0.04em' }}>
              FILING COACH · WHAT TO DO NOW
            </p>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#3730a3', lineHeight: 1.55 }}>
              <li style={{ marginBottom: 8 }}>
                <strong>File with the recipient you named</strong> ({recipientName || 'your carrier or benefit provider'}) using{' '}
                <em>their</em> portal, app, email, or phone line — Wayfarer does not submit on your behalf.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Attach or upload your packet</strong> when they ask for documentation. Use &quot;Download PDF&quot; below, or
                &quot;Copy claim summary&quot; if you are pasting into a form or email.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Include anything else they require</strong> (receipts, boarding passes, carrier notices). Your checklist on this
                page mirrors what Wayfarer has on file — it may not match every carrier&apos;s full list.
              </li>
              <li style={{ marginBottom: 0 }}>
                <strong>Keep records and follow up</strong>: save confirmation numbers, who you spoke with, and dates. If a policy gives a
                response window, note it — this is general organization guidance, not a legal deadline for your situation.
              </li>
            </ol>
          </div>
          <p style={{ fontSize: 14, color: '#666', margin: '0 0 6px', lineHeight: 1.6 }}>
            Saved in your incident record for <strong>{recipientName}</strong>. No claim was sent automatically.
          </p>
          {wayfarerRef && (
            <p style={{ fontSize: 13, color: '#334155', margin: '0 0 4px', fontWeight: 600 }}>
              Wayfarer Reference: {wayfarerRef}
            </p>
          )}
          {packetMeta && (
            <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 14px' }}>
              Packet version {packetMeta.packet_version} · Status {packetMeta.packet_status}
            </p>
          )}

          {regenBlocked && (
            <div style={{
              textAlign: 'left', margin: '0 auto 16px', maxWidth: 520, padding: '10px 12px',
              background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: 12, color: '#92400e',
            }}>
              You&apos;ve reached the maximum number of packet regenerations for this claim. You can still download your
              most recent packet.
            </div>
          )}

          <div style={{ textAlign: 'left', margin: '0 auto 14px', maxWidth: 520 }}>
            <div style={{
              padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0',
              background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)', marginBottom: 10,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Coverage reference
              </p>
              <p style={{ fontSize: 12, color: '#475569', margin: '0 0 4px' }}>
                <strong>Benefit type (routing reference):</strong>{' '}
                {routeSummary?.matchedBenefitType || routingAlignment || '—'}
              </p>
              <p style={{ fontSize: 12, color: '#475569', margin: '0 0 4px' }}>
                <strong>Filing target you entered:</strong> {routeSummary?.primaryProvider || recipientName}
              </p>
              <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                <strong>Incident category (on record):</strong>{' '}
                {String(incident?.disruption_type || (incident?.metadata as Record<string, unknown>)?.disruption_type || '—')}
              </p>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#334155', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Documentation checklist
              </p>
              {evidence.length === 0 ? (
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>No evidence files listed in Wayfarer for this incident.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#475569', lineHeight: 1.55 }}>
                  {evidence.map((ev: { id: string; name: string; evidence_category?: string }) => (
                    <li key={ev.id} style={{ marginBottom: 4 }}>
                      ☑ {ev.name} ({ev.evidence_category || 'general'})
                    </li>
                  ))}
                </ul>
              )}
              <p style={{ fontSize: 11, color: '#64748b', margin: '8px 0 0', fontStyle: 'italic' }}>
                Itemized receipts are usually the primary adjuster requirement; card statements alone are often not enough.
              </p>
            </div>

            {engineGuidance.length > 0 && (
              <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fafafa', marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#334155', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Sequencing notes
                </p>
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#475569', lineHeight: 1.55 }}>
                  {engineGuidance.map((g, i) => (
                    <li key={i} style={{ marginBottom: 6 }}>
                      {g.action || 'Step'}
                      {g.note ? ` — ${g.note}` : ''}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {routingAlignment && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f1f5f9', marginBottom: 10, fontSize: 12, color: '#475569' }}>
                <strong>Engine alignment label:</strong> {routingAlignment.replace(/_/g, ' ')}
                {routeSummary?.alignmentConfidence ? (
                  <span> · Confidence: {routeSummary.alignmentConfidence}</span>
                ) : null}
              </div>
            )}

            {evidenceRegenHint && (
              <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, margin: '0 0 10px' }}>{evidenceRegenHint}</p>
            )}
            <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, margin: '0 0 12px' }}>
              If you change your incident narrative or timeline materially, prepare an updated packet before filing when
              regeneration is available.
            </p>
          </div>

          <div style={{
            textAlign: 'left', margin: '0 auto 20px', maxWidth: 520, padding: '10px 12px',
            borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 11, color: '#7f1d1d', lineHeight: 1.5,
          }}>
            <strong>Disclaimer:</strong> This packet is a decision-support tool. It does not constitute a claim submission,
            legal advice, or guarantee of coverage or reimbursement. Coverage determinations are made solely by your
            provider or card issuer.
          </div>

          {packetId && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => {
                  window.open(`/api/claim-packet/generate?packet_id=${encodeURIComponent(packetId)}`, '_blank', 'noopener,noreferrer');
                }}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #1A2B4A 0%, #1e3a5f 100%)',
                  color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', boxShadow: '0 2px 8px rgba(26,43,74,0.25)',
                }}
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={handleCopyClaimSummary}
                style={{
                  padding: '12px 22px', background: 'white', color: '#1A2B4A',
                  border: '1.5px solid #cbd5e1', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Copy claim summary
              </button>
            </div>
          )}
          {copyFeedback ? (
            <p style={{ fontSize: 12, color: '#16a34a', margin: '0 0 12px' }}>{copyFeedback}</p>
          ) : null}

          <button
            type="button"
            disabled
            title={
              regenBlocked
                ? 'Maximum packet regenerations reached for this claim.'
                : 'Regenerating a packet from Wayfarer will be available when your workspace supports it.'
            }
            style={{
              marginBottom: 22, padding: '8px 16px', fontSize: 12, color: '#94a3b8',
              background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, cursor: 'not-allowed',
            }}
          >
            Regenerate packet (not available)
          </button>

          <p style={{ fontSize: 13, color: '#999', margin: '0 0 24px', lineHeight: 1.5 }}>
            Keep all reference numbers and correspondence. Follow up if you don&apos;t hear back within the timeframe specified in your policy.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href={`/trips/${tripId}/incidents/${incidentId}`} style={{
              padding: '10px 22px', background: '#1A2B4A', color: 'white',
              borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600,
            }}>
              View incident record
            </Link>
            <Link href={`/trips/${tripId}`} style={{
              padding: '10px 22px', background: 'white', color: '#1A2B4A',
              border: '1px solid #dbeafe', borderRadius: 8, textDecoration: 'none',
              fontSize: 13, fontWeight: 600,
            }}>
              Back to trip
            </Link>
          </div>
        </div>
      </div>
      </AppPageRoot>
    );
  }

  return (
    <AppPageRoot>
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 700 }}>
      <Link href={`/trips/${tripId}/incidents/${incidentId}`} style={{
        fontSize: 13, color: '#888', textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to incident
      </Link>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px', letterSpacing: '-0.4px' }}>
          Route this claim
        </h1>
        <p style={{ fontSize: 14, color: '#666', margin: 0, lineHeight: 1.6 }}>
          Tell us who you&apos;re filing with and we&apos;ll record this routing in your incident file.
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <CoverageMapStatusBanner tripId={tripId} context="claim_route" />
      </div>

      {carrierResponses.length > 0 && (
        <div style={{
          marginBottom: 16,
          padding: '12px 14px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#334155' }}>
            Carrier actions on file ({carrierResponses.length})
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#475569', lineHeight: 1.55 }}>
            {carrierResponses.map((cr: any) => (
              <li key={cr.response_id}>
                {cr.action_label}
                {cr.value_amount != null ? ` · ${cr.currency_code || 'USD'} ${cr.value_amount}` : ''}
              </li>
            ))}
          </ul>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#64748b' }}>
            These entries are included in your claim preparation packet as factual context.
          </p>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setPreLockOpen((o) => !o)}
          style={{
            background: 'white', border: '1px solid #e2e8f0', borderRadius: 10,
            padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#334155',
            cursor: 'pointer', width: '100%', textAlign: 'left',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          Quick checks before you save this step?
          <span style={{ color: '#94a3b8' }}>{preLockOpen ? '▲' : '▼'}</span>
        </button>
        {preLockOpen && (
          <div style={{
            marginTop: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
            padding: '12px 14px', fontSize: 12, color: '#475569', lineHeight: 1.55,
          }}>
            <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#334155' }}>
              Quick checks (guidance only — verify against your policy documents)
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Notice / claim deadlines: does your policy require you to inform the insurer within a set window?</li>
              <li>Carrier proof: do you have delay letters, baggage reports, or other operator documentation on file?</li>
              <li>Order of payers: if both card benefits and travel insurance may apply, which channel is primary?</li>
              <li>Documentation: are receipts and booking references already attached to this incident?</li>
            </ul>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <InterpretiveBoundaryNotice />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ background: '#f8fafc', border: '1px solid #dbeafe', borderRadius: 12, padding: '16px 18px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Routing posture
          </p>
          <p style={{ fontSize: 13, color: '#1e3a8a', margin: '0 0 10px', lineHeight: 1.55 }}>
            {postureLabel(guidancePosture)} {' — '} {decisionGuidance.why_it_applies}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sequenceNotes.map((note, idx) => (
              <p key={idx} style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.55 }}>
                • {note}
              </p>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '16px 18px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#9a3412', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Acceptance checkpoint
          </p>
          <p style={{ fontSize: 13, color: '#7c2d12', margin: '0 0 12px', lineHeight: 1.55 }}>
            If you&apos;ve already accepted a refund, rebooking, voucher, or credit, downstream providers may evaluate remaining loss differently.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#7c2d12', marginBottom: 6 }}>
                Have you already accepted compensation?
              </label>
              <select
                value={acceptedCompensation}
                onChange={(e) => setAcceptedCompensation(e.target.value)}
                style={{
                  width: '100%', padding: '9px 11px', fontSize: 13, border: '1px solid #fdba74',
                  borderRadius: 8, outline: 'none', color: '#111', background: 'white',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {ACCEPTANCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#7c2d12', marginBottom: 6 }}>
                Do you want to arrange your own transport now?
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {([
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                  { value: 'undecided', label: 'Not sure yet' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setArrangeOwnNow(opt.value)}
                    style={{
                      padding: '7px 11px',
                      borderRadius: 999,
                      border: arrangeOwnNow === opt.value ? '1px solid #fb923c' : '1px solid #fdba74',
                      background: arrangeOwnNow === opt.value ? '#ffedd5' : 'white',
                      color: '#7c2d12',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {evidence.length > 0 && (
          <div style={{ background: '#f7f9fc', border: '1px solid #dbeafe', borderRadius: 12, padding: '16px 18px' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#2E5FA3', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Evidence attached ({evidence.length} item{evidence.length !== 1 ? 's' : ''})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {evidence.slice(0, 4).map((ev, i) => (
                <div key={ev.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: 12, color: '#555' }}>{ev.name || 'Document'}</span>
                </div>
              ))}
              {evidence.length > 4 && (
                <span style={{ fontSize: 12, color: '#999' }}>+{evidence.length - 4} more</span>
              )}
            </div>
          </div>
        )}

        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 16px' }}>
            Cause classification
          </p>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
            Which option best matches what happened?
            </label>
            <select
              value={causeClassification}
              onChange={(e) => setCauseClassification(e.target.value)}
              style={{
                width: '100%', padding: '9px 11px', fontSize: 13,
                border: '1px solid #ddd', borderRadius: 8, outline: 'none',
                color: causeClassification ? '#111' : '#999', background: 'white',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              <option value="">Select cause…</option>
              {CAUSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 16px' }}>
            Claim recipient
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
                Recipient type
              </label>
              <select
                value={recipientType}
                onChange={(e) => setRecipientType(e.target.value)}
                style={{
                  width: '100%', padding: '9px 11px', fontSize: 13,
                  border: '1px solid #ddd', borderRadius: 8, outline: 'none',
                  color: recipientType ? '#111' : '#999', background: 'white',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                <option value="">Select type…</option>
                {RECIPIENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
                Recipient name
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Allianz Travel Insurance"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 13,
                  border: '1px solid #ddd', borderRadius: 8, outline: 'none', color: '#111',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              />
            </div>

            {policies.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
                  Policy being claimed (optional)
                </label>
                <select
                  value={selectedPolicyId}
                  onChange={(e) => setSelectedPolicyId(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 11px', fontSize: 13,
                    border: '1px solid #ddd', borderRadius: 8, outline: 'none',
                    color: selectedPolicyId ? '#111' : '#999', background: 'white',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  <option value="">Select policy…</option>
                  {policies.map((p) => (
                    <option key={p.policy_id} value={p.policy_id}>
                      {p.policy_label || p.provider_name || 'Unnamed policy'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 16px' }}>
            Claim amount (optional)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
                Amount
              </label>
              <input
                type="number"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 13,
                  border: '1px solid #ddd', borderRadius: 8, outline: 'none', color: '#111',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
                Currency
              </label>
              <select
                value={claimCurrency}
                onChange={(e) => setClaimCurrency(e.target.value)}
                style={{
                  width: '100%', padding: '9px 11px', fontSize: 13,
                  border: '1px solid #ddd', borderRadius: 8, outline: 'none',
                  color: '#111', background: 'white',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SGD'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          {Number(claimAmount || 0) > 0 &&
            Number(claimAmount || 0) <= 300 &&
            ['travel_insurer', 'home_or_renter'].includes(recipientType) && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#854d0e', lineHeight: 1.55 }}>
                  This claim appears relatively small. Some long-term policies treat any claim as part of your history.
                  You may want to weigh claim value against possible future eligibility or premium considerations.
                </p>
              </div>
            )}
        </div>

        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 10px' }}>
            Additional notes (optional)
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Reference numbers, case IDs, contact names, or anything else to record with this filing."
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 13,
              border: '1px solid #ddd', borderRadius: 8, outline: 'none', color: '#111',
              resize: 'vertical', lineHeight: 1.6,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          />
        </div>

        {error && (
          <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              flex: 1, padding: '13px 0',
              background: submitting ? '#93afd4' : '#1A2B4A',
              color: 'white', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {submitting ? 'Saving…' : 'Save routing details'}
          </button>
          <Link href={`/trips/${tripId}/incidents/${incidentId}`} style={{
            padding: '13px 20px',
            background: 'white', color: '#1A2B4A',
            border: '1px solid #e0e0e0',
            borderRadius: 10, textDecoration: 'none',
            fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            Cancel
          </Link>
        </div>

        <p style={{ fontSize: 11, color: '#bbb', margin: '-8px 0 0', lineHeight: 1.5 }}>
          This records the claim routing in your incident file. It does not submit to any insurer on your behalf.
        </p>
      </div>
    </div>
    </AppPageRoot>
  );
}
