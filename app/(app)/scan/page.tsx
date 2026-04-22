'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import QuickScanResult from '@/components/scan/QuickScanResult';
import Link from 'next/link';

const STATUS_MESSAGES = [
  'Reading your document…',
  'Finding coverage rules…',
  'Almost done…',
];

const LIFETIME_SCAN_CAP = 2;

export default function ScanPage() {
  const { user, getLifetimeScansRemaining, isAtLifetimeCap } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const scansRemaining = getLifetimeScansRemaining();
  const atCap = isAtLifetimeCap();

  const selectFile = (f: File) => {
    if (!['application/pdf', 'text/plain'].includes(f.type) && !f.name.endsWith('.txt')) {
      setError("That file type isn't supported. Try a PDF or plain text file.");
      return;
    }
    setError('');
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) selectFile(f);
  };

  const runScan = async () => {
    if (!file || !user) return;
    setUploading(true);
    setStatusIdx(0);
    setProgress(10);
    setError('');

    const cycle = setInterval(() => {
      setStatusIdx((prev) => (prev + 1) % STATUS_MESSAGES.length);
      setProgress((prev) => Math.min(prev + 20, 85));
    }, 1400);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('account_id', user.id);

      const res = await fetch('/api/quick-scan', { method: 'POST', body: formData });
      clearInterval(cycle);

      if (!res.ok) { throw new Error('Scan failed'); }
      const data = await res.json();
      setProgress(100);
      setResult(data);
    } catch {
      clearInterval(cycle);
      setError('Something went wrong with the scan. Try again or use a different file.');
    }

    setUploading(false);
  };

  if (atCap && !result) {
    return (
      <div style={{ maxWidth: 560, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 8px', letterSpacing: '-0.3px' }}>
          Quick Scan
        </h1>
        <p style={{ fontSize: 14, color: '#888', margin: '0 0 28px', lineHeight: 1.5 }}>
          You've used your free scans.
        </p>
        <div style={{
          background: 'white', border: '0.5px solid #e8e8e8',
          borderRadius: 12, padding: '22px 24px',
        }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#1A2B4A', margin: '0 0 10px' }}>
            Unlock a trip to get the full picture
          </p>
          <p style={{ fontSize: 13, color: '#666', margin: '0 0 18px', lineHeight: 1.6 }}>
            Coverage overlap analysis, claim routing guidance, and a ready-to-file packet.
          </p>
          <Link href="/trips" style={{
            display: 'inline-block', padding: '10px 20px',
            background: '#1A2B4A', color: 'white',
            borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600,
          }}>
            Unlock a trip — $14.99
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 580, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px', letterSpacing: '-0.3px' }}>
          Quick Scan
        </h1>
        <p style={{ fontSize: 14, color: '#888', margin: 0, lineHeight: 1.5 }}>
          Upload a travel insurance policy, credit card benefit guide, or airline contract. We'll show you what coverage rules we find.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, padding: 4, background: '#f7f8fa', border: '1px solid #eaeaea', borderRadius: 10, width: 'fit-content' }}>
        <span style={{ padding: '6px 14px', background: 'white', color: '#1A2B4A', borderRadius: 7, fontSize: 13, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          Quick Scan
        </span>
        <Link href="/deep-scan" style={{ padding: '6px 14px', color: '#666', borderRadius: 7, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
          Deep Scan
        </Link>
      </div>

      {!atCap && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 20, fontSize: 13, color: '#555',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#888" strokeWidth="1.6"/>
            <path d="M12 8v4" stroke="#888" strokeWidth="1.7" strokeLinecap="round"/>
            <circle cx="12" cy="16" r="1" fill="#888"/>
          </svg>
          <span>
            <strong style={{ color: '#1A2B4A' }}>{scansRemaining}</strong> of {LIFETIME_SCAN_CAP} free scans remaining
          </span>
        </div>
      )}

      {!result && (
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '24px 22px', marginBottom: 16 }}>
          {!uploading ? (
            <>
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragOver ? '#2E5FA3' : '#ddd'}`,
                  borderRadius: 12, padding: '36px 20px',
                  textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? '#f0f4ff' : '#fafafa',
                  transition: 'all 0.15s ease',
                  marginBottom: file ? 16 : 0,
                }}
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 10px', display: 'block' }}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="#888" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="17 8 12 3 7 8" stroke="#888" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="3" x2="12" y2="15" stroke="#888" strokeWidth="1.7" strokeLinecap="round"/>
                </svg>
                <p style={{ fontSize: 14, color: '#555', margin: '0 0 4px', fontWeight: 500 }}>
                  Drop your file here, or <span style={{ color: '#2E5FA3' }}>browse</span>
                </p>
                <p style={{ fontSize: 12, color: '#bbb', margin: 0 }}>PDF or plain text accepted</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.txt,text/plain,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) selectFile(f); }}
              />

              {file && (
                <div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', background: '#f7f8fa',
                    border: '1px solid #f0f0f0', borderRadius: 8, marginBottom: 12,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="#888" strokeWidth="1.5"/>
                      <path d="M8 8h8M8 12h5" stroke="#888" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    <span style={{ fontSize: 13, color: '#333', flex: 1 }}>{file.name}</span>
                    <button onClick={() => setFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 16 }}>×</button>
                  </div>
                  <button onClick={runScan} style={{
                    width: '100%', padding: '11px 0',
                    background: '#1A2B4A', color: 'white',
                    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}>
                    Scan this document
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '16px 0', textAlign: 'center' }}>
              <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, marginBottom: 14 }}>
                <div style={{
                  height: '100%', background: '#2E5FA3',
                  borderRadius: 2, width: `${progress}%`,
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <p style={{ fontSize: 14, color: '#555', margin: 0 }}>
                {STATUS_MESSAGES[statusIdx]}
              </p>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: 12, padding: '10px 14px',
              background: '#fef9f0', border: '1px solid #fde68a',
              borderRadius: 8, fontSize: 13, color: '#92400e',
            }}>
              {error}
            </div>
          )}
        </div>
      )}

      {result && <QuickScanResult result={result} />}
    </div>
  );
}
