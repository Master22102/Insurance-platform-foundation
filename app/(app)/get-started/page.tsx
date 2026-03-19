'use client';

import Link from 'next/link';

export default function GetStartedPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A2B4A', margin: '0 0 10px', letterSpacing: '-0.6px' }}>
        Let&apos;s get started
      </h1>
      <p style={{ fontSize: 14, color: '#555', margin: '0 0 22px', lineHeight: 1.6 }}>
        Add a trip, add a policy, or start planning. You can do one now and the other later.
      </p>

      <div style={{ display: 'grid', gap: 12 }}>
        <Link href="/trips" style={{
          background: 'white', border: '1px solid #eaeaea', borderRadius: 14, padding: '16px 16px',
          textDecoration: 'none', color: '#1A2B4A',
        }}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4 }}>Add a trip itinerary</div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>Upload, import, paste, or enter your itinerary.</div>
        </Link>

        <Link href="/policies/upload" style={{
          background: 'white', border: '1px solid #eaeaea', borderRadius: 14, padding: '16px 16px',
          textDecoration: 'none', color: '#1A2B4A',
        }}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4 }}>Add an insurance policy</div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>Upload a policy PDF or enter details manually.</div>
        </Link>

        <Link href="/trips" style={{
          background: '#f7f8fa', border: '1px solid #eaeaea', borderRadius: 14, padding: '16px 16px',
          textDecoration: 'none', color: '#1A2B4A',
        }}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4 }}>I&apos;m still planning</div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>Create a trip when you&apos;re ready.</div>
        </Link>
      </div>
    </div>
  );
}

