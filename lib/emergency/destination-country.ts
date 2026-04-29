import type { SupabaseClient } from '@supabase/supabase-js';

const DIRECT_MAP: Array<{ code: string; hints: string[] }> = [
  { code: 'JP', hints: ['japan', 'tokyo', 'osaka', 'kyoto'] },
  { code: 'TH', hints: ['thailand', 'bangkok', 'phuket', 'chiang mai'] },
  { code: 'SG', hints: ['singapore'] },
  { code: 'AE', hints: ['uae', 'dubai', 'abu dhabi', 'united arab emirates'] },
  { code: 'ID', hints: ['indonesia', 'bali', 'jakarta'] },
  { code: 'CN', hints: ['china', 'beijing', 'shanghai', 'guangzhou'] },
  { code: 'SA', hints: ['saudi', 'riyadh', 'jeddah'] },
  { code: 'GB', hints: ['united kingdom', 'uk', 'england', 'london'] },
  { code: 'FR', hints: ['france', 'paris'] },
  { code: 'DE', hints: ['germany', 'berlin', 'munich'] },
  { code: 'IT', hints: ['italy', 'rome', 'milan'] },
  { code: 'ES', hints: ['spain', 'madrid', 'barcelona'] },
  { code: 'US', hints: ['united states', 'usa'] },
];

let cachedCountryRows:
  | Array<{
      country_code: string;
      country_name: string | null;
    }>
  | null = null;
let cachedAt = 0;

async function getCountryRows(admin: SupabaseClient) {
  const now = Date.now();
  if (cachedCountryRows && now - cachedAt < 10 * 60 * 1000) return cachedCountryRows;
  const { data } = await admin.from('country_reference_data').select('country_code, country_name');
  cachedCountryRows = ((data || []) as Array<{ country_code: string; country_name: string | null }>).filter(
    (r) => r.country_code,
  );
  cachedAt = now;
  return cachedCountryRows;
}

export async function inferDestinationCountryCodes(
  admin: SupabaseClient,
  destinationSummary: string,
): Promise<string[]> {
  const text = String(destinationSummary || '').toLowerCase();
  if (!text) return [];

  const set = new Set<string>();
  for (const entry of DIRECT_MAP) {
    if (entry.hints.some((h) => text.includes(h))) set.add(entry.code);
  }

  const rows = await getCountryRows(admin);
  for (const row of rows) {
    const name = String(row.country_name || '').toLowerCase().trim();
    if (name && text.includes(name)) set.add(row.country_code.toUpperCase());
    const code = row.country_code.toLowerCase();
    if (code && new RegExp(`\\b${code}\\b`, 'i').test(text)) set.add(row.country_code.toUpperCase());
  }

  return Array.from(set);
}
