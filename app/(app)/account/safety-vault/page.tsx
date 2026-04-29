'use client';

import { useEffect, useState } from 'react';
import AppPageRoot from '@/components/layout/AppPageRoot';
import { touch } from '@/lib/styles/tokens';

export default function SafetyVaultPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [label, setLabel] = useState('');
  const [documentType, setDocumentType] = useState('prescription');

  const load = async () => {
    const res = await fetch('/api/personal-documents', { credentials: 'include' });
    const j = await res.json().catch(() => ({}));
    setRows(Array.isArray(j.documents) ? j.documents : []);
  };
  useEffect(() => {
    void load();
  }, []);

  const fieldStyle = {
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    fontSize: 15,
    minHeight: touch.inputMinHeight,
    boxSizing: 'border-box' as const,
  };

  return (
    <AppPageRoot>
      <div data-testid="safety-vault-root" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1A2B4A' }}>Safety document vault</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          Keep prescriptions, certificates, and travel medical documents ready.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch' }}>
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} style={{ ...fieldStyle, minWidth: 200 }}>
            {[
              'prescription',
              'import_certificate',
              'vaccination_record',
              'doctor_letter',
              'insurance_card',
              'passport_copy',
              'visa_copy',
              'emergency_plan',
              'other',
            ].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <input
            data-testid="safety-vault-label-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Document label"
            style={{ ...fieldStyle, flex: '1 1 200px', minWidth: 0 }}
          />
          <button
            data-testid="safety-vault-add-button"
            type="button"
            onClick={async () => {
              if (!label.trim()) return;
              await fetch('/api/personal-documents', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ document_type: documentType, label: label.trim() }),
              });
              setLabel('');
              await load();
            }}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid #1e3a8a',
              background: '#1e3a8a',
              color: 'white',
              fontWeight: 700,
              minHeight: touch.minTap,
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            Add
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r) => (
            <div data-testid="safety-vault-document-row" key={r.document_id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: 'white' }}>
              <p data-testid="safety-vault-document-label" style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{r.label}</p>
              <p style={{ margin: '4px 0 8px', fontSize: 12, color: '#64748b' }}>{r.document_type}</p>
              <button
                data-testid={`safety-vault-archive-${r.document_id}`}
                type="button"
                onClick={async () => {
                  await fetch(`/api/personal-documents/${r.document_id}`, { method: 'DELETE', credentials: 'include' });
                  await load();
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid #fecaca',
                  background: '#fff',
                  color: '#b91c1c',
                  fontWeight: 700,
                  minHeight: touch.minTap,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                Archive
              </button>
            </div>
          ))}
        </div>
      </div>
    </AppPageRoot>
  );
}
