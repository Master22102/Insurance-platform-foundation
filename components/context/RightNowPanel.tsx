'use client';

import { useRouter } from 'next/navigation';
import type { ContextAction, ContextResult } from '@/lib/context-engine/types';
import DeferProtectPanel from './DeferProtectPanel';

export interface RightNowPanelProps {
  tripId: string;
  context: ContextResult | null;
  loading?: boolean;
  actorId: string;
  onDismiss: (contextKey: string) => void;
  onCreateIncident: (tripId: string, prePopulate: Record<string, unknown>) => Promise<string | null>;
  onContextRefresh: () => void;
}

function urgencyStyles(urgency: ContextResult['urgency']): { border: string; background: string; icon: string } {
  if (urgency === 'urgent') {
    return { border: '#fecaca', background: '#fef2f2', icon: '#b91c1c' };
  }
  if (urgency === 'attention') {
    return { border: '#fcd34d', background: '#fffbeb', icon: '#b45309' };
  }
  return { border: '#bfdbfe', background: '#eff6ff', icon: '#1d4ed8' };
}

export default function RightNowPanel({
  tripId,
  context,
  loading,
  actorId,
  onDismiss,
  onCreateIncident,
  onContextRefresh,
}: RightNowPanelProps) {
  const router = useRouter();

  if (loading || !context) return null;
  if (context.metadata?.feature_off) return null;
  if (!context.headline && context.actions.length === 0 && context.state === 'quiet_day' && context.metadata?.hidden) {
    return null;
  }

  const checklistItems = (context.metadata?.checklist_items as string[] | undefined) || [];

  const st = urgencyStyles(context.urgency);
  const incidentIdDefer = context.metadata?.incident_id as string | undefined;
  const uncategorized = Number(context.metadata?.uncategorized_count ?? 0);

  const runAction = async (a: ContextAction) => {
    if (a.type === 'navigate' && a.href) {
      router.push(a.href);
      return;
    }
    if (a.type === 'dismiss' && context.dismissKey) {
      onDismiss(context.dismissKey);
      return;
    }
    if (a.type === 'create_incident') {
      const pre = (context.metadata?.create_incident_prefill as Record<string, unknown>) || {};
      const newId = await onCreateIncident(tripId, pre);
      if (newId) router.push(`/trips/${tripId}/incidents/${newId}`);
    }
  };

  return (
    <div
      data-testid="right-now-panel"
      style={{
        marginBottom: 20,
        borderRadius: 14,
        border: `2px solid ${st.border}`,
        background: st.background,
        padding: '16px 18px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative',
      }}
    >
      {context.dismissible && context.dismissKey ? (
        <button
          type="button"
          aria-label="Dismiss"
          data-testid="right-now-dismiss"
          onClick={() => onDismiss(context.dismissKey!)}
          style={{
            position: 'absolute',
            top: 10,
            right: 12,
            border: 'none',
            background: 'transparent',
            fontSize: 22,
            lineHeight: 1,
            cursor: 'pointer',
            color: '#64748b',
          }}
        >
          ×
        </button>
      ) : null}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingRight: context.dismissible ? 28 : 0 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 2 }}>
          <circle cx="12" cy="12" r="10" stroke={st.icon} strokeWidth="1.6" />
          <path d="M12 8v5M12 16h.01" stroke={st.icon} strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: '0 0 4px',
              fontSize: 15,
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            Right now
          </p>
          {context.headline ? (
            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#1A2B4A' }}>{context.headline}</p>
          ) : null}
          {context.subheadline ? (
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{context.subheadline}</p>
          ) : null}

          {checklistItems.length > 0 ? (
            <ul
              data-testid="right-now-checklist"
              style={{ margin: '0 0 12px', paddingLeft: 0, listStyle: 'none', fontSize: 12, color: '#334155' }}
            >
              {checklistItems.map((item) => (
                <li key={item} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ flexShrink: 0, opacity: 0.45 }}>☐</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {context.state === 'defer_protect' && incidentIdDefer ? (
            <DeferProtectPanel
              tripId={tripId}
              incidentId={incidentIdDefer}
              actorId={actorId}
              uncategorizedCount={uncategorized}
              onCaptured={onContextRefresh}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {context.actions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  data-testid={`right-now-action-${a.id}`}
                  onClick={() => void runAction(a)}
                  style={{
                    alignSelf: 'flex-start',
                    padding: a.variant === 'primary' ? '10px 16px' : '8px 14px',
                    borderRadius: 10,
                    border: a.variant === 'primary' ? 'none' : '1px solid #cbd5e1',
                    background: a.variant === 'primary' ? '#1A2B4A' : 'white',
                    color: a.variant === 'primary' ? 'white' : '#1e293b',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
