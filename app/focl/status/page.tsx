'use client';

import Link from 'next/link';

export default function FoclStatusPage() {
  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '18px 16px 28px' }}>
      <h1 style={{ margin: 0, fontSize: 22, color: '#111827' }}>Status</h1>
      <p style={{ margin: '8px 0 12px', fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
        Platform posture and operating health. Detailed readiness signals are available in Readiness Board.
      </p>
      <Link href="/focl/readiness" style={{ fontSize: 13, color: '#1f4f99', textDecoration: 'none' }}>
        Open Readiness Board
      </Link>
    </div>
  );
}
