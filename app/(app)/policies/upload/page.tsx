'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

const PROCESSING_MESSAGES = [
  'Processing your document…',
  'Finding coverage rules…',
  'Checking exclusions…',
  'Almost done…',
];

const SOURCE_TYPES = [
  { value: 'travel_insurance', label: 'Travel insurance policy' },
  { value: 'credit_card_benefit', label: 'Credit card benefit guide' },
  { value: 'airline_contract', label: 'Airline contract of carriage' },
  { value: 'car_rental', label: 'Car rental protection' },
  { value: 'other', label: 'Other document' },
];

export default function PolicyUploadPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preTripId = searchParams.get('trip_id');
  const inputRef = useRef<HTMLInputElement>(null);

  const [label, setLabel] = useState('');
  const [sourceType, setSourceType] = useState('travel_insurance');
  const [tripId, setTripId] = useState(preTripId || '');
  const [trips, setTrips] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'processing' | 'complete' | 'failed'>('idle');
  const [rulesFound, setRulesFound] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    supabase
      .from('trips')
      .select('trip_id, trip_name')
      .eq('account_id', user.id)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => setTrips(data || []));
  }, [user]);

  useEffect(() => {
    let poll: ReturnType<typeof setInterval>;
    if (documentId && extractionStatus === 'processing') {
      poll = setInterval(async () => {
        const res = await fetch(`/api/extraction/status?document_id=${documentId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'complete') {
          clearInterval(poll);
          setProgress(100);
          setExtractionStatus('complete');
          setRulesFound(data.rules_found ?? null);
        } else if (data.status === 'failed') {
          clearInterval(poll);
          setExtractionStatus('failed');
        }
      }, 3000);
    }
    return () => { if (poll) clearInterval(poll); };
  }, [documentId, extractionStatus]);

  const selectFile = (f: File) => {
    const allowed = ['application/pdf'];
    if (!allowed.includes(f.type) && !f.name.endsWith('.pdf')) {
      setError('Only PDF files are supported right now.');
      return;
    }
    if (f.size > 30 * 1024 * 1024) {
      setError('This file is too large. Please use a file under 30 MB.');
      return;
    }
    setError('');
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) selectFile(f);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!label.trim()) errs.label = 'Give this policy a name so you can find it later.';
    if (!file) errs.file = 'Please select a PDF to upload.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const runUpload = async () => {
    if (!validate() || !user || !file) return;
    setUploading(true);
    setError('');
    setProgress(10);

    const cycle = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % PROCESSING_MESSAGES.length);
      setProgress((prev) => Math.min(prev + 12, 80));
    }, 1500);

    try {
      // Step 1: Create policy + document records via RPC
      // Build params conditionally — PostgREST can't type-match null uuid
      const rpcParams: Record<string, any> = {
        p_account_id: user.id,
        p_policy_label: label.trim(),
        p_source_type: 'pdf_upload',
      };
      if (tripId) rpcParams.p_trip_id = tripId;

      const rpcRes = await supabase.rpc('initiate_policy_upload', rpcParams);

      if (rpcRes.error) throw new Error(rpcRes.error.message);

      const rpcData = (typeof rpcRes.data === 'string' ? JSON.parse(rpcRes.data) : rpcRes.data) as Record<string, any>;
      if (!rpcData?.ok) throw new Error(rpcData?.reason || 'Upload registration failed');

      const document_id = rpcData.document_id;
      const policy_id = rpcData.policy_id;

      // Step 2: Upload file to Supabase Storage
      const upload_path = `${user.id}/${policy_id}/${file.name}`;
      const uploadRes = await supabase.storage.from('policy-documents').upload(upload_path, file, {
        contentType: file.type || 'application/pdf',
        upsert: false,
      });

      if (uploadRes.error) throw new Error(uploadRes.error.message);

      // Step 3: Update document record with storage path, then trigger extraction
      const completeRes = await fetch('/api/extraction/upload-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id,
          account_id: user.id,
          policy_label: label.trim(),
          storage_path: upload_path,
          file_size_bytes: file.size,
          mime_type: file.type || 'application/pdf',
          source_type: sourceType,
          trip_id: tripId || null,
        }),
      });

      if (!completeRes.ok) {
        const errData = await completeRes.json().catch(() => ({}));
        console.error('[upload-complete] error:', errData);
      }

      clearInterval(cycle);
      setProgress(85);
      setDocumentId(document_id);
      setExtractionStatus('processing');
    } catch (err: any) {
      clearInterval(cycle);
      console.error('[upload] error:', err);
      setError(err?.message || 'Something went wrong during the upload. Please try again.');
      setUploading(false);
    }
  };

  const isProcessing = uploading || extractionStatus === 'processing';

  return (
    <div style={{ maxWidth: 560, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Link href={preTripId ? `/trips/${preTripId}` : '/coverage'} style={{
        fontSize: 13, color: '#888', textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {preTripId ? 'Back to trip' : 'Back to coverage'}
      </Link>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px', letterSpacing: '-0.3px' }}>
          Add a policy document
        </h1>
        <p style={{ fontSize: 14, color: '#888', margin: 0, lineHeight: 1.5 }}>
          Upload a PDF and we'll extract the coverage rules automatically.
        </p>
      </div>

      {extractionStatus === 'complete' ? (
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '28px 24px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.6"/>
            </svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#1A2B4A', margin: '0 0 6px', textAlign: 'center' }}>
            Your policy has been processed.
          </p>
          {rulesFound !== null && (
            <p style={{ fontSize: 14, color: '#555', margin: '0 0 20px', textAlign: 'center' }}>
              {rulesFound} coverage {rulesFound === 1 ? 'rule' : 'rules'} found.
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Link href={`/coverage`} style={{
              padding: '10px 20px', background: '#1A2B4A', color: 'white',
              borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600,
            }}>
              View policy
            </Link>
            {preTripId && (
              <Link href={`/trips/${preTripId}`} style={{
                padding: '10px 20px', background: '#f5f5f5', color: '#555',
                borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 500,
                border: '1px solid #e5e5e5',
              }}>
                Back to trip
              </Link>
            )}
          </div>
        </div>
      ) : extractionStatus === 'failed' ? (
        <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '28px 24px' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#1A2B4A', margin: '0 0 8px', textAlign: 'center' }}>
            We had trouble reading this document.
          </p>
          <p style={{ fontSize: 13, color: '#666', margin: '0 0 20px', textAlign: 'center', lineHeight: 1.6 }}>
            You can try uploading again or add the information manually.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => {
              setFile(null); setDocumentId(null);
              setExtractionStatus('idle'); setUploading(false); setProgress(0);
            }} style={{
              padding: '10px 20px', background: '#1A2B4A', color: 'white',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6 }}>
                Policy label
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => { setLabel(e.target.value); setFieldErrors((p) => ({ ...p, label: '' })); }}
                placeholder="e.g. Chase Sapphire Reserve — 2026"
                disabled={isProcessing}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px', fontSize: 14,
                  border: `1px solid ${fieldErrors.label ? '#fca5a5' : '#ddd'}`, borderRadius: 8,
                  outline: 'none', color: '#111',
                  background: isProcessing ? '#fafafa' : 'white',
                }}
              />
              {fieldErrors.label && (
                <p style={{ fontSize: 12, color: '#dc2626', margin: '4px 0 0' }}>{fieldErrors.label}</p>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6 }}>
                Document type
              </label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                disabled={isProcessing}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px', fontSize: 14,
                  border: '1px solid #ddd', borderRadius: 8,
                  outline: 'none', color: '#111', background: isProcessing ? '#fafafa' : 'white',
                  appearance: 'none',
                }}
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {trips.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6 }}>
                  Associate with a trip <span style={{ fontWeight: 400, color: '#aaa' }}>(optional)</span>
                </label>
                <select
                  value={tripId}
                  onChange={(e) => setTripId(e.target.value)}
                  disabled={isProcessing}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 12px', fontSize: 14,
                    border: '1px solid #ddd', borderRadius: 8,
                    outline: 'none', color: tripId ? '#111' : '#aaa', background: isProcessing ? '#fafafa' : 'white',
                    appearance: 'none',
                  }}
                >
                  <option value="">No specific trip</option>
                  {trips.map((t) => (
                    <option key={t.trip_id} value={t.trip_id}>{t.trip_name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '20px 22px' }}>
            {!isProcessing ? (
              <>
                <div
                  onClick={() => !file && inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragOver ? '#2E5FA3' : fieldErrors.file ? '#fca5a5' : '#ddd'}`,
                    borderRadius: 12, padding: '36px 20px',
                    textAlign: 'center', cursor: file ? 'default' : 'pointer',
                    background: dragOver ? '#f0f4ff' : '#fafafa',
                    transition: 'all 0.15s ease',
                    marginBottom: file ? 12 : 0,
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 10px', display: 'block' }}>
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#888" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="14 2 14 8 20 8" stroke="#888" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="16" y1="13" x2="8" y2="13" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="16" y1="17" x2="8" y2="17" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/>
                    <polyline points="10 9 9 9 8 9" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <p style={{ fontSize: 14, color: '#555', margin: '0 0 4px', fontWeight: 500 }}>
                    Drop your PDF here, or <span style={{ color: '#2E5FA3' }}>browse</span>
                  </p>
                  <p style={{ fontSize: 12, color: '#bbb', margin: 0 }}>PDF only · max 30 MB</p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) selectFile(f); }}
                />

                {fieldErrors.file && !file && (
                  <p style={{ fontSize: 12, color: '#dc2626', margin: '4px 0 0' }}>{fieldErrors.file}</p>
                )}

                {file && (
                  <div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', background: '#f7f8fa',
                      border: '1px solid #f0f0f0', borderRadius: 8, marginBottom: 14,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="#888" strokeWidth="1.5"/>
                        <path d="M8 8h8M8 12h5" stroke="#888" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                      <span style={{ fontSize: 13, color: '#333', flex: 1 }}>{file.name}</span>
                      <button onClick={() => setFile(null)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 16,
                      }}>×</button>
                    </div>
                    <button
                      onClick={runUpload}
                      style={{
                        width: '100%', padding: '11px 0',
                        background: '#1A2B4A', color: 'white',
                        border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Upload and extract
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '8px 0', textAlign: 'center' }}>
                <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, marginBottom: 14 }}>
                  <div style={{
                    height: '100%', background: '#2E5FA3',
                    borderRadius: 2, width: `${progress}%`,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                <p style={{ fontSize: 14, color: '#555', margin: 0 }}>
                  {PROCESSING_MESSAGES[msgIdx]}
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
        </div>
      )}
    </div>
  );
}
