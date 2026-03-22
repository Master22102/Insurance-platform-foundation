'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/auth/supabase-client';
import { useAuth } from '@/lib/auth/auth-context';

type GroupParticipant = {
  participant_id: string;
  account_id: string;
  role: 'organizer' | 'participant';
  status: 'invited' | 'active' | 'revoked' | 'archived';
  residence_country_code: string | null;
  residence_state_code: string | null;
  created_at: string;
};

type PendingRequest = {
  request_id: string;
  requester_id?: string;
  subject_id: string;
  guardian_id?: string | null;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  subject_approved?: boolean;
  guardian_approved?: boolean;
  requires_dual_approval?: boolean;
  expires_at: string;
  created_at: string;
};

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

  const load = useCallback(async () => {
    if (!user || !tripId) return;
    setLoading(true);
    const [participantRes, pendingRes] = await Promise.all([
      supabase
        .from('group_participants')
        .select('participant_id, account_id, role, status, residence_country_code, residence_state_code, created_at')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true }),
      supabase
        .from('relationship_verification_requests')
        .select('request_id, requester_id, subject_id, guardian_id, status, requires_dual_approval, subject_approved, guardian_approved, expires_at, created_at')
        .eq('trip_id', tripId)
        .in('status', ['pending', 'approved', 'denied', 'expired'])
        .order('created_at', { ascending: false })
        .limit(25),
    ]);
    setParticipants((participantRes.data || []) as GroupParticipant[]);
    setPending((pendingRes.data || []) as PendingRequest[]);
    const organizer = (participantRes.data || []).find((p: any) => p.role === 'organizer' && p.status === 'active');
    setOrganizerId(String(organizer?.account_id || user.id));
    setLoading(false);
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
        supabase
          .from('feature_activation_state')
          .select('feature_id, enabled')
          .eq('region_id', region)
          .in('feature_id', featureIds),
        supabase
          .from('feature_registry')
          .select('feature_id, default_enabled')
          .in('feature_id', featureIds),
      ]);
      const activation = new Map((activationRes.data || []).map((r: any) => [r.feature_id, Boolean(r.enabled)]));
      const defaults = new Map((registryRes.data || []).map((r: any) => [r.feature_id, Boolean(r.default_enabled)]));
      const isEnabled = (id: string) => activation.has(id) ? activation.get(id)! : (defaults.get(id) ?? true);
      setGovernedFeatureEnabled({
        inviteFlow: isEnabled('F-2.0.12-INVITES'),
        exportAuth: isEnabled('F-2.0.6-EXPORT-AUTH'),
      });
    };
    void loadGovernance();
  }, [user]);

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
      p_requires_guardian_approval: requiresGuardian,
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
        : requiresGuardian
          ? 'Verification request sent. Minor + guardian approvals are required.'
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

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href={`/trips/${tripId}`} style={{ fontSize: 13, color: '#64748b', textDecoration: 'none' }}>
        ← Back to trip
      </Link>

      <h1 style={{ fontSize: 24, color: '#1A2B4A', margin: '12px 0 6px' }}>Group authority & participants</h1>
      <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.55 }}>
        Organizer controls coordination only. Participant adds require verified relationship or explicit subject approval.
      </p>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
        FOCL governance: invites {governedFeatureEnabled.inviteFlow ? 'enabled' : 'staged off'} · export auth {governedFeatureEnabled.exportAuth ? 'enabled' : 'staged off'}.
      </p>

      <div style={{ marginTop: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
          Active participants: <strong>{readiness.activeCount}</strong> · Missing residence profiles: <strong>{readiness.missingCount}</strong>
        </p>
      </div>

      <div style={{ marginTop: 14, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Invite participant
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px auto', gap: 8 }}>
          <input
            value={subjectIdInput}
            onChange={(e) => setSubjectIdInput(e.target.value)}
            placeholder="Subject account UUID"
            style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
          />
          <select
            value={tripType}
            onChange={(e) => setTripType(e.target.value as any)}
            style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
          >
            <option value="family">Family</option>
            <option value="school">School</option>
            <option value="corporate">Corporate</option>
            <option value="friend_group">Friend group</option>
          </select>
          <button
            type="button"
            onClick={requestAdd}
            disabled={busy || !governedFeatureEnabled.inviteFlow}
            style={{ border: 'none', background: '#1A2B4A', color: 'white', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {busy ? 'Sending...' : 'Request add'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#475569' }}>
            <input
              type="checkbox"
              checked={requiresGuardian}
              onChange={(e) => setRequiresGuardian(e.target.checked)}
            />
            Minor account (guardian also required)
          </label>
          {requiresGuardian && (
            <input
              value={guardianIdInput}
              onChange={(e) => setGuardianIdInput(e.target.value)}
              placeholder="Guardian account UUID"
              style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 12, minWidth: 240 }}
            />
          )}
        </div>
        {message && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#475569' }}>{message}</p>}
      </div>

      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        {loading ? (
          <p style={{ fontSize: 13, color: '#64748b' }}>Loading participants...</p>
        ) : participants.length === 0 ? (
          <p style={{ fontSize: 13, color: '#64748b' }}>No participants yet.</p>
        ) : (
          participants.map((p) => (
            <div key={p.participant_id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px' }}>
              <p style={{ margin: '0 0 6px', fontSize: 13, color: '#1f2937' }}>
                <strong>{p.role}</strong> · {p.status} · {p.account_id}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  defaultValue={p.residence_country_code || ''}
                  placeholder="Country (ISO, e.g. US)"
                  onBlur={(e) => void updateResidence(p.participant_id, { residence_country_code: e.target.value.trim() || null })}
                  style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '6px 8px', fontSize: 12, width: 180 }}
                />
                <input
                  defaultValue={p.residence_state_code || ''}
                  placeholder="State (required if US)"
                  onBlur={(e) => void updateResidence(p.participant_id, { residence_state_code: e.target.value.trim() || null })}
                  style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '6px 8px', fontSize: 12, width: 180 }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 16, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Export authorization
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8 }}>
          <input
            value={subjectExportId}
            onChange={(e) => setSubjectExportId(e.target.value)}
            placeholder="Subject account UUID"
            style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
          />
          <button
            type="button"
            onClick={grantExport}
            disabled={grantBusy || !governedFeatureEnabled.exportAuth}
            style={{ border: 'none', background: '#0f766e', color: 'white', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {grantBusy ? 'Saving...' : 'Grant export'}
          </button>
          <button
            type="button"
            onClick={revokeExport}
            disabled={revokeBusy || !governedFeatureEnabled.exportAuth}
            style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {revokeBusy ? 'Revoking...' : 'Revoke export'}
          </button>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
          Exports are never implicit. Subject (adult) or Trusted Ally (minor) must explicitly grant first.
        </p>
      </div>

      <div style={{ marginTop: 16, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Verification requests
        </p>
        {pending.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No verification requests yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {pending.map((r) => (
              <div key={r.request_id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
                <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                  {r.status.toUpperCase()} · subject {r.subject_id}
                  {r.requires_dual_approval ? ' · dual approval' : ''}
                  {' · '}expires {new Date(r.expires_at).toLocaleString()}
                </p>
                {(r.subject_approved || r.guardian_approved || r.requires_dual_approval) && (
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>
                    Subject approved: {r.subject_approved ? 'yes' : 'no'} · Guardian approved: {r.guardian_approved ? 'yes' : 'no'}
                  </p>
                )}
                {r.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => void resolveRequest(r.request_id, 'approve')}
                      disabled={busy}
                      style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void resolveRequest(r.request_id, 'deny')}
                      disabled={busy}
                      style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Deny
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

