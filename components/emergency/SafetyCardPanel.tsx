'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { colors, radii, touch } from '@/lib/styles/tokens';

function PanelSection({
  title,
  isMobile,
  open,
  onToggle,
  children,
}: {
  title: string;
  isMobile: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  if (!isMobile) {
    return (
      <div style={{ marginBottom: 10 }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: colors.textSecondary }}>{title}</p>
        {children}
      </div>
    );
  }
  return (
    <div
      style={{
        marginBottom: 8,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.md,
        overflow: 'hidden',
        background: colors.backgroundSecondary,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 14px',
          minHeight: touch.minTap,
          border: 'none',
          background: colors.backgroundSecondary,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 700,
          color: colors.navy,
          textAlign: 'left',
        }}
      >
        {title}
        <span aria-hidden style={{ fontSize: 11, color: colors.textTertiary, flexShrink: 0 }}>
          {open ? '▼' : '▶'}
        </span>
      </button>
      {open ? <div style={{ padding: '0 12px 12px', background: colors.backgroundPrimary }}>{children}</div> : null}
    </div>
  );
}

export default function SafetyCardPanel({ tripId }: { tripId?: string }) {
  const isMobile = useIsMobile();
  const [qrUrl, setQrUrl] = useState<string>('');
  const [lang, setLang] = useState('en');
  const [ctx, setCtx] = useState<any>(null);
  const [langOpen, setLangOpen] = useState(true);
  const [cardOpen, setCardOpen] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(true);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/safety${tripId ? `?trip_id=${encodeURIComponent(tripId)}` : ''}`;
  }, [tripId]);

  useEffect(() => {
    if (!shareUrl) return;
    QRCode.toDataURL(shareUrl, { width: 180, margin: 1 }).then(setQrUrl).catch(() => setQrUrl(''));
  }, [shareUrl]);

  useEffect(() => {
    const q = new URLSearchParams();
    if (tripId) q.set('trip_id', tripId);
    q.set('lang', lang);
    fetch(`/api/safety-card/context?${q.toString()}`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setCtx)
      .catch(() => setCtx(null));
  }, [tripId, lang]);

  const selectStyle = {
    padding: '12px 14px',
    borderRadius: radii.md,
    border: `1px solid ${colors.border}`,
    fontSize: 15,
    minHeight: touch.inputMinHeight,
    width: '100%',
    maxWidth: isMobile ? '100%' : 280,
    background: colors.backgroundPrimary,
  } as const;

  const actionBtnStyle = {
    border: `1px solid ${colors.border}`,
    background: colors.backgroundPrimary,
    borderRadius: radii.md,
    padding: '12px 14px',
    fontSize: 13,
    fontWeight: 700 as const,
    minHeight: touch.minTap,
    cursor: 'pointer' as const,
  };

  const shareBtnStyle = {
    ...actionBtnStyle,
    border: `1px solid #bfdbfe`,
    background: '#eff6ff',
    color: '#1e3a8a',
  };

  const langQrBody = (
    <>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'block', fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Language</label>
        <select data-testid="safety-card-language" value={lang} onChange={(e) => setLang(e.target.value)} style={selectStyle}>
          <option value="en">English</option>
          <option value="ja">Japanese</option>
          <option value="th">Thai</option>
          <option value="es">Spanish</option>
        </select>
      </div>
      {qrUrl ? (
        <img data-testid="safety-card-qr" src={qrUrl} alt="Safety card QR code" style={{ width: 140, height: 140, borderRadius: radii.md }} />
      ) : null}
    </>
  );

  const cardBody =
    ctx?.labels ? (
      <div style={{ marginTop: isMobile ? 0 : 10, border: `1px solid #e2e8f0`, borderRadius: radii.md, padding: 10, background: '#f8fafc' }}>
        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#334155' }}>{ctx.labels.card_title?.local_text || 'Traveler safety card'}</p>
        <p style={{ margin: '0 0 4px', fontSize: 12, color: '#334155' }}>
          {ctx.labels.emergency_contact?.local_text || 'Emergency contact'}: {ctx.profile?.emergency_contact_name || 'Not set'}
        </p>
        {Array.isArray(ctx.profile?.allergies) && ctx.profile.allergies.length > 0 ? (
          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#334155' }}>
            {ctx.labels.allergies?.local_text || 'Allergies'}: {ctx.profile.allergies.join(', ')}
          </p>
        ) : null}
        {ctx.labels.i_need_help ? (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#0f172a' }}>
            &quot;{ctx.labels.i_need_help.local_text}&quot;
            {ctx.labels.i_need_help.romanization ? ` (${ctx.labels.i_need_help.romanization})` : ''}
          </p>
        ) : null}
      </div>
    ) : (
      <p style={{ margin: 0, fontSize: 12, color: colors.textTertiary }}>Card details load when profile data is available.</p>
    );

  const actionsBody = (
    <div style={{ marginTop: isMobile ? 0 : 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" onClick={() => window.print()} data-testid="safety-card-print" style={actionBtnStyle}>
        Print card
      </button>
      <button
        type="button"
        onClick={async () => {
          if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            await navigator.share({ title: 'Safety card', url: shareUrl }).catch(() => {});
          } else {
            await navigator.clipboard.writeText(shareUrl).catch(() => {});
          }
          void fetch('/api/emergency/action-log', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'share',
              method: typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? 'native' : 'copy_link',
              trip_id: tripId,
            }),
          });
        }}
        data-testid="safety-card-share"
        style={shareBtnStyle}
      >
        Share
      </button>
    </div>
  );

  return (
    <div
      data-testid="safety-card-panel"
      style={{ background: colors.backgroundPrimary, border: `1px solid ${colors.border}`, borderRadius: radii.lg, padding: 14 }}
    >
      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: colors.navy }}>Trip safety card</p>
      <p style={{ margin: '6px 0 10px', fontSize: 12, color: colors.textSecondary }}>Keep this visible for quick communication in emergencies.</p>

      <PanelSection title="Language & QR" isMobile={isMobile} open={langOpen} onToggle={() => setLangOpen((v) => !v)}>
        {langQrBody}
      </PanelSection>
      <PanelSection title="Card content" isMobile={isMobile} open={cardOpen} onToggle={() => setCardOpen((v) => !v)}>
        {cardBody}
      </PanelSection>
      <PanelSection title="Print & share" isMobile={isMobile} open={actionsOpen} onToggle={() => setActionsOpen((v) => !v)}>
        {actionsBody}
      </PanelSection>
    </div>
  );
}
