import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppPageRoot from '@/components/layout/AppPageRoot';

type Slug = 'insurance-options' | 'post-purchase-policy' | 'policy-alignment' | 'trip-end-reminder' | 'trip-extension';
const UUID_RX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const KNOWN_SLUGS: ReadonlyArray<Slug> = [
  'insurance-options',
  'post-purchase-policy',
  'policy-alignment',
  'trip-end-reminder',
  'trip-extension',
];

function isSlug(value: string): value is Slug {
  return (KNOWN_SLUGS as ReadonlyArray<string>).includes(value);
}

function InsuranceOptionsBody({ tripId }: { tripId: string }) {
  return (
    <>
      <p style={{ margin: '0 0 12px', lineHeight: 1.6 }}>
        <strong>Wayfarer does not sell insurance and is not a licensed broker.</strong> This area will eventually surface
        educational option cards, neutral comparisons from your structured trip/policy context, and a clear handoff when you choose to buy elsewhere.
      </p>
      <p style={{ margin: 0, lineHeight: 1.6, color: '#475569' }}>
        Until activation: use your own broker or insurer; then add documents via the{' '}
        <Link href={`/trips/${tripId}/section-5-staged/post-purchase-policy`} style={{ color: '#2E5FA3', fontWeight: 600 }}>
          post-purchase staging page
        </Link>
        {' '}or{' '}
        <Link href={`/policies/upload?trip_id=${tripId}`} style={{ color: '#2E5FA3', fontWeight: 600 }}>
          policy upload
        </Link>
        .
      </p>
    </>
  );
}

const STATIC_CONFIG: Record<Slug, {
  title: string;
  featureId: string;
  surfaceHint: string;
  body?: ReactNode;
}> = {
  'insurance-options': {
    title: 'Insurance options (off-platform)',
    featureId: 'F-5.0.7-STEP-INSURANCE-OPTIONS',
    surfaceHint: 'Section 5 Step 7 · broker / educational boundary',
  },
  'post-purchase-policy': {
    title: 'After you buy coverage',
    featureId: 'F-5.0.8-STEP-POST-PURCHASE-INGEST',
    surfaceHint: 'Section 5 Step 8',
  },
  'policy-alignment': {
    title: 'Align trip and policies',
    featureId: 'F-5.0.10-STEP-POLICY-ALIGNMENT',
    surfaceHint: 'Section 5 Step 10 · explicit binding',
    body: (
      <>
        <p style={{ margin: '0 0 12px', lineHeight: 1.6 }}>
          This screen will record an explicit confirmation of which policies and benefits apply to this trip version—structural documentation only, no outcome guarantees.
        </p>
        <p style={{ margin: 0, lineHeight: 1.6, color: '#475569' }}>
          Prerequisites: stable itinerary + uploaded artifacts + governance events on bind. FOCL will gate activation.
        </p>
      </>
    ),
  },
  'trip-end-reminder': {
    title: 'Trip-end reminder',
    featureId: 'F-5.0.12-STEP-TRIP-END-REMINDER',
    surfaceHint: 'Section 5 Step 12 · single neutral 48h reminder',
    body: (
      <>
        <p style={{ margin: '0 0 12px', lineHeight: 1.6 }}>
          Product intent: one calm reminder (e.g. ~48 hours before trip end) for wrap-up and documentation—not a stream of nudges. Scheduling, templates, and eligibility rules ship with notification infrastructure.
        </p>
        <p style={{ margin: 0, lineHeight: 1.6, color: '#475569' }}>
          This surface is staged; no reminder is sent from this page.
        </p>
      </>
    ),
  },
  'trip-extension': {
    title: 'Continue your trip',
    featureId: 'F-5.0.13-STEP-TRIP-EXTENSION',
    surfaceHint: 'Section 5 Step 13',
    body: (
      <>
        <p style={{ margin: '0 0 12px', lineHeight: 1.6 }}>
          Continuation trips, incentives, and corporate-linked flows are a post-day-one bucket. This route reserves UX and registry slots so we do not orphan the feature in FOCL.
        </p>
        <p style={{ margin: 0, lineHeight: 1.6, color: '#475569' }}>
          For now: create a new trip from <Link href="/trips/new" style={{ color: '#2E5FA3', fontWeight: 600 }}>Plan a trip</Link>.
        </p>
      </>
    ),
  },
};

function PostPurchaseBody({ tripId }: { tripId: string }) {
  return (
    <>
      <p style={{ margin: '0 0 12px', lineHeight: 1.6 }}>
        This flow will confirm you completed an off-platform purchase, then guide you to ingest policies and benefits into Wayfarer so scans and routing stay aligned with what you actually hold.
      </p>
      <p style={{ margin: 0, lineHeight: 1.6, color: '#475569' }}>
        For now: add documents from{' '}
        <Link href={`/policies/upload?trip_id=${tripId}`} style={{ color: '#2E5FA3', fontWeight: 600 }}>
          Upload a policy
        </Link>
        .
      </p>
    </>
  );
}

function resolveBody(slug: Slug, tripId: string): ReactNode {
  const meta = STATIC_CONFIG[slug];
  if (meta.body != null) return meta.body;
  if (slug === 'insurance-options') return <InsuranceOptionsBody tripId={tripId} />;
  if (slug === 'post-purchase-policy') return <PostPurchaseBody tripId={tripId} />;
  return null;
}

export default function Section5StagedSlugPage({
  params,
}: {
  params: { trip_id: string; slug: string };
}) {
  const tripId = params?.trip_id;
  const rawSlug = params?.slug;
  if (!tripId || !UUID_RX.test(tripId)) notFound();
  if (!rawSlug || !isSlug(rawSlug)) notFound();

  const slug: Slug = rawSlug;
  const cfg = STATIC_CONFIG[slug];
  const tripHref = `/trips/${tripId}`;

  return (
    <AppPageRoot>
    <div style={{ maxWidth: 640, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href={tripHref} style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to trip
      </Link>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 999,
        padding: '6px 12px', marginBottom: 14, fontSize: 11, fontWeight: 700, color: '#92400e', letterSpacing: '0.04em',
      }}>
        STAGED · NOT ACTIVATED
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', margin: '0 0 8px', letterSpacing: '-0.4px' }}>
        {cfg.title}
      </h1>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 20px' }}>
        {cfg.surfaceHint} · <code style={{ fontSize: 11 }}>{cfg.featureId}</code>
      </p>

      <div style={{
        background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
        padding: '18px 20px', fontSize: 14, color: '#334155', marginBottom: 20,
      }}>
        {resolveBody(slug, tripId)}
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', fontSize: 12, color: '#475569', lineHeight: 1.55 }}>
        <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#1e293b' }}>Founder activation (FOCL)</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Register rollout + entitlement (§10.2)</li>
          <li>Map <strong>surface_id</strong> + stress families (§7.3.8)</li>
          <li>Governance events for any bind/mutation (§3.0)</li>
          <li>E2E + copy review per <code>lib/FOCL_INACTIVE_FEATURE_DESCRIPTOR_TEMPLATE.md</code></li>
        </ul>
        <p style={{ margin: '12px 0 0' }}>
          <Link href="/focl/features/intelligence" style={{ color: '#2E5FA3', fontWeight: 600 }}>
            Open Feature Intelligence panel
          </Link>
        </p>
      </div>
    </div>
    </AppPageRoot>
  );
}
