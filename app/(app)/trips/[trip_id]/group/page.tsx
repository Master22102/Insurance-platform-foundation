'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Toaster } from 'sonner';
import { supabase } from '@/lib/auth/supabase-client';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CoverageRecommendationSheet } from '@/components/group/CoverageRecommendationSheet';
import { CoverageRequirementCard, type RecommendationRow } from '@/components/group/CoverageRequirementCard';
import { SchoolTripVerificationPanel } from '@/components/group/SchoolTripVerificationPanel';
import { CorporateTripPanel } from '@/components/group/CorporateTripPanel';
import { ItinerarySharingSettings } from '@/components/group/ItinerarySharingSettings';
import { SharedItineraryView } from '@/components/group/SharedItineraryView';
import { cn } from '@/lib/utils';
import AppPageRoot from '@/components/layout/AppPageRoot';

type GroupParticipant = {
  participant_id: string;
  account_id: string;
  role: 'organizer' | 'participant';
  status: 'invited' | 'active' | 'revoked' | 'archived';
  residence_country_code: string | null;
  residence_state_code: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type PendingRequest = {
  request_id: string;
  requester_id?: string;
  subject_id: string;
  guardian_id?: string | null;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  trip_type?: string;
  subject_approved?: boolean;
  guardian_approved?: boolean;
  requires_dual_approval?: boolean;
  expires_at: string;
  created_at: string;
};

type CoverageSummary = {
  account_id: string;
  has_any_policy: boolean;
  coverage_gap_count: number;
  checklist_completion_pct: number;
};

type ExportGrant = {
  grant_id: string;
  subject_id: string;
  organizer_id: string;
  status: string;
};

function initials(name: string) {
  const p = name.split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return (p[0]![0] + p[1]![0]).toUpperCase();
}

function hashHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

export default function GroupAuthorityPage() {
  const { user } = useAuth();
  const params = useParams();
  const tripId = String(params?.trip_id || '');

  const [participants, setParticipants] = useState<GroupParticipant[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectIdInput, setSubjectIdInput] = useState('');
  const [tripType, setTripType] = useState<'family' | 'school' | 'corporate' | 'friend_group'>('friend_group');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [guardianIdInput, setGuardianIdInput] = useState('');
  const [requiresGuardian, setRequiresGuardian] = useState(false);
  const [organizerId, setOrganizerId] = useState<string>('');
  const [subjectExportId, setSubjectExportId] = useState('');
  const [grantBusy, setGrantBusy] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [governedFeatureEnabled, setGovernedFeatureEnabled] = useState({
    inviteFlow: true,
    exportAuth: true,
  });

  const [tripTitle, setTripTitle] = useState('');
  /** Set true after group page `load()` finishes (E2E + avoids asserting before organizer UI mounts). */
  const [groupPageDataReady, setGroupPageDataReady] = useState(false);
  const [corporatePolicyUrl, setCorporatePolicyUrl] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<CoverageSummary[]>([]);
  const [alerts, setAlerts] = useState<{ gap_id: string; message: string }[]>([]);
  const [nameByAccount, setNameByAccount] = useState<Map<string, string>>(new Map());
  const [activityNames, setActivityNames] = useState<string[]>([]);
  const [exportGrants, setExportGrants] = useState<ExportGrant[]>([]);
  const [recSheetOpen, setRecSheetOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [remindGuardBusy, setRemindGuardBusy] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);
  const [recResponse, setRecResponse] = useState<{
    response_type: string;
    policy_id: string | null;
    organizer_reviewed: boolean;
    organizer_approved: boolean | null;
  } | null>(null);
  const [sharedSharers, setSharedSharers] = useState<
    { account_id: string; display_name: string; activities: { candidate_id: string; activity_name: string | null; date_hint: string | null; city: string | null }[] }[]
  >([]);

  const load = useCallback(async () => {
    if (!user || !tripId) {
      setGroupPageDataReady(false);
      return;
    }
    setGroupPageDataReady(false);
    setLoading(true);
    const [participantRes, pendingRes, tripRes, actRes] = await Promise.all([
      supabase
        .from('group_participants')
        .select('participant_id, account_id, role, status, residence_country_code, residence_state_code, metadata, created_at')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true }),
      supabase
        .from('relationship_verification_requests')
        .select(
          'request_id, requester_id, subject_id, guardian_id, status, trip_type, requires_dual_approval, subject_approved, guardian_approved, expires_at, created_at',
        )
        .eq('trip_id', tripId)
        .in('status', ['pending', 'approved', 'denied', 'expired'])
        .order('created_at', { ascending: false })
        .limit(25),
      supabase.from('trips').select('trip_name, lifecycle_flags').eq('trip_id', tripId).maybeSingle(),
      supabase.from('activity_candidates').select('activity_name').eq('trip_id', tripId).limit(80),
    ]);

    setParticipants((participantRes.data || []) as GroupParticipant[]);
    setPending((pendingRes.data || []) as PendingRequest[]);
    const organizer = (participantRes.data || []).find((p: GroupParticipant) => p.role === 'organizer' && p.status === 'active');
    setOrganizerId(String(organizer?.account_id || user.id));

    const t = tripRes.data as { trip_name?: string; lifecycle_flags?: Record<string, unknown> } | null;
    setTripTitle(t?.trip_name || 'Trip');
    const lf = t?.lifecycle_flags;
    setCorporatePolicyUrl(typeof lf?.corporate_travel_policy_url === 'string' ? lf.corporate_travel_policy_url : null);

    setActivityNames(
      Array.from(
        new Set((actRes.data || []).map((r: { activity_name: string | null }) => (r.activity_name || '').trim()).filter(Boolean)),
      ),
    );

    const me = participantRes.data?.find((p: GroupParticipant) => p.account_id === user.id);
    const isOrg = me?.role === 'organizer' && me?.status === 'active';

    if (isOrg) {
      const [sumRes, rosterRes, alertRes, grantsRes, recRes] = await Promise.all([
        supabase.from('group_coverage_summary').select('account_id, has_any_policy, coverage_gap_count, checklist_completion_pct').eq('trip_id', tripId),
        fetch(`/api/group/roster?trip_id=${encodeURIComponent(tripId)}`, { credentials: 'include' }),
        fetch(`/api/group/coverage-alerts?trip_id=${encodeURIComponent(tripId)}`, { credentials: 'include' }),
        supabase.from('export_authorization_grants').select('grant_id, subject_id, organizer_id, status').eq('trip_id', tripId),
        supabase.from('group_coverage_recommendations').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }).limit(10),
      ]);

      setSummaries((sumRes.data || []) as CoverageSummary[]);
      if (rosterRes.ok) {
        const j = await rosterRes.json();
        const m = new Map<string, string>();
        for (const p of j.participants || []) {
          m.set(p.account_id, p.display_name || 'Traveler');
        }
        setNameByAccount(m);
      }
      if (alertRes.ok) {
        const aj = await alertRes.json();
        setAlerts(aj.alerts || []);
      }
      setExportGrants((grantsRes.data || []) as ExportGrant[]);
      setRecommendations((recRes.data || []) as RecommendationRow[]);
    } else {
      setSummaries([]);
      setAlerts([]);
      setExportGrants([]);
      const m = new Map<string, string>();
      m.set(user.id, 'You');
      setNameByAccount(m);
      const { data: recs } = await supabase
        .from('group_coverage_recommendations')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(5);
      const list = (recs || []) as RecommendationRow[];
      const mine = list.find((r) => Array.isArray((r as unknown as { recipient_account_ids?: string[] }).recipient_account_ids) && (r as unknown as { recipient_account_ids: string[] }).recipient_account_ids.includes(user.id));
      setRecommendations(mine ? [mine] : []);
      if (mine) {
        const { data: resp } = await supabase
          .from('group_coverage_responses')
          .select('response_type, policy_id, organizer_reviewed, organizer_approved')
          .eq('recommendation_id', mine.recommendation_id)
          .eq('account_id', user.id)
          .maybeSingle();
        setRecResponse(resp as typeof recResponse);
      } else {
        setRecResponse(null);
      }
    }

    const shRes = await fetch(`/api/group/shared-itineraries?trip_id=${encodeURIComponent(tripId)}`, { credentials: 'include' });
    if (shRes.ok) {
      const sj = await shRes.json();
      setSharedSharers(sj.sharers || []);
    }

    setLoading(false);
    setGroupPageDataReady(true);
  }, [tripId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const loadGovernance = async () => {
      const region = '00000000-0000-0000-0000-000000000000';
      const featureIds = ['F-2.0.12-INVITES', 'F-2.0.6-EXPORT-AUTH'];
      const [activationRes, registryRes] = await Promise.all([
        supabase.from('feature_activation_state').select('feature_id, enabled').eq('region_id', region).in('feature_id', featureIds),
        supabase.from('feature_registry').select('feature_id, default_enabled').in('feature_id', featureIds),
      ]);
      const activation = new Map((activationRes.data || []).map((r: { feature_id: string; enabled: boolean }) => [r.feature_id, Boolean(r.enabled)]));
      const defaults = new Map((registryRes.data || []).map((r: { feature_id: string; default_enabled: boolean }) => [r.feature_id, Boolean(r.default_enabled)]));
      const isEnabled = (id: string) => (activation.has(id) ? activation.get(id)! : defaults.get(id) ?? true);
      setGovernedFeatureEnabled({
        inviteFlow: isEnabled('F-2.0.12-INVITES'),
        exportAuth: isEnabled('F-2.0.6-EXPORT-AUTH'),
      });
    };
    void loadGovernance();
  }, [user]);

  const meParticipant = useMemo(
    () => participants.find((p) => p.account_id === user?.id && p.status === 'active'),
    [participants, user?.id],
  );
  const isOrganizer = meParticipant?.role === 'organizer';

  const derivedTripType = useMemo(() => {
    const counts: Record<string, number> = { family: 0, school: 0, corporate: 0, friend_group: 0 };
    for (const r of pending) {
      const tt = r.trip_type || 'friend_group';
      if (counts[tt] != null) counts[tt] += 1;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return (best && best[1] > 0 ? best[0] : tripType) as typeof tripType;
  }, [pending, tripType]);

  const readiness = useMemo(() => {
    const active = participants.filter((p) => p.status === 'active');
    const missing = active.filter((p) => {
      const country = String(p.residence_country_code || '').trim().toUpperCase();
      if (!country) return true;
      if (country === 'US') {
        const state = String(p.residence_state_code || '').trim().toUpperCase();
        return !state;
      }
      return false;
    });
    return { activeCount: active.length, missingCount: missing.length };
  }, [participants]);

  const summaryByAccount = useMemo(() => {
    const m = new Map<string, CoverageSummary>();
    for (const s of summaries) m.set(s.account_id, s);
    return m;
  }, [summaries]);

  const rosterForRec = useMemo(() => {
    return participants
      .filter((p) => p.status === 'active')
      .map((p) => ({
        account_id: p.account_id,
        display_name: nameByAccount.get(p.account_id) || 'Traveler',
      }));
  }, [participants, nameByAccount]);

  const requestAdd = async () => {
    if (!governedFeatureEnabled.inviteFlow) {
      setMessage('Participant invites are currently staged off by rollout control.');
      return;
    }
    if (!subjectIdInput.trim()) return;
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase.rpc('request_group_participant_add', {
      p_trip_id: tripId,
      p_subject_id: subjectIdInput.trim(),
      p_trip_type: tripType,
      p_requires_guardian_approval: requiresGuardian || tripType === 'school',
      p_guardian_id: guardianIdInput.trim() || null,
    });
    setBusy(false);
    if (error || !data?.success) {
      setMessage(error?.message || data?.error || 'Could not request participant add.');
      return;
    }
    setMessage(
      data.status === 'added_automatic'
        ? 'Participant added automatically (prior relationship verified).'
        : requiresGuardian || tripType === 'school'
          ? 'Verification request sent. Minor + guardian approvals are required for school trips when configured.'
          : 'Verification request sent. Participant approval is required.',
    );
    setSubjectIdInput('');
    setGuardianIdInput('');
    setRequiresGuardian(false);
    await load();
  };

  const resolveRequest = async (requestId: string, decision: 'approve' | 'deny') => {
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase.rpc('resolve_relationship_verification_request', {
      p_request_id: requestId,
      p_decision: decision,
    });
    setBusy(false);
    if (error || !data?.success) {
      setMessage(error?.message || data?.error || 'Could not resolve request.');
      return;
    }
    setMessage(`Request ${data.status}.`);
    await load();
  };

  const grantExport = async () => {
    if (!governedFeatureEnabled.exportAuth) {
      setMessage('Export authorization is currently staged off by rollout control.');
      return;
    }
    if (!subjectExportId.trim() || !organizerId) return;
    setGrantBusy(true);
    setMessage('');
    const { data, error } = await supabase.rpc('grant_export_authorization', {
      p_trip_id: tripId,
      p_subject_id: subjectExportId.trim(),
      p_organizer_id: organizerId,
      p_expires_at: null,
    });
    setGrantBusy(false);
    if (error || !data?.success) {
      setMessage(error?.message || data?.error || 'Could not grant export authorization.');
      return;
    }
    setMessage('Export authorization granted.');
    setSubjectExportId('');
    await load();
  };

  const revokeExport = async () => {
    if (!subjectExportId.trim() || !organizerId) return;
    if (!governedFeatureEnabled.exportAuth) {
      setMessage('Export authorization is currently staged off by rollout control.');
      return;
    }
    setRevokeBusy(true);
    setMessage('');
    const { data, error } = await supabase.rpc('revoke_export_authorization', {
      p_trip_id: tripId,
      p_subject_id: subjectExportId.trim(),
      p_organizer_id: organizerId,
      p_reason_code: 'participant_self_defense',
    });
    setRevokeBusy(false);
    if (error || !data?.success) {
      setMessage(error?.message || data?.error || 'Could not revoke export authorization.');
      return;
    }
    setMessage('Export authorization revoked immediately.');
    setSubjectExportId('');
    await load();
  };

  const updateResidence = async (
    participantId: string,
    patch: { residence_country_code?: string | null; residence_state_code?: string | null },
  ) => {
    const { data, error } = await supabase.rpc('update_group_participant_residence_profile', {
      p_participant_id: participantId,
      p_residence_country_code: patch.residence_country_code ?? null,
      p_residence_state_code: patch.residence_state_code ?? null,
    });
    if (error) {
      setMessage(error.message || 'Could not update residence profile.');
      return;
    }
    if (!data?.success) {
      const err = typeof data?.error === 'string' ? data.error : 'residence_update_failed';
      const guard = data?.guard != null ? ` · guard: ${JSON.stringify(data.guard)}` : '';
      setMessage(`${err}${guard}`);
      return;
    }
    await load();
  };

  const refreshSummary = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/group/refresh-coverage-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ trip_id: tripId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setMessage(typeof j.error === 'string' ? j.error : 'Refresh failed');
      else setMessage('Coverage summary refreshed.');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remindParticipant = async (accountId: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/group/remind-coverage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ trip_id: tripId, account_id: accountId }),
      });
      const j = await res.json().catch(() => ({}));
      setMessage(res.ok ? 'Reminder sent.' : typeof j.error === 'string' ? j.error : 'Reminder failed');
    } finally {
      setBusy(false);
    }
  };

  const remindGuardians = async () => {
    setRemindGuardBusy(true);
    try {
      const res = await fetch('/api/group/remind-guardians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ trip_id: tripId }),
      });
      const j = await res.json().catch(() => ({}));
      setMessage(res.ok ? `Reminders queued (${j.notified_guardians || 0} guardians).` : typeof j.error === 'string' ? j.error : 'Failed');
    } finally {
      setRemindGuardBusy(false);
    }
  };

  const sharingInitial = useMemo(() => {
    const meta = meParticipant?.metadata as Record<string, unknown> | undefined;
    const sp = (meta?.sharing_preferences || {}) as { share_mode?: string; shared_item_ids?: string[] };
    return {
      share_mode: (sp.share_mode as 'all' | 'selected' | 'none') || 'all',
      shared_item_ids: sp.shared_item_ids || [],
    };
  }, [meParticipant]);

  const verificationLabelForSubject = (subjectId: string) => {
    const rows = pending.filter((r) => r.subject_id === subjectId);
    const row = rows.find((r) => r.status === 'pending') || rows[0];
    if (!row || row.status !== 'pending') return row?.status === 'approved' ? 'Approved' : row ? row.status : '—';
    if (row.requires_dual_approval || row.trip_type === 'school') {
      if (row.subject_approved && row.guardian_approved) return 'Approved';
      if (row.subject_approved && !row.guardian_approved) return 'Pending guardian';
      if (!row.subject_approved) return 'Invite sent';
    }
    return 'Invite sent';
  };

  const renderCoveragePills = (s: CoverageSummary | undefined) => {
    const has = s?.has_any_policy;
    const gaps = s?.coverage_gap_count ?? 0;
    const pct = s?.checklist_completion_pct ?? 0;
    const policyTone = has ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100' : 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100';
    const gapTone =
      gaps === 0 ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100' : 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100';
    const checkTone =
      pct >= 80 ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100' : pct >= 50 ? 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100' : 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100';
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        <Badge variant="secondary" className={cn('text-[10px] font-medium', policyTone)}>
          {has ? 'Policy attached' : 'No policy'}
        </Badge>
        <Badge variant="secondary" className={cn('text-[10px] font-medium', gapTone)}>
          {gaps} gaps
        </Badge>
        <Badge variant="secondary" className={cn('text-[10px] font-medium', checkTone)}>
          Checklist {pct}%
        </Badge>
      </div>
    );
  };

  const hideGenericVerification = derivedTripType === 'school' && isOrganizer;

  return (
    <AppPageRoot>
    <div className="max-w-5xl mx-auto space-y-6" data-testid="group-authority-root">
      {groupPageDataReady ? <span data-testid="group-page-data-ready" className="sr-only" aria-hidden /> : null}
      <Toaster richColors position="top-center" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/trips/${tripId}`} className="text-sm text-muted-foreground hover:text-foreground w-fit">
          ← Back to trip
        </Link>
        {isOrganizer ? (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void refreshSummary()}>
            Refresh coverage summary
          </Button>
        ) : null}
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="group-trip-title">
          {loading ? 'Loading…' : tripTitle || 'Trip'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Organizer controls coordination only. You see coverage readiness aggregates — never policy clauses, claim amounts, or evidence.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          FOCL: invites {governedFeatureEnabled.inviteFlow ? 'on' : 'off'} · export auth {governedFeatureEnabled.exportAuth ? 'on' : 'off'}
        </p>
      </div>

      {isOrganizer && alerts.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 space-y-2">
          <p className="text-sm font-medium text-amber-950 dark:text-amber-100">Group coverage alert</p>
          {alerts.slice(0, 3).map((a) => (
            <p key={a.gap_id} className="text-sm text-amber-900 dark:text-amber-50/90">
              {a.message}
            </p>
          ))}
          <Button type="button" size="sm" variant="secondary" onClick={() => setRecSheetOpen(true)}>
            Recommend coverage for group
          </Button>
        </div>
      ) : null}

      {derivedTripType === 'school' && isOrganizer ? (
        <SchoolTripVerificationPanel
          tripName={tripTitle}
          pending={pending}
          nameByAccount={nameByAccount}
          onRemindGuardians={() => void remindGuardians()}
          remindBusy={remindGuardBusy}
        />
      ) : null}

      {derivedTripType === 'corporate' && isOrganizer ? (
        <CorporateTripPanel tripId={tripId} initialPolicyUrl={corporatePolicyUrl} />
      ) : null}

      {isOrganizer ? (
        <Card data-testid="group-dashboard-participant-readiness">
          <CardHeader>
            <CardTitle className="text-lg">Participant readiness</CardTitle>
            <CardDescription>
              Active: {readiness.activeCount} · Missing residence: {readiness.missingCount}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {participants.map((p) => {
                  const display = nameByAccount.get(p.account_id) || 'Traveler';
                  const s = summaryByAccount.get(p.account_id);
                  const hue = hashHue(p.account_id);
                  return (
                    <div key={p.participant_id} className="rounded-xl border bg-card p-4 shadow-sm">
                      <div className="flex gap-3">
                        <div
                          className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: `linear-gradient(135deg, hsl(${hue},55%,45%), hsl(${(hue + 40) % 360},55%,35%))` }}
                        >
                          {initials(display)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium truncate">{display}</span>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {p.role}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {p.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Verification: <span className="text-foreground">{verificationLabelForSubject(p.account_id)}</span>
                          </p>
                          {isOrganizer ? renderCoveragePills(s) : null}
                          {isOrganizer && p.role === 'participant' && !s?.has_any_policy ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              disabled={busy}
                              onClick={() => void remindParticipant(p.account_id)}
                            >
                              Remind {display.split(' ')[0] || 'participant'} to upload a policy
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <Separator className="my-3" />
                      <div className="flex flex-wrap gap-2">
                        <Input
                          defaultValue={p.residence_country_code || ''}
                          placeholder="Country (ISO)"
                          className="h-8 text-xs max-w-[140px]"
                          onBlur={(e) => void updateResidence(p.participant_id, { residence_country_code: e.target.value.trim() || null })}
                        />
                        <Input
                          defaultValue={p.residence_state_code || ''}
                          placeholder="State (US)"
                          className="h-8 text-xs max-w-[120px]"
                          onBlur={(e) => void updateResidence(p.participant_id, { residence_state_code: e.target.value.trim() || null })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!isOrganizer && recommendations[0] ? (
        <CoverageRequirementCard
          recommendation={recommendations[0]}
          response={recResponse}
          addOnSummary={
            user?.id
              ? (recommendations[0] as { add_on_notes?: Record<string, { summary?: string }> }).add_on_notes?.[user.id]?.summary
              : undefined
          }
          onUpdated={() => void load()}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" variant="default" disabled={!governedFeatureEnabled.inviteFlow} onClick={() => document.getElementById('invite-panel')?.scrollIntoView({ behavior: 'smooth' })}>
            Invite participant
          </Button>
          {isOrganizer ? (
            <Button type="button" variant="secondary" onClick={() => setRecSheetOpen(true)}>
              Recommend coverage
            </Button>
          ) : null}
          {isOrganizer ? (
            <Button type="button" variant="outline" onClick={() => setChecklistOpen((v) => !v)}>
              {checklistOpen ? 'Hide' : 'View'} checklist status
            </Button>
          ) : null}
          {isOrganizer ? (
            <Button type="button" variant="outline" onClick={() => setExportPanelOpen((v) => !v)}>
              {exportPanelOpen ? 'Hide' : 'Manage'} export permissions
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {checklistOpen && isOrganizer ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Checklist status (aggregate)</CardTitle>
            <CardDescription>Per-participant completion % only — no document contents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {participants
              .filter((p) => p.status === 'active')
              .map((p) => {
                const s = summaryByAccount.get(p.account_id);
                return (
                  <div key={p.participant_id} className="flex justify-between text-sm border rounded-md px-3 py-2">
                    <span>{nameByAccount.get(p.account_id) || 'Traveler'}</span>
                    <span className="text-muted-foreground">{s?.checklist_completion_pct ?? '—'}%</span>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      ) : null}

      {exportPanelOpen && isOrganizer ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export authorization grants</CardTitle>
            <CardDescription>Active grants for this trip (subjects who allowed organizer export).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {exportGrants.filter((g) => g.status === 'active').length === 0 ? (
                <li className="text-muted-foreground">No active grants.</li>
              ) : (
                exportGrants
                  .filter((g) => g.status === 'active')
                  .map((g) => (
                    <li key={g.grant_id}>
                      Subject <span className="font-mono text-xs">{g.subject_id.slice(0, 8)}…</span>
                    </li>
                  ))
              )}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <ItinerarySharingSettings tripId={tripId} supabase={supabase} initial={sharingInitial} />

      {sharedSharers.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Shared from group</h2>
          {sharedSharers.map((s) => (
            <SharedItineraryView key={s.account_id} tripId={tripId} sharerName={s.display_name} dayLabel="this trip" activities={s.activities} />
          ))}
        </div>
      ) : null}

      <div id="invite-panel" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite participant</CardTitle>
            <CardDescription>
              Trip type sets verification expiry: family 24h · school 48h (dual guardian where required) · corporate 7d · friend 24h.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_200px_auto] sm:items-end">
              <div>
                <label className="text-xs text-muted-foreground">Subject account UUID</label>
                <Input value={subjectIdInput} onChange={(e) => setSubjectIdInput(e.target.value)} placeholder="Subject account UUID" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Trip type</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={tripType}
                  onChange={(e) => setTripType(e.target.value as typeof tripType)}
                >
                  <option value="family">Family (24h)</option>
                  <option value="school">School (48h)</option>
                  <option value="corporate">Corporate (168h)</option>
                  <option value="friend_group">Friend group (24h)</option>
                </select>
              </div>
              <Button type="button" disabled={busy || !governedFeatureEnabled.inviteFlow} onClick={() => void requestAdd()}>
                {busy ? 'Sending…' : 'Request add'}
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={requiresGuardian} onChange={(e) => setRequiresGuardian(e.target.checked)} />
              Minor account (guardian also required)
            </label>
            {requiresGuardian || tripType === 'school' ? (
              <Input
                value={guardianIdInput}
                onChange={(e) => setGuardianIdInput(e.target.value)}
                placeholder="Guardian account UUID (required for school / minors)"
              />
            ) : null}
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </CardContent>
        </Card>
      </div>

      {!hideGenericVerification ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verification requests</CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No verification requests yet.</p>
            ) : (
              <ScrollArea className="h-48 pr-3">
                <div className="space-y-2">
                  {pending.map((r) => (
                    <div key={r.request_id} className="rounded-md border p-3 text-sm">
                      <p className="text-muted-foreground">
                        {r.status.toUpperCase()} · type {r.trip_type || '—'} · subject{' '}
                        <span className="font-mono text-xs">{r.subject_id.slice(0, 8)}…</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Expires {new Date(r.expires_at).toLocaleString()}</p>
                      {(r.requires_dual_approval || r.trip_type === 'school') && (
                        <p className="text-xs mt-1">
                          Subject: {r.subject_approved ? 'yes' : 'no'} · Guardian: {r.guardian_approved ? 'yes' : 'no'}
                        </p>
                      )}
                      {r.status === 'pending' ? (
                        <div className="flex gap-2 mt-2">
                          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void resolveRequest(r.request_id, 'approve')}>
                            Approve
                          </Button>
                          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void resolveRequest(r.request_id, 'deny')}>
                            Deny
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      ) : null}

      {isOrganizer ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export authorization</CardTitle>
            <CardDescription>Explicit grants only — subjects or trusted allies must approve.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input value={subjectExportId} onChange={(e) => setSubjectExportId(e.target.value)} placeholder="Subject account UUID" className="max-w-md" />
              <Button type="button" disabled={grantBusy || !governedFeatureEnabled.exportAuth} onClick={() => void grantExport()}>
                {grantBusy ? 'Saving…' : 'Grant export'}
              </Button>
              <Button type="button" variant="destructive" disabled={revokeBusy || !governedFeatureEnabled.exportAuth} onClick={() => void revokeExport()}>
                {revokeBusy ? 'Revoking…' : 'Revoke export'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <CoverageRecommendationSheet
        open={recSheetOpen}
        onOpenChange={setRecSheetOpen}
        tripId={tripId}
        participants={rosterForRec}
        itineraryActivityNames={activityNames}
        onComplete={() => void load()}
      />
    </div>
    </AppPageRoot>
  );
}
