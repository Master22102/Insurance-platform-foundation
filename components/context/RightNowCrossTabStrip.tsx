'use client';

import { useRouter } from 'next/navigation';
import type { ContextAction, ContextResult } from '@/lib/context-engine/types';

function urgencyStripStyles(urgency: ContextResult['urgency']): { border: string; background: string } {
  if (urgency === 'urgent') return { border: '#fecaca', background: '#fef2f2' };
  if (urgency === 'attention') return { border: '#fcd34d', background: '#fffbeb' };
  return { border: '#bfdbfe', background: '#eff6ff' };
}

export function shouldShowRightNowStrip(context: ContextResult | null, loading?: boolean): boolean {
  if (loading || !context) return false;
  if (context.metadata?.feature_off) return false;
  if (!context.headline && context.actions.length === 0 && context.state === 'quiet_day' && context.metadata?.hidden) {
    return false;
  }
  return true;
}

export interface RightNowCrossTabStripProps {
  tripId: string;
  context: ContextResult | null;
  loading?: boolean;
  onOpenOverview: () => void;
  onDismiss: (contextKey: string) => void;
  onCreateIncident: (tripId: string, pre: Record<string, unknown>) => Promise<string | null>;
  onContextRefresh: () => void;
}

/**
 * Slim reminder when the user is not on Overview — reuses the same context payload as RightNowPanel.
 */
export default function RightNowCrossTabStrip({
  tripId,
  context,
  loading,
  onOpenOverview,
  onDismiss,
  onCreateIncident,
  onContextRefresh,
}: RightNowCrossTabStripProps) {
  const router = useRouter();

  if (!shouldShowRightNowStrip(context, loading) || !context) return null;

  const st = urgencyStripStyles(context.urgency);
  const primary =
    context.actions.find((a) => a.variant === 'primary') || context.actions[0];

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
      data-testid="right-now-cross-tab-strip"
      style={{
        marginBottom: 16,
        padding: '10px 14px',
        borderRadius: 10,
        border: `1px solid ${st.border}`,
        background: st.background,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>RIGHT NOW</p>
        {context.headline ? (
          <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.35 }}>{context.headline}</p>
        ) : (
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#475569' }}>Context available for this trip.</p>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={onOpenOverview}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: 'white',
            fontSize: 12,
            fontWeight: 600,
            color: '#1A2B4A',
            cursor: 'pointer',
          }}
        >
          Full card · Overview
        </button>
        {context.state === 'defer_protect' ? (
          <button
            type="button"
            onClick={() => {
              onOpenOverview();
              onContextRefresh();
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#1A2B4A',
              fontSize: 12,
              fontWeight: 600,
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Open steps on Overview
          </button>
        ) : primary ? (
          <button
            type="button"
            onClick={() => void runAction(primary)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#1A2B4A',
              fontSize: 12,
              fontWeight: 600,
              color: 'white',
              cursor: 'pointer',
            }}
          >
            {primary.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
