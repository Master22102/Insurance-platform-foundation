'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { supabase } from '@/lib/auth/supabase-client';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'text/plain'];
const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const CATEGORIES = [
  { key: 'receipt', label: 'Receipt' },
  { key: 'boarding_pass', label: 'Boarding pass' },
  { key: 'delay_notice', label: 'Delay notice' },
  { key: 'carrier_confirmation', label: 'Carrier confirmation' },
  { key: 'email', label: 'Email' },
  { key: 'screenshot', label: 'Screenshot' },
  { key: 'other', label: 'Other' },
];

interface EvidenceUploadProps {
  incidentId: string;
  onUploaded?: (evidence: { name: string; category: string; id: string }) => void;
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export default function EvidenceUpload({ incidentId, onUploaded }: EvidenceUploadProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [category, setCategory] = useState('other');
  const [uploadedId, setUploadedId] = useState('');

  const validate = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.endsWith('.heic')) {
      return "That file type isn't supported. Try PDF, JPG, PNG, or plain text.";
    }
    if (f.size > MAX_BYTES) return `That file is too large (max ${MAX_MB}MB).`;
    return null;
  };

  const selectFile = (f: File) => {
    const err = validate(f);
    if (err) { setFileError(err); setFile(null); return; }
    setFileError('');
    setFile(f);
    setUploadState('idle');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) selectFile(f);
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploadState('uploading');
    setProgress(20);
    const path = `${user.id}/${incidentId}/${Date.now()}-${file.name}`;
    const { error: storageError } = await supabase.storage
      .from('evidence')
      .upload(path, file, { contentType: file.type });

    if (storageError) {
      setUploadState('error');
      return;
    }

    setProgress(60);

    const idempotencyKey = `evidence-${incidentId}-${path}`;
    const { data: regData, error: regError } = await supabase.rpc('register_evidence', {
      p_incident_id: incidentId,
      p_name: file.name,
      p_type: 'file',
      p_description: null,
      p_file_path: path,
      p_file_size_bytes: file.size,
      p_mime_type: file.type || 'application/octet-stream',
      p_metadata: { category },
      p_actor_id: user.id,
      p_idempotency_key: idempotencyKey,
    });

    if (regError || !regData?.success) {
      await supabase.storage.from('evidence').remove([path]).catch(() => {});
      setUploadState('error');
      return;
    }

    setProgress(100);
    setUploadState('done');
    setUploadedId(regData.evidence_id || '');
    onUploaded?.({ name: file.name, category, id: regData.evidence_id || '' });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {uploadState !== 'done' && (
        <>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? '#2E5FA3' : '#ddd'}`,
              borderRadius: 12, padding: '28px 20px',
              textAlign: 'center', cursor: 'pointer',
              background: dragOver ? '#f0f4ff' : '#fafafa',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 10px', display: 'block' }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="#888" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="17 8 12 3 7 8" stroke="#888" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="#888" strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
            <p style={{ fontSize: 14, color: '#555', margin: '0 0 4px', fontWeight: 500 }}>
              Drop a file here, or <span style={{ color: '#2E5FA3' }}>browse</span>
            </p>
            <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>PDF, JPG, PNG, HEIC, or plain text · Max 10MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.heic,.txt"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) selectFile(f); }}
          />
        </>
      )}

      {fileError && (
        <div style={{
          marginTop: 10, padding: '9px 14px',
          background: '#fef9f0', border: '1px solid #fde68a',
          borderRadius: 8, fontSize: 13, color: '#92400e',
        }}>
          {fileError}
        </div>
      )}

      {file && uploadState !== 'done' && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'white', border: '0.5px solid #e8e8e8',
            borderRadius: 10, padding: '12px 14px', marginBottom: 10,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="#888" strokeWidth="1.6"/>
              <path d="M8 12h8M8 8h5" stroke="#888" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#111', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </p>
              <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>{formatSize(file.size)}</p>
            </div>
            <button
              onClick={() => { setFile(null); setUploadState('idle'); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '2px', fontSize: 16 }}
            >
              ×
            </button>
          </div>

          {uploadState === 'uploading' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2 }}>
                <div style={{
                  height: '100%', background: '#2E5FA3',
                  borderRadius: 2, width: `${progress}%`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <p style={{ fontSize: 12, color: '#888', margin: '6px 0 0' }}>Uploading…</p>
            </div>
          )}

          {uploadState === 'error' && (
            <p style={{ fontSize: 13, color: '#c2410c', margin: '0 0 8px' }}>
              Upload failed — tap to try again.
            </p>
          )}

          {uploadState === 'idle' || uploadState === 'error' ? (
            <button
              onClick={handleUpload}
              style={{
                width: '100%', padding: '10px 0',
                background: '#1A2B4A', color: 'white',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Upload file
            </button>
          ) : null}
        </div>
      )}

      {uploadState === 'done' && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 10, padding: '10px 14px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5"/>
            </svg>
            <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 500 }}>
              {file?.name} uploaded
            </span>
          </div>

          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#444', margin: '0 0 8px' }}>
              What type of document is this?
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key)}
                  style={{
                    padding: '5px 12px', borderRadius: 20,
                    border: `1px solid ${category === cat.key ? '#2E5FA3' : '#ddd'}`,
                    background: category === cat.key ? '#eff4fc' : 'white',
                    color: category === cat.key ? '#2E5FA3' : '#555',
                    fontSize: 12, fontWeight: category === cat.key ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
