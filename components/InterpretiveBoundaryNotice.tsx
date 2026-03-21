'use client';

interface InterpretiveBoundaryNoticeProps {
  compact?: boolean;
}

export default function InterpretiveBoundaryNotice({ compact = false }: InterpretiveBoundaryNoticeProps) {
  return (
    <div
      style={{
        background: compact ? '#f8fafc' : '#f7f8fa',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: compact ? '10px 12px' : '12px 14px',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: compact ? 11 : 12,
          color: '#475569',
          lineHeight: 1.5,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        Final determination is made by the benefit administrator, card issuer, or insurer. We cannot
        predict their decision.
      </p>
    </div>
  );
}
