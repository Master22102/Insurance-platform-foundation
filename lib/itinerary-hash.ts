import { createHash } from 'crypto';

export function computeItineraryHash(parts: {
  destination?: string | null;
  departure_date?: string | null;
  return_date?: string | null;
  travel_mode?: string | null;
  adults_count?: number | null;
  children_count?: number | null;
  infant_count?: number | null;
  document_fingerprint?: string | null;
}): string {
  const canonical = [
    (parts.destination ?? '').trim().toLowerCase(),
    parts.departure_date ?? '',
    parts.return_date ?? '',
    (parts.travel_mode ?? '').toLowerCase(),
    String(parts.adults_count ?? 0),
    String(parts.children_count ?? 0),
    String(parts.infant_count ?? 0),
    parts.document_fingerprint ?? '',
  ].join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

export function fingerprintBuffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}
