'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

export type CatalogRow = {
  catalog_id: string;
  display_label: string;
  catalog_type: string;
  provider_name: string;
  product_name: string;
  clause_count: number | null;
  highlights: string[] | null;
};

const DEBOUNCE_MS = 200;

const CHASE_SAPPHIRE_RESERVE_ID = 'f6517000-0000-4000-8000-000000000009';

function useDebounced<T>(value: T, ms: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return d;
}

async function fetchCatalog(type: string, q: string): Promise<CatalogRow[]> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  params.set('type', type);
  const res = await fetch(`/api/coverage-catalog/search?${params.toString()}`);
  const json = await res.json();
  if (!res.ok || !json.ok) return [];
  return (json.items || []) as CatalogRow[];
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        border: active ? '1.5px solid #2E5FA3' : '1px solid #e5e7eb',
        background: active ? '#eff4fc' : '#fff',
        color: active ? '#1e40af' : '#444',
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {label}
    </button>
  );
}

export function CoverageCatalogPanel({
  selectedIds,
  onChangeSelected,
  onSkip,
  onContinue,
}: {
  selectedIds: string[];
  onChangeSelected: (ids: string[]) => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const [qCard, setQCard] = useState('');
  const [qAir, setQAir] = useState('');
  const [qIns, setQIns] = useState('');
  const dCard = useDebounced(qCard, DEBOUNCE_MS);
  const dAir = useDebounced(qAir, DEBOUNCE_MS);
  const dIns = useDebounced(qIns, DEBOUNCE_MS);

  const [cards, setCards] = useState<CatalogRow[]>([]);
  const [airlines, setAirlines] = useState<CatalogRow[]>([]);
  const [insurance, setInsurance] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState({ c: false, a: false, i: false });

  const toggle = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        onChangeSelected(selectedIds.filter((x) => x !== id));
      } else {
        onChangeSelected([...selectedIds, id]);
      }
    },
    [selectedIds, onChangeSelected],
  );

  useEffect(() => {
    let cancel = false;
    setLoading((s) => ({ ...s, c: true }));
    fetchCatalog('credit_card_benefit', dCard).then((rows) => {
      if (!cancel) {
        setCards(rows);
        setLoading((s) => ({ ...s, c: false }));
      }
    });
    return () => {
      cancel = true;
    };
  }, [dCard]);

  useEffect(() => {
    let cancel = false;
    setLoading((s) => ({ ...s, a: true }));
    fetchCatalog('airline_contract', dAir).then((rows) => {
      if (!cancel) {
        setAirlines(rows);
        setLoading((s) => ({ ...s, a: false }));
      }
    });
    return () => {
      cancel = true;
    };
  }, [dAir]);

  useEffect(() => {
    let cancel = false;
    setLoading((s) => ({ ...s, i: true }));
    fetchCatalog('travel_insurance', dIns).then((rows) => {
      if (!cancel) {
        setInsurance(rows);
        setLoading((s) => ({ ...s, i: false }));
      }
    });
    return () => {
      cancel = true;
    };
  }, [dIns]);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #ddd',
    borderRadius: 8,
    outline: 'none',
    color: '#111',
    background: 'white',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#444',
    marginBottom: 6,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  function renderResults(rows: CatalogRow[], busy: boolean, emptyHint: string) {
    if (busy && rows.length === 0) {
      return (
        <div style={{ fontSize: 13, color: '#94a3b8', padding: '8px 0' }} aria-busy="true">
          Loading catalog…
        </div>
      );
    }
    if (!busy && rows.length === 0) {
      return <div style={{ fontSize: 13, color: '#94a3b8', padding: '8px 0' }}>{emptyHint}</div>;
    }
    return (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 200, overflowY: 'auto' }}>
        {rows.map((row) => {
          const active = selectedIds.includes(row.catalog_id);
          return (
            <li key={row.catalog_id} style={{ marginBottom: 6 }}>
              <button
                type="button"
                onClick={() => toggle(row.catalog_id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: active ? '1.5px solid #2E5FA3' : '1px solid #eee',
                  background: active ? '#f8fafc' : '#fafafa',
                  cursor: 'pointer',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>{row.display_label}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {row.clause_count != null ? `${row.clause_count} clauses` : 'Catalog entry'}
                  {row.highlights?.length
                    ? ` · ${row.highlights.slice(0, 2).join(' · ')}`
                    : ''}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '24px 20px' }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: '0 0 6px' }}>
        What coverage do you have for this trip?
      </h2>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px', lineHeight: 1.55 }}>
        Pick cards, airlines, or insurance we already have on file — instant coverage, no upload. You can skip and add
        policies later.
      </p>

      {selectedIds.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {selectedIds.map((id) => (
            <Chip
              key={id}
              label={id === CHASE_SAPPHIRE_RESERVE_ID ? 'Chase Sapphire Reserve' : id.slice(0, 8) + '…'}
              active
              onClick={() => toggle(id)}
            />
          ))}
        </div>
      )}

      <p style={{ ...labelStyle, marginTop: 0 }}>Quick add</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        <Chip
          label="Chase Sapphire Reserve"
          active={selectedIds.includes(CHASE_SAPPHIRE_RESERVE_ID)}
          onClick={() => toggle(CHASE_SAPPHIRE_RESERVE_ID)}
        />
      </div>

      <section style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Credit cards you plan to use</label>
        <input
          type="search"
          placeholder="Search benefit guides…"
          value={qCard}
          onChange={(e) => setQCard(e.target.value)}
          style={inputStyle}
          autoComplete="off"
        />
        {renderResults(cards, loading.c, 'Type to search or use quick add above.')}
      </section>

      <section style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Airlines you&apos;re flying</label>
        <input
          type="search"
          placeholder="Search contracts of carriage…"
          value={qAir}
          onChange={(e) => setQAir(e.target.value)}
          style={inputStyle}
          autoComplete="off"
        />
        {renderResults(airlines, loading.a, 'No matches — try another airline name.')}
      </section>

      <section style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Travel insurance</label>
        <input
          type="search"
          placeholder="Search insurance products…"
          value={qIns}
          onChange={(e) => setQIns(e.target.value)}
          style={inputStyle}
          autoComplete="off"
        />
        {renderResults(insurance, loading.i, 'No catalog match? Upload a policy after your trip is created.')}
      </section>

      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>
        <Link href="/policies/upload" style={{ color: '#2E5FA3', fontWeight: 600 }}>
          Upload a different document
        </Link>{' '}
        after the trip exists (we&apos;ll link it on the next screen).
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={onContinue}
          style={{
            width: '100%',
            padding: '11px 0',
            background: '#1A2B4A',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onSkip}
          style={{
            width: '100%',
            padding: '9px 0',
            background: 'white',
            color: '#64748b',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
