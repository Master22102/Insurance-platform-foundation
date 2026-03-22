import Link from 'next/link';

export default function SplashStep0() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #0d1b2a 0%, #0f2518 55%, #0d1b2a 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '96px 24px 72px',
        color: 'white',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(ellipse at 20% 50%, rgba(46,95,163,0.22) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(22,163,74,0.18) 0%, transparent 50%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 999,
            padding: '8px 16px',
            marginBottom: 24,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: '#4ade80',
              boxShadow: '0 0 0 4px rgba(74,222,128,0.18)',
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.08em' }}>
            Step 0
          </span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(34px, 5vw, 62px)',
            fontWeight: 900,
            margin: '0 0 16px',
            letterSpacing: '-1.4px',
            lineHeight: 1.05,
          }}
        >
          Travel plans can change.
        </h1>
        <p
          style={{
            fontSize: 'clamp(17px, 2.1vw, 22px)',
            color: 'rgba(255,255,255,0.88)',
            margin: '0 auto 12px',
            lineHeight: 1.45,
            maxWidth: 600,
            fontWeight: 600,
          }}
        >
          Your decisions don&apos;t have to be.
        </p>
        <p
          style={{
            fontSize: 'clamp(15px, 1.9vw, 18px)',
            color: 'rgba(255,255,255,0.62)',
            margin: '0 auto 34px',
            lineHeight: 1.65,
            maxWidth: 600,
          }}
        >
          Wayfarer structures your policies, itinerary, and incidents so you can document and route what comes next without predicting outcomes. You can start by adding a trip or a policy.
        </p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/terms-consent?next=/signup"
            style={{
              padding: '14px 30px',
              background: 'white',
              color: '#1A2B4A',
              borderRadius: 12,
              textDecoration: 'none',
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: '-0.2px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.22)',
              display: 'inline-block',
            }}
          >
            Let&apos;s get started
          </Link>
          <Link
            href="/terms-consent?next=/signin"
            style={{
              padding: '14px 30px',
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.9)',
              borderRadius: 12,
              textDecoration: 'none',
              fontSize: 16,
              fontWeight: 700,
              border: '1px solid rgba(255,255,255,0.18)',
              display: 'inline-block',
            }}
          >
            Log in
          </Link>
        </div>

        <p style={{ margin: '20px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
          You can always change your trip details later. Nothing is committed until you confirm.
        </p>
      </div>
    </div>
  );
}

