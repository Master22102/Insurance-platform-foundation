'use client';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#fafafa',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <span style={{
          fontSize: 22,
          fontWeight: 700,
          color: '#1A2B4A',
          letterSpacing: '-0.5px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          Wayfarer
        </span>
      </div>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'white',
        border: '1px solid #e8e8e8',
        borderRadius: 16,
        padding: '32px 28px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
      }}>
        {children}
      </div>
    </div>
  );
}
